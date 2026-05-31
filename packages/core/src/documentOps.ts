import type { ElementNode, SlideDocument } from './model.js'

export type ElementUpdatePatch = Partial<Omit<ElementNode, 'id' | 'type' | 'content'>>

function cloneElement(element: ElementNode): ElementNode {
  return structuredClone(element)
}

function applyElementPatch(element: ElementNode, patch: ElementUpdatePatch): ElementNode {
  const clone = cloneElement(element)

  switch (element.type) {
    case 'text':
      return { ...clone, ...patch }
    case 'image':
      return { ...clone, ...patch }
    case 'shape':
      return { ...clone, ...patch }
    case 'line':
      return { ...clone, ...patch }
  }
}

export function addElement(slide: SlideDocument, element: ElementNode): SlideDocument {
  const maxZ = slide.elements.reduce((max, item) => Math.max(max, item.zIndex), 0)
  return {
    ...slide,
    elements: [...slide.elements, { ...cloneElement(element), zIndex: maxZ + 1 }]
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
            ...cloneElement(element),
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
      const clone = cloneElement(element)
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
