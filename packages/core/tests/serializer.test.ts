import { describe, expect, it } from 'vitest'
import {
  addElement,
  createImageElement,
  createLineElement,
  createShapeElement,
  createSlide,
  createTextElement,
  parseSlideHtml,
  serializeSlideToHtml
} from '../src/index'
import type { LineElement } from '../src/index'

describe('slide serializer', () => {
  it('round-trips a PPHT slide through HTML', () => {
    const slide = addElement(
      createSlide('slide-001', 'Title'),
      createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'Hello <World>')
    )

    const html = serializeSlideToHtml(slide)
    expect(html).toContain('data-ppht-slide-root')
    expect(html).toContain('data-ppht-slide-model')
    expect(html).toContain('Hello &lt;World&gt;')

    const parsed = parseSlideHtml(html)
    expect(parsed.id).toBe('slide-001')
    expect(parsed.elements[0]?.id).toBe('el-001')
    expect(parsed.elements[0]?.type).toBe('text')
  })

  it('throws a clear error when model JSON is missing', () => {
    expect(() => parseSlideHtml('<!doctype html><html><body></body></html>')).toThrow('Missing PPHT slide model')
  })

  it('escapes image attributes with quotes and angle brackets', () => {
    const slide = addElement(
      createSlide('slide-001', 'Images'),
      createImageElement(
        'image-001',
        { x: 10, y: 20, width: 320, height: 180 },
        'https://example.test/image.svg?name="hero"<bad>',
        'Alt "quoted" <tag>'
      )
    )

    const html = serializeSlideToHtml(slide)

    expect(html).toContain('src="https://example.test/image.svg?name=&quot;hero&quot;&lt;bad&gt;"')
    expect(html).toContain('alt="Alt &quot;quoted&quot; &lt;tag&gt;"')
    expect(html).not.toContain('src="https://example.test/image.svg?name="hero"<bad>"')
  })

  it('renders text font size with px while preserving unitless line height', () => {
    const slide = addElement(
      createSlide('slide-001', 'Text styles'),
      createTextElement('text-001', { x: 10, y: 20, width: 300, height: 80 }, 'Hello')
    )

    const html = serializeSlideToHtml(slide)

    expect(html).toContain('font-size: 48px')
    expect(html).toContain('line-height: 1.2')
    expect(html).not.toContain('font-size: 48;')
  })

  it('renders shapes with visible CSS for fill, stroke, and ellipse radius', () => {
    const rectangle = createShapeElement('shape-rectangle', { x: 20, y: 30, width: 120, height: 80 }, 'rectangle')
    rectangle.style.fill = '#f97316'
    rectangle.style.stroke = '#111827'
    rectangle.style.strokeWidth = 4

    const ellipse = createShapeElement('shape-ellipse', { x: 180, y: 30, width: 120, height: 80 }, 'ellipse')
    ellipse.style.fill = '#22c55e'
    ellipse.style.stroke = '#0f172a'
    ellipse.style.strokeWidth = 2

    const slide = addElement(addElement(createSlide('slide-001', 'Shapes'), rectangle), ellipse)

    const html = serializeSlideToHtml(slide)

    expect(html).toContain('background: #f97316')
    expect(html).toContain('border: 4px solid #111827')
    expect(html).toContain('background: #22c55e')
    expect(html).toContain('border: 2px solid #0f172a')
    expect(html).toContain('border-radius: 9999px')
  })

  it('sanitizes hostile runtime line coordinates before rendering attributes', () => {
    const line = createLineElement('line-001', { x: 0, y: 0, width: 300, height: 100 })
    const hostileLine = line as unknown as {
      width: unknown
      height: unknown
      content: Record<string, unknown>
    }
    hostileLine.width = '300" onload="alert(1)'
    hostileLine.height = Number.POSITIVE_INFINITY
    hostileLine.content.x1 = '0" onclick="alert(1)'
    hostileLine.content.y1 = Number.NaN
    hostileLine.content.x2 = 300
    hostileLine.content.y2 = '100><script>alert(1)</script>'

    const slide = addElement(createSlide('slide-001', 'Lines'), line as LineElement)

    const html = serializeSlideToHtml(slide)
    const renderedMarkup = html.slice(0, html.indexOf('<script type="application/json"'))

    expect(html).toContain('viewBox="0 0 0 0"')
    expect(html).toContain('x1="0"')
    expect(html).toContain('y1="0"')
    expect(html).toContain('x2="300"')
    expect(html).toContain('y2="0"')
    expect(renderedMarkup).not.toContain('onload=')
    expect(renderedMarkup).not.toContain('onclick=')
    expect(renderedMarkup).not.toContain('<script>alert(1)</script>')
  })

  it('escapes closing script tags in embedded JSON and round-trips through parsing', () => {
    const slide = addElement(
      createSlide('slide-001', '</script><script>alert(1)</script>'),
      createTextElement('text-001', { x: 10, y: 20, width: 300, height: 80 }, 'Before </script> after')
    )

    const html = serializeSlideToHtml(slide)

    expect(html).toContain('<\\/script>')
    expect(html).not.toContain('Before </script> after')
    expect(parseSlideHtml(html)).toEqual(slide)
  })

  it('preserves representative slide data through parse round-trip', () => {
    const image = createImageElement('image-001', { x: 20, y: 30, width: 200, height: 120 }, '/asset.png', 'Asset')
    const shape = createShapeElement('shape-001', { x: 260, y: 30, width: 180, height: 120 }, 'ellipse')
    const line = createLineElement('line-001', { x: 50, y: 220, width: 300, height: 40 })
    const slide = addElement(
      addElement(
        addElement(
          addElement(createSlide('slide-001', 'Representative'), createTextElement('text-001', { x: 10, y: 20, width: 300, height: 80 }, 'Hello')),
          image
        ),
        shape
      ),
      line
    )

    expect(parseSlideHtml(serializeSlideToHtml(slide))).toEqual(slide)
  })

  it('does not mutate the input slide during serialization', () => {
    const shape = createShapeElement('shape-001', { x: 10, y: 20, width: 120, height: 80 }, 'rectangle')
    shape.style.fill = '#ef4444'
    const slide = addElement(createSlide('slide-001', 'Immutable'), shape)
    const before = structuredClone(slide)

    serializeSlideToHtml(slide)

    expect(slide).toEqual(before)
  })
})
