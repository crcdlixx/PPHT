import type { ElementNode, GroupElement, ProjectSlideRef, SlideDocument } from './model.js'

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

function elementBounds(elements: ElementNode[]) {
  const left = Math.min(...elements.map((element) => element.x))
  const top = Math.min(...elements.map((element) => element.y))
  const right = Math.max(...elements.map((element) => element.x + element.width))
  const bottom = Math.max(...elements.map((element) => element.y + element.height))

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  }
}

function relativeElement(element: ElementNode, originX: number, originY: number): ElementNode {
  return {
    ...cloneElement(element),
    x: element.x - originX,
    y: element.y - originY
  } as ElementNode
}

function absoluteElement(element: ElementNode, originX: number, originY: number, zIndex?: number): ElementNode {
  return {
    ...cloneElement(element),
    x: element.x + originX,
    y: element.y + originY,
    zIndex: zIndex ?? element.zIndex
  } as ElementNode
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

export function groupElements(slide: SlideDocument, elementIds: string[], groupId: string): SlideDocument {
  const selectedIds = new Set(elementIds)
  const selected = slide.elements.filter((element) => selectedIds.has(element.id))

  if (selected.length < 2) {
    return structuredClone(slide)
  }

  const bounds = elementBounds(selected)
  const sorted = [...selected].sort((first, second) => first.zIndex - second.zIndex)
  const maxZ = sorted.at(-1)?.zIndex ?? 1
  const group: GroupElement = {
    id: groupId,
    type: 'group',
    ...bounds,
    rotation: 0,
    zIndex: maxZ,
    locked: sorted.every((element) => element.locked),
    visible: sorted.some((element) => element.visible),
    style: {},
    content: {
      elements: sorted.map((element) => relativeElement(element, bounds.x, bounds.y))
    }
  }

  const elements: ElementNode[] = []
  let inserted = false

  for (const element of slide.elements) {
    if (selectedIds.has(element.id)) {
      if (!inserted) {
        elements.push(cloneElement(group))
        inserted = true
      }
      continue
    }

    elements.push(cloneElement(element))
  }

  return {
    ...structuredClone(slide),
    elements
  }
}

export function ungroupElement(slide: SlideDocument, groupId: string): SlideDocument {
  const group = slide.elements.find((element) => element.id === groupId)

  if (group?.type !== 'group') {
    return structuredClone(slide)
  }

  const children = [...group.content.elements]
    .sort((first, second) => first.zIndex - second.zIndex)
  const originalMaxZ = children.at(-1)?.zIndex ?? group.zIndex
  const groupLayerMoved = group.zIndex !== originalMaxZ
  const restoredChildren = children.map((element, index) => absoluteElement(
    element,
    group.x,
    group.y,
    groupLayerMoved ? group.zIndex - children.length + 1 + index : element.zIndex
  ))

  return {
    ...structuredClone(slide),
    elements: slide.elements.flatMap((element) => (element.id === groupId ? restoredChildren : [cloneElement(element)]))
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

export function createSlideRef(id: string, title: string): ProjectSlideRef {
  return {
    id,
    title,
    html: `slides/${id}.html`,
    thumbnail: `thumbs/${id}.svg`
  }
}

export function duplicateSlideRef(slide: ProjectSlideRef, newId: string): ProjectSlideRef {
  return createSlideRef(newId, `${slide.title} Copy`)
}

export function deleteSlideRef(slides: ProjectSlideRef[], slideId: string): ProjectSlideRef[] {
  return slides.filter((slide) => slide.id !== slideId).map((slide) => ({ ...slide }))
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
