import { describe, expect, it } from 'vitest'
import {
  addElement,
  createTextElement,
  createSlide,
  deleteElement,
  duplicateSlide,
  moveElement,
  reorderSlides,
  updateElement
} from '../src/index'

describe('document operations', () => {
  it('adds, updates, moves, and deletes elements immutably', () => {
    const slide = createSlide('slide-001', 'Title')
    const text = createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'Hello')

    const withText = addElement(slide, text)
    expect(withText.elements).toHaveLength(1)
    expect(slide.elements).toHaveLength(0)

    const updated = updateElement(withText, 'el-001', { rotation: 15 })
    expect(updated.elements[0]?.rotation).toBe(15)

    const moved = moveElement(updated, 'el-001', 30, 40)
    expect(moved.elements[0]?.x).toBe(40)
    expect(moved.elements[0]?.y).toBe(60)

    const withoutText = deleteElement(moved, 'el-001')
    expect(withoutText.elements).toHaveLength(0)
  })

  it('duplicates slides and reorders the slide list', () => {
    const first = createSlide('slide-001', 'One')
    const second = createSlide('slide-002', 'Two')
    const duplicate = duplicateSlide(first, 'slide-003')

    expect(duplicate.id).toBe('slide-003')
    expect(duplicate.title).toBe('One Copy')

    const reordered = reorderSlides([first, second, duplicate], 2, 0)
    expect(reordered.map((slide) => slide.id)).toEqual(['slide-003', 'slide-001', 'slide-002'])
  })
})
