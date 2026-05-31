import { describe, expect, it } from 'vitest'
import { createSlide, createTextElement, parseSlideHtml, serializeSlideToHtml, addElement } from '../src/index'

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
})
