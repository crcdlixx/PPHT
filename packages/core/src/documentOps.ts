import type { ElementNode, SlideDocument } from './model'

export function addElement(slide: SlideDocument, element: ElementNode): SlideDocument {
  const maxZ = slide.elements.reduce((max, item) => Math.max(max, item.zIndex), 0)
  return {
    ...slide,
    elements: [...slide.elements, { ...element, zIndex: maxZ + 1 }]
  }
}

export function updateElement(
  slide: SlideDocument,
  elementId: string,
  patch: Partial<Omit<ElementNode, 'id' | 'type'>>
): SlideDocument {
  return {
    ...slide,
    elements: slide.elements.map((element) =>
      element.id === elementId ? ({ ...element, ...patch } as ElementNode) : element
    )
  }
}

export function deleteElement(slide: SlideDocument, elementId: string): SlideDocument {
  return {
    ...slide,
    elements: slide.elements.filter((element) => element.id !== elementId)
  }
}

export function moveElement(slide: SlideDocument, elementId: string, deltaX: number, deltaY: number): SlideDocument {
  return {
    ...slide,
    elements: slide.elements.map((element) =>
      element.id === elementId
        ? {
            ...element,
            x: element.x + deltaX,
            y: element.y + deltaY
          }
        : element
    )
  }
}

export function duplicateSlide(slide: SlideDocument, newId: string): SlideDocument {
  return {
    ...structuredClone(slide),
    id: newId,
    title: `${slide.title} Copy`,
    elements: slide.elements.map((element, index) => ({
      ...element,
      id: `${newId}-el-${String(index + 1).padStart(3, '0')}`
    }))
  }
}

export function reorderSlides<T>(slides: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...slides]
  const [item] = copy.splice(fromIndex, 1)
  if (item === undefined) {
    return slides
  }
  copy.splice(toIndex, 0, item)
  return copy
}
