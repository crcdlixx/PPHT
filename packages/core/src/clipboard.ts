import type { ElementNode, SlideDocument } from './model.js'

export type ClipboardPayload = {
  version: '1.0.0'
  elements: ElementNode[]
}

export type ClipboardPasteOffset = {
  x: number
  y: number
}

export type CreatePastedElementId = (element: ElementNode, index: number, parentId?: string) => string

export type PasteClipboardElementsResult = {
  slide: SlideDocument
  pastedElementIds: string[]
}

const defaultPasteOffset: ClipboardPasteOffset = { x: 24, y: 24 }

function cloneElement(element: ElementNode): ElementNode {
  return structuredClone(element)
}

function cloneElementForPaste(
  element: ElementNode,
  index: number,
  createIdFn: CreatePastedElementId,
  parentId?: string
): ElementNode {
  const clone = cloneElement(element)
  const id = createIdFn(clone, index, parentId)

  if (clone.type === 'group') {
    return {
      ...clone,
      id,
      content: {
        elements: clone.content.elements.map((child, childIndex) => cloneElementForPaste(child, childIndex, createIdFn, id))
      }
    }
  }

  if (clone.type === 'image') {
    return {
      ...clone,
      id,
      content: {
        ...clone.content,
        assetId: id
      }
    }
  }

  return {
    ...clone,
    id
  } as ElementNode
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
    const pasted = cloneElementForPaste(element, index, createIdFn)
    pastedElementIds.push(pasted.id)
    return {
      ...pasted,
      x: pasted.x + offset.x,
      y: pasted.y + offset.y
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
