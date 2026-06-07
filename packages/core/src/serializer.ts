import type {
  ChartElement,
  ElementNode,
  ImageElement,
  LineElement,
  MediaElement,
  ShapeElement,
  SlideDocument,
  TextElement
} from './model.js'

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

const numericCssLengthKeys = new Set([
  'fontSize',
  'strokeWidth',
  'borderRadius',
  'borderWidth',
  'outlineWidth',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'inlineSize',
  'blockSize',
  'minInlineSize',
  'minBlockSize',
  'maxInlineSize',
  'maxBlockSize',
  'top',
  'right',
  'bottom',
  'left',
  'inset',
  'insetBlock',
  'insetBlockStart',
  'insetBlockEnd',
  'insetInline',
  'insetInlineStart',
  'insetInlineEnd',
  'margin',
  'marginTop',
  'marginRight',
  'marginBottom',
  'marginLeft',
  'padding',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'gap',
  'rowGap',
  'columnGap'
])

function cssValue(value: unknown, key?: string): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return undefined
    }

    return key !== undefined && numericCssLengthKeys.has(key) ? `${value}px` : String(value)
  }

  if (typeof value === 'boolean' || typeof value === 'string') {
    return String(value)
  }

  return undefined
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function styleToCss(style: Record<string, unknown>, excludedKeys = new Set<string>()): string {
  return Object.entries(style)
    .flatMap(([key, value]) => {
      if (excludedKeys.has(key)) {
        return []
      }

      const renderedValue = cssValue(value, key)
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

function baseElementCss(element: ElementNode, excludedStyleKeys?: Set<string>): string {
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
    styleToCss(element.style, excludedStyleKeys)
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

const shapeStyleKeys = new Set(['fill', 'stroke', 'strokeWidth', 'borderRadius'])

function cssLength(value: unknown, fallback: string): string {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `${value}px` : fallback
  }

  return cssValue(value) ?? fallback
}

function shapeVisibleCss(element: ShapeElement): string {
  const fill = cssValue(element.style.fill) ?? 'transparent'
  const stroke = cssValue(element.style.stroke) ?? 'transparent'
  const strokeWidth = safeNumber(element.style.strokeWidth, 0)
  const borderRadius =
    element.content.shape === 'ellipse' ? '9999px' : cssLength(element.style.borderRadius, '0')

  return [
    `background: ${fill}`,
    strokeWidth > 0 ? `border: ${strokeWidth}px solid ${stroke}` : undefined,
    `border-radius: ${borderRadius}`,
    element.content.shape === 'triangle' ? 'clip-path: polygon(50% 0, 100% 100%, 0 100%)' : undefined
  ]
    .filter((value): value is string => Boolean(value))
    .join('; ')
}

function renderShapeElement(element: ShapeElement): string {
  const style = [baseElementCss(element, shapeStyleKeys), shapeVisibleCss(element)].filter(Boolean).join('; ')
  return `<div data-ppht-element-id="${escapeAttribute(element.id)}" data-ppht-element-type="shape" data-ppht-shape="${escapeAttribute(element.content.shape)}" style="${escapeAttribute(style)}"></div>`
}

function renderLineElement(element: LineElement): string {
  const stroke = cssValue(element.style.stroke) ?? '#111827'
  const strokeWidth = cssValue(element.style.strokeWidth) ?? '3'
  const safeElement = {
    ...element,
    width: safeNumber(element.width),
    height: safeNumber(element.height)
  }
  const x1 = safeNumber(element.content.x1)
  const y1 = safeNumber(element.content.y1)
  const x2 = safeNumber(element.content.x2)
  const y2 = safeNumber(element.content.y2)

  return `<svg data-ppht-element-id="${escapeAttribute(element.id)}" data-ppht-element-type="line" viewBox="0 0 ${safeElement.width} ${safeElement.height}" style="${escapeAttribute(baseElementCss(safeElement))}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${escapeAttribute(stroke)}" stroke-width="${escapeAttribute(strokeWidth)}" stroke-linecap="round"></line></svg>`
}

function renderChartElement(element: ChartElement): string {
  const values = element.content.values.map((value) => safeNumber(value))
  const maxValue = values.reduce((max, value) => Math.max(max, Math.abs(value)), 0)
  const bars = element.content.labels
    .map((label, index) => {
      const value = values[index] ?? 0
      const width = maxValue > 0 ? Math.max(4, Math.round((Math.abs(value) / maxValue) * 100)) : 4
      return `<li style="display: grid; grid-template-columns: minmax(0, 1fr) 3fr auto; gap: 8px; align-items: center; min-height: 24px;"><span>${escapeHtml(label)}</span><span style="display: block; height: 12px; border-radius: 9999px; background: currentColor; opacity: 0.22;"><span style="display: block; width: ${width}%; height: 100%; border-radius: 9999px; background: currentColor; opacity: 0.8;"></span></span><strong style="font-weight: 600;">${escapeHtml(String(value))}</strong></li>`
    })
    .join('')
  const style = [
    baseElementCss(element),
    'display: flex',
    'flex-direction: column',
    'gap: 10px',
    'padding: 16px',
    'border: 1px solid currentColor',
    'border-radius: 8px',
    'overflow: hidden'
  ].join('; ')

  return `<section data-ppht-element-id="${escapeAttribute(element.id)}" data-ppht-element-type="chart" data-ppht-chart-kind="${escapeAttribute(element.content.kind)}" style="${escapeAttribute(style)}"><strong style="font-size: 14px; text-transform: uppercase;">${escapeHtml(element.content.kind)} chart</strong><ol style="display: grid; gap: 8px; margin: 0; padding: 0; list-style: none;">${bars}</ol></section>`
}

function renderMediaElement(element: MediaElement): string {
  const style = [
    baseElementCss(element),
    'display: flex',
    'flex-direction: column',
    'gap: 8px',
    'padding: 12px',
    'overflow: hidden'
  ].join('; ')
  const control =
    element.content.mediaType === 'audio'
      ? `<audio controls src="${escapeAttribute(element.content.src)}" style="width: 100%;"></audio>`
      : `<video controls src="${escapeAttribute(element.content.src)}" style="width: 100%; height: 100%; min-height: 0; object-fit: contain;"></video>`

  return `<figure data-ppht-element-id="${escapeAttribute(element.id)}" data-ppht-element-type="media" data-ppht-media-type="${escapeAttribute(element.content.mediaType)}" style="${escapeAttribute(style)}"><figcaption style="font-weight: 600;">${escapeHtml(element.content.title)}</figcaption>${control}</figure>`
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
    case 'chart':
      return renderChartElement(element)
    case 'media':
      return renderMediaElement(element)
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
