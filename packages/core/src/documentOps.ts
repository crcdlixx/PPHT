import type { ElementNode, SlideDocument } from './model.js'

export type ElementUpdatePatch = Partial<Omit<ElementNode, 'id' | 'type'>>

function cloneElement(element: ElementNode): ElementNode {
  return structuredClone(element)
}

function clonePatchValue<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    return structuredClone(value)
  }

  return value
}

function cloneElementPatch(patch: ElementUpdatePatch): ElementUpdatePatch {
  return Object.fromEntries(Object.entries(patch).map(([key, value]) => [key, clonePatchValue(value)])) as ElementUpdatePatch
}

function applyElementPatch(element: ElementNode, patch: ElementUpdatePatch): ElementNode {
  const clone = cloneElement(element)
  const clonedPatch = cloneElementPatch(patch)
  return { ...clone, ...clonedPatch, id: element.id, type: element.type } as ElementNode
}

export function addElement(slide: SlideDocument, element: ElementNode): SlideDocument {
  const maxZ = slide.elements.reduce((max, item) => Math.max(max, item.zIndex), 0)
  return {
    ...slide,
    elements: [...slide.elements.map(cloneElement), { ...cloneElement(element), zIndex: maxZ + 1 }]
  }
}

export function updateElement(
  slide: SlideDocument,
  elementId: string,
  patch: ElementUpdatePatch
): SlideDocument {
  return {
    ...slide,
    elements: slide.elements.map((element) => (element.id === elementId ? applyElementPatch(element, patch) : cloneElement(element)))
  }
}

export function deleteElement(slide: SlideDocument, elementId: string): SlideDocument {
  return {
    ...slide,
    elements: slide.elements.filter((element) => element.id !== elementId).map(cloneElement)
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
        : cloneElement(element)
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
