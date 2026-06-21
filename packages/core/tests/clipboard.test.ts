import { describe, expect, it } from 'vitest'
import {
  addElement,
  copyElementsToClipboard,
  createChartElement,
  createGroupElement,
  createSlide,
  createTextElement,
  pasteClipboardElements
} from '../src/index'

describe('clipboard helpers', () => {
  it('copies only existing selected elements in slide order as an immutable payload', () => {
    const first = createTextElement('text-001', { x: 10, y: 20, width: 220, height: 80 }, 'First')
    const second = createChartElement(
      'chart-001',
      { x: 80, y: 120, width: 300, height: 180 },
      { kind: 'line', labels: ['A', 'B'], values: [1, 2] }
    )
    const slide = addElement(addElement(createSlide('slide-001', 'Clipboard'), first), second)

    const payload = copyElementsToClipboard(slide, ['missing-id', 'chart-001', 'text-001'])

    expect(payload.version).toBe('1.0.0')
    expect(payload.elements.map((element) => element.id)).toEqual(['text-001', 'chart-001'])

    payload.elements[0]!.x = 999
    expect(slide.elements[0]!.x).toBe(10)
  })

  it('pastes clipboard elements with fresh ids and the default offset', () => {
    const first = createTextElement('text-001', { x: 10, y: 20, width: 220, height: 80 }, 'First')
    const second = createChartElement(
      'chart-001',
      { x: 80, y: 120, width: 300, height: 180 },
      { kind: 'pie', labels: ['A', 'B'], values: [40, 60] }
    )
    const slide = addElement(addElement(createSlide('slide-001', 'Clipboard'), first), second)
    const payload = copyElementsToClipboard(slide, ['text-001', 'chart-001'])

    const { slide: updatedSlide, pastedElementIds } = pasteClipboardElements(
      slide,
      payload,
      (_element, index) => `pasted-${index + 1}`
    )

    expect(pastedElementIds).toEqual(['pasted-1', 'pasted-2'])
    expect(updatedSlide.elements.map((element) => element.id)).toEqual([
      'text-001',
      'chart-001',
      'pasted-1',
      'pasted-2'
    ])
    expect(updatedSlide.elements[2]).toMatchObject({ id: 'pasted-1', x: 34, y: 44, type: 'text' })
    expect(updatedSlide.elements[3]).toMatchObject({ id: 'pasted-2', x: 104, y: 144, type: 'chart' })
    expect(slide.elements).toHaveLength(2)
  })

  it('supports a custom paste offset', () => {
    const slide = addElement(
      createSlide('slide-001', 'Clipboard'),
      createTextElement('text-001', { x: 10, y: 20, width: 220, height: 80 }, 'First')
    )
    const payload = copyElementsToClipboard(slide, ['text-001'])

    const { slide: updatedSlide } = pasteClipboardElements(slide, payload, () => 'pasted-001', { x: -5, y: 12 })

    expect(updatedSlide.elements[1]).toMatchObject({ id: 'pasted-001', x: 5, y: 32 })
  })

  it('pastes grouped clipboard elements with fresh child ids', () => {
    const group = createGroupElement(
      'group-001',
      { x: 40, y: 60, width: 240, height: 120 },
      [
        createTextElement('text-child-001', { x: 0, y: 0, width: 120, height: 40 }, 'Child 1'),
        createTextElement('text-child-002', { x: 130, y: 70, width: 100, height: 40 }, 'Child 2')
      ]
    )
    const slide = addElement(createSlide('slide-001', 'Clipboard'), group)
    const payload = copyElementsToClipboard(slide, ['group-001'])

    const { slide: updatedSlide, pastedElementIds } = pasteClipboardElements(
      slide,
      payload,
      (element, index, parentId) => `${parentId ? `${parentId}-` : ''}${element.type}-pasted-${index + 1}`
    )

    const pastedGroup = updatedSlide.elements[1]
    expect(pastedElementIds).toEqual(['group-pasted-1'])
    expect(pastedGroup).toMatchObject({ id: 'group-pasted-1', type: 'group', x: 64, y: 84 })
    expect(pastedGroup?.type === 'group' ? pastedGroup.content.elements.map((element) => element.id) : []).toEqual([
      'group-pasted-1-text-pasted-1',
      'group-pasted-1-text-pasted-2'
    ])
  })
})
