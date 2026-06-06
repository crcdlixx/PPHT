import { describe, expect, it } from 'vitest'
import {
  addElement,
  createTextElement,
  createShapeElement,
  createSlide,
  createSlideRef,
  deleteElement,
  deleteSlideRef,
  duplicateSlide,
  duplicateSlideRef,
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

  it('creates and duplicates slide references with derived file paths', () => {
    const first = createSlideRef('slide-001', 'One')
    const duplicate = duplicateSlideRef(first, 'slide-002')

    expect(first).toEqual({
      id: 'slide-001',
      title: 'One',
      html: 'slides/slide-001.html',
      thumbnail: 'thumbs/slide-001.svg'
    })
    expect(duplicate).toEqual({
      id: 'slide-002',
      title: 'One Copy',
      html: 'slides/slide-002.html',
      thumbnail: 'thumbs/slide-002.svg'
    })
  })

  it('deletes slide references from the slide list', () => {
    const first = createSlideRef('slide-001', 'One')
    const second = createSlideRef('slide-002', 'Two')
    const deleted = deleteSlideRef([first, second], 'slide-001')

    expect(deleted).toEqual([second])
  })

  it('deep clones duplicated slide elements', () => {
    const text = createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'Hello')
    const original = addElement(createSlide('slide-001', 'One'), text)
    const duplicate = duplicateSlide(original, 'slide-002')

    duplicate.elements[0]!.style.color = '#ff0000'
    if (duplicate.elements[0]?.type === 'text') {
      duplicate.elements[0].content.text = 'Changed'
    }

    const originalElement = original.elements[0]
    expect(originalElement?.style.color).toBe('#111827')
    expect(originalElement?.type).toBe('text')
    if (originalElement?.type === 'text') {
      expect(originalElement.content.text).toBe('Hello')
    }
  })

  it('does not share nested element data from caller input when adding elements', () => {
    const text = createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'Hello')
    const withText = addElement(createSlide('slide-001', 'One'), text)

    text.style.color = '#ff0000'
    text.content.text = 'Changed'

    const storedElement = withText.elements[0]
    expect(storedElement?.style.color).toBe('#111827')
    expect(storedElement?.type).toBe('text')
    if (storedElement?.type === 'text') {
      expect(storedElement.content.text).toBe('Hello')
    }
  })

  it('does not share untouched existing elements when adding elements', () => {
    const first = createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'One')
    const second = createTextElement('el-002', { x: 40, y: 50, width: 300, height: 80 }, 'Two')
    const original = addElement(createSlide('slide-001', 'One'), first)
    const updated = addElement(original, second)

    updated.elements[0]!.style.color = '#ff0000'
    if (updated.elements[0]?.type === 'text') {
      updated.elements[0].content.text = 'Changed'
    }

    const originalElement = original.elements[0]
    expect(originalElement?.style.color).toBe('#111827')
    expect(originalElement?.type).toBe('text')
    if (originalElement?.type === 'text') {
      expect(originalElement.content.text).toBe('One')
    }
  })

  it('does not share nested element data between updateElement slide versions', () => {
    const text = createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'Hello')
    const original = addElement(createSlide('slide-001', 'One'), text)
    const updated = updateElement(original, 'el-001', { rotation: 15 })

    updated.elements[0]!.style.color = '#ff0000'
    if (updated.elements[0]?.type === 'text') {
      updated.elements[0].content.text = 'Changed'
    }

    const originalElement = original.elements[0]
    expect(originalElement?.style.color).toBe('#111827')
    expect(originalElement?.type).toBe('text')
    if (originalElement?.type === 'text') {
      expect(originalElement.content.text).toBe('Hello')
    }
  })

  it('does not share untouched elements between updateElement slide versions', () => {
    const first = createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'One')
    const second = createTextElement('el-002', { x: 40, y: 50, width: 300, height: 80 }, 'Two')
    const original = addElement(addElement(createSlide('slide-001', 'One'), first), second)
    const updated = updateElement(original, 'el-002', { rotation: 15 })

    updated.elements[0]!.style.color = '#ff0000'
    if (updated.elements[0]?.type === 'text') {
      updated.elements[0].content.text = 'Changed'
    }

    const originalElement = original.elements[0]
    expect(originalElement?.style.color).toBe('#111827')
    expect(originalElement?.type).toBe('text')
    if (originalElement?.type === 'text') {
      expect(originalElement.content.text).toBe('One')
    }
  })

  it('clones caller-owned nested update patch data', () => {
    const text = createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'Hello')
    const original = addElement(createSlide('slide-001', 'One'), text)
    const patchStyle = { color: '#abc' }
    const updated = updateElement(original, 'el-001', { style: patchStyle })

    patchStyle.color = '#def'

    expect(updated.elements[0]?.style.color).toBe('#abc')
  })

  it('updates text content and clones caller-owned content patch data', () => {
    const text = createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'Hello')
    const original = addElement(createSlide('slide-001', 'One'), text)
    const patchContent = { text: 'Updated' }
    const updated = updateElement(original, 'el-001', { content: patchContent })

    patchContent.text = 'Changed'

    expect(updated.elements[0]?.type).toBe('text')
    if (updated.elements[0]?.type === 'text') {
      expect(updated.elements[0].content.text).toBe('Updated')
    }
  })

  it('does not share nested element data between moveElement slide versions', () => {
    const text = createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'Hello')
    const original = addElement(createSlide('slide-001', 'One'), text)
    const moved = moveElement(original, 'el-001', 30, 40)

    moved.elements[0]!.style.color = '#ff0000'
    if (moved.elements[0]?.type === 'text') {
      moved.elements[0].content.text = 'Changed'
    }

    const originalElement = original.elements[0]
    expect(originalElement?.style.color).toBe('#111827')
    expect(originalElement?.type).toBe('text')
    if (originalElement?.type === 'text') {
      expect(originalElement.content.text).toBe('Hello')
    }
  })

  it('does not share untouched elements between moveElement slide versions', () => {
    const first = createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'One')
    const second = createTextElement('el-002', { x: 40, y: 50, width: 300, height: 80 }, 'Two')
    const original = addElement(addElement(createSlide('slide-001', 'One'), first), second)
    const moved = moveElement(original, 'el-002', 30, 40)

    moved.elements[0]!.style.color = '#ff0000'
    if (moved.elements[0]?.type === 'text') {
      moved.elements[0].content.text = 'Changed'
    }

    const originalElement = original.elements[0]
    expect(originalElement?.style.color).toBe('#111827')
    expect(originalElement?.type).toBe('text')
    if (originalElement?.type === 'text') {
      expect(originalElement.content.text).toBe('One')
    }
  })

  it('does not share surviving elements between deleteElement slide versions', () => {
    const first = createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'One')
    const second = createTextElement('el-002', { x: 40, y: 50, width: 300, height: 80 }, 'Two')
    const original = addElement(addElement(createSlide('slide-001', 'One'), first), second)
    const deleted = deleteElement(original, 'el-002')

    deleted.elements[0]!.style.color = '#ff0000'
    if (deleted.elements[0]?.type === 'text') {
      deleted.elements[0].content.text = 'Changed'
    }

    const originalElement = original.elements[0]
    expect(originalElement?.style.color).toBe('#111827')
    expect(originalElement?.type).toBe('text')
    if (originalElement?.type === 'text') {
      expect(originalElement.content.text).toBe('One')
    }
  })

  it('creates fresh default style objects for text and shape elements', () => {
    const firstText = createTextElement('el-001', { x: 0, y: 0, width: 100, height: 40 }, 'One')
    const secondText = createTextElement('el-002', { x: 0, y: 0, width: 100, height: 40 }, 'Two')
    const firstShape = createShapeElement('el-003', { x: 0, y: 0, width: 100, height: 40 }, 'rectangle')
    const secondShape = createShapeElement('el-004', { x: 0, y: 0, width: 100, height: 40 }, 'ellipse')

    firstText.style.color = '#ff0000'
    firstShape.style.fill = '#00ff00'

    expect(secondText.style.color).toBe('#111827')
    expect(secondShape.style.fill).toBe('#ffffff')
  })

  it('does not reorder slides when indices are invalid', () => {
    const slides = [createSlide('slide-001', 'One'), createSlide('slide-002', 'Two')]

    expect(reorderSlides(slides, -1, 0)).toEqual(slides)
    expect(reorderSlides(slides, 0, -1)).toEqual(slides)
    expect(reorderSlides(slides, 2, 0)).toEqual(slides)
    expect(reorderSlides(slides, 0, 2)).toEqual(slides)
  })
})
