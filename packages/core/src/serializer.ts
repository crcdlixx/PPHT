import type { ElementNode, ImageElement, LineElement, ShapeElement, SlideDocument, TextElement } from './model.js'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value)
}

function escapeJsonForScript(value: string): string {
  return value.replace(/<\/script/gi, '<\\/script')
}

function toKebabCase(value: string): string {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
}

function cssValue(value: unknown): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }

  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') {
    return String(value)
  }

  return undefined
}

function styleToCss(style: Record<string, unknown>): string {
  return Object.entries(style)
    .flatMap(([key, value]) => {
      const renderedValue = cssValue(value)
      return renderedValue === undefined ? [] : [`${toKebabCase(key)}: ${renderedValue}`]
    })
    .join('; ')
}

function cssString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')
}

function backgroundCss(slide: SlideDocument): string {
  if (slide.background.type === 'image') {
    return [
      `background-image: url("${cssString(slide.background.assetId)}")`,
      `background-size: ${slide.background.fit}`,
      'background-position: center',
      'background-repeat: no-repeat'
    ].join('; ')
  }

  return `background: ${slide.background.value}`
}

function baseElementCss(element: ElementNode): string {
  return [
    'position: absolute',
    `left: ${element.x}px`,
    `top: ${element.y}px`,
    `width: ${element.width}px`,
    `height: ${element.height}px`,
    `z-index: ${element.zIndex}`,
    `transform: rotate(${element.rotation}deg)`,
    'transform-origin: center center',
    element.visible ? undefined : 'display: none',
    styleToCss(element.style)
  ]
    .filter((value): value is string => Boolean(value))
    .join('; ')
}

function renderTextElement(element: TextElement): string {
  return `<div data-ppht-element-id="${escapeAttribute(element.id)}" data-ppht-element-type="text" style="${escapeAttribute(baseElementCss(element))}">${escapeHtml(element.content.text)}</div>`
}

function renderImageElement(element: ImageElement): string {
  return `<img data-ppht-element-id="${escapeAttribute(element.id)}" data-ppht-element-type="image" src="${escapeAttribute(element.content.src)}" alt="${escapeAttribute(element.content.alt)}" style="${escapeAttribute(`${baseElementCss(element)}; object-fit: contain`)}">`
}

function renderShapeElement(element: ShapeElement): string {
  const extraCss = element.content.shape === 'ellipse' ? 'border-radius: 9999px' : ''
  const triangleCss = element.content.shape === 'triangle' ? 'clip-path: polygon(50% 0, 100% 100%, 0 100%)' : ''
  const style = [baseElementCss(element), extraCss, triangleCss].filter(Boolean).join('; ')
  return `<div data-ppht-element-id="${escapeAttribute(element.id)}" data-ppht-element-type="shape" data-ppht-shape="${escapeAttribute(element.content.shape)}" style="${escapeAttribute(style)}"></div>`
}

function renderLineElement(element: LineElement): string {
  const stroke = cssValue(element.style.stroke) ?? '#111827'
  const strokeWidth = cssValue(element.style.strokeWidth) ?? '3'
  return `<svg data-ppht-element-id="${escapeAttribute(element.id)}" data-ppht-element-type="line" viewBox="0 0 ${element.width} ${element.height}" style="${escapeAttribute(baseElementCss(element))}"><line x1="${element.content.x1}" y1="${element.content.y1}" x2="${element.content.x2}" y2="${element.content.y2}" stroke="${escapeAttribute(stroke)}" stroke-width="${escapeAttribute(strokeWidth)}" stroke-linecap="round"></line></svg>`
}

function renderElement(element: ElementNode): string {
  switch (element.type) {
    case 'text':
      return renderTextElement(element)
    case 'image':
      return renderImageElement(element)
    case 'shape':
      return renderShapeElement(element)
    case 'line':
      return renderLineElement(element)
  }
}

export function serializeSlideToHtml(slide: SlideDocument): string {
  const modelJson = escapeJsonForScript(JSON.stringify(slide))
  const elementsHtml = slide.elements.map(renderElement).join('\n      ')
  const title = escapeHtml(slide.title)
  const rootStyle = escapeAttribute([
    'position: relative',
    'width: 1280px',
    'height: 720px',
    'overflow: hidden',
    backgroundCss(slide)
  ].join('; '))

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${title}</title>
    <style data-ppht-slide-style>
      [data-ppht-slide-root] { box-sizing: border-box; }
      [data-ppht-slide-root] *, [data-ppht-slide-root] *::before, [data-ppht-slide-root] *::after { box-sizing: border-box; }
    </style>
  </head>
  <body>
    <main data-ppht-slide-root style="${rootStyle}">
      ${elementsHtml}
    </main>
    <script type="application/json" data-ppht-slide-model>${modelJson}</script>
  </body>
</html>`
}

export function parseSlideHtml(html: string): SlideDocument {
  const match = html.match(/<script\b(?=[^>]*\bdata-ppht-slide-model\b)[^>]*>([\s\S]*?)<\/script>/i)
  const modelJson = match?.[1]

  if (modelJson === undefined) {
    throw new Error('Missing PPHT slide model')
  }

  return JSON.parse(modelJson) as SlideDocument
}
