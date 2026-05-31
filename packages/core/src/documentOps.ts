import type { ElementNode, SlideDocument } from './model.js'

export type ElementUpdatePatch = Partial<Omit<ElementNode, 'id' | 'type' | 'content'>>

function applyElementPatch(element: ElementNode, patch: ElementUpdatePatch): ElementNode {
  switch (element.type) {
    case 'text':
      return { ...element, ...patch }
    case 'image':
      return { ...element, ...patch }
    case 'shape':
      return { ...element, ...patch }
    case 'line':
      return { ...element, ...patch }
  }
}

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
  patch: ElementUpdatePatch
): SlideDocument {
  return {
    ...slide,
    elements: slide.elements.map((element) => (element.id === elementId ? applyElementPatch(element, patch) : element))
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
    elements: slide.elements.map((element, index) => {
      const clone = structuredClone(element)
      return {
        ...clone,
        id: `${newId}-el-${String(index + 1).padStart(3, '0')}`
      }
    })
  }
}

export function reorderSlides<T>(slides: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= slides.length || toIndex < 0 || toIndex >= slides.length) {
    return slides
  }

  const copy = [...slides]
  const [item] = copy.splice(fromIndex, 1)
  if (item === undefined) {
    return slides
  }
  copy.splice(toIndex, 0, item)
  return copy
}
