import type { ElementNode, SlideDocument } from './model.js'

export type ClipboardPayload = {
  version: '1.0.0'
  elements: ElementNode[]
}

export type ClipboardPasteOffset = {
  x: number
  y: number
}

export type CreatePastedElementId = (element: ElementNode, index: number) => string

export type PasteClipboardElementsResult = {
  slide: SlideDocument
  pastedElementIds: string[]
}

const defaultPasteOffset: ClipboardPasteOffset = { x: 24, y: 24 }

function cloneElement(element: ElementNode): ElementNode {
  return structuredClone(element)
}

export function copyElementsToClipboard(slide: SlideDocument, elementIds: string[]): ClipboardPayload {
  const selectedIds = new Set(elementIds)
  return {
    version: '1.0.0',
    elements: slide.elements.filter((element) => selectedIds.has(element.id)).map(cloneElement)
  }
}

export function pasteClipboardElements(
  slide: SlideDocument,
  payload: ClipboardPayload,
  createIdFn: CreatePastedElementId,
  offset: ClipboardPasteOffset = defaultPasteOffset
): PasteClipboardElementsResult {
  const pastedElementIds: string[] = []
  const pastedElements = payload.elements.map((element, index) => {
    const clone = cloneElement(element)
    const id = createIdFn(clone, index)
    pastedElementIds.push(id)
    return {
      ...clone,
      id,
      x: clone.x + offset.x,
      y: clone.y + offset.y
    } as ElementNode
  })

  return {
    slide: {
      ...slide,
      elements: [...slide.elements.map(cloneElement), ...pastedElements]
    },
    pastedElementIds
  }
}
