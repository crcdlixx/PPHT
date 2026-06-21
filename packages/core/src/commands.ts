import { addElement, deleteElement, groupElements, ungroupElement, updateElement, type ElementUpdatePatch } from './documentOps.js'
import type { ElementNode, SlideDocument } from './model.js'

export type SlideCommand = {
  description: string
  execute(slide: SlideDocument): SlideDocument
  undo(slide: SlideDocument): SlideDocument
}

function cloneElement(element: ElementNode): ElementNode {
  return structuredClone(element)
}

function clonePatch(patch: ElementUpdatePatch): ElementUpdatePatch {
  return structuredClone(patch)
}

function cloneSlide(slide: SlideDocument): SlideDocument {
  return structuredClone(slide)
}

function restoreElement(slide: SlideDocument, element: ElementNode, index: number): SlideDocument {
  const elements = slide.elements.map(cloneElement)
  const safeIndex = Math.max(0, Math.min(index, elements.length))
  elements.splice(safeIndex, 0, cloneElement(element))

  return {
    ...cloneSlide(slide),
    elements
  }
}

function elementToPatch(element: ElementNode): ElementUpdatePatch {
  const { id: _id, type: _type, ...patch } = cloneElement(element)
  return patch
}

export class AddElementCommand implements SlideCommand {
  readonly description: string
  private readonly element: ElementNode

  constructor(element: ElementNode, description = `Add ${element.type} element`) {
    this.element = cloneElement(element)
    this.description = description
  }

  execute(slide: SlideDocument): SlideDocument {
    return addElement(slide, this.element)
  }

  undo(slide: SlideDocument): SlideDocument {
    return deleteElement(slide, this.element.id)
  }
}

export class UpdateElementCommand implements SlideCommand {
  readonly description: string
  private previousElement: ElementNode | undefined
  private readonly patch: ElementUpdatePatch

  constructor(
    private readonly elementId: string,
    patch: ElementUpdatePatch,
    description = `Update element ${elementId}`
  ) {
    this.patch = clonePatch(patch)
    this.description = description
  }

  execute(slide: SlideDocument): SlideDocument {
    const current = slide.elements.find((element) => element.id === this.elementId)
    if (current !== undefined && this.previousElement === undefined) {
      this.previousElement = cloneElement(current)
    }

    return updateElement(slide, this.elementId, this.patch)
  }

  undo(slide: SlideDocument): SlideDocument {
    if (this.previousElement === undefined) {
      return cloneSlide(slide)
    }

    return updateElement(slide, this.elementId, elementToPatch(this.previousElement))
  }
}

export type ElementPatchInstruction = {
  elementId: string
  patch: ElementUpdatePatch
}

export class UpdateElementsCommand implements SlideCommand {
  readonly description: string
  private readonly instructions: ElementPatchInstruction[]
  private previousElements: ElementNode[] | undefined

  constructor(instructions: ElementPatchInstruction[], description = 'Update selected elements') {
    this.instructions = instructions.map((instruction) => ({
      elementId: instruction.elementId,
      patch: clonePatch(instruction.patch)
    }))
    this.description = description
  }

  execute(slide: SlideDocument): SlideDocument {
    if (this.previousElements === undefined) {
      const updateIds = new Set(this.instructions.map((instruction) => instruction.elementId))
      this.previousElements = slide.elements.filter((element) => updateIds.has(element.id)).map(cloneElement)
    }

    return this.instructions.reduce(
      (nextSlide, instruction) => updateElement(nextSlide, instruction.elementId, instruction.patch),
      cloneSlide(slide)
    )
  }

  undo(slide: SlideDocument): SlideDocument {
    if (this.previousElements === undefined) {
      return cloneSlide(slide)
    }

    return this.previousElements.reduce(
      (nextSlide, element) => updateElement(nextSlide, element.id, elementToPatch(element)),
      cloneSlide(slide)
    )
  }
}

export class DeleteElementCommand implements SlideCommand {
  readonly description: string
  private deletedElement: ElementNode | undefined
  private deletedIndex = -1

  constructor(
    private readonly elementId: string,
    description = `Delete element ${elementId}`
  ) {
    this.description = description
  }

  execute(slide: SlideDocument): SlideDocument {
    const index = slide.elements.findIndex((element) => element.id === this.elementId)
    if (index >= 0 && this.deletedElement === undefined) {
      this.deletedElement = cloneElement(slide.elements[index]!)
      this.deletedIndex = index
    }

    return deleteElement(slide, this.elementId)
  }

  undo(slide: SlideDocument): SlideDocument {
    if (this.deletedElement === undefined) {
      return cloneSlide(slide)
    }

    return restoreElement(slide, this.deletedElement, this.deletedIndex)
  }
}

export class DeleteElementsCommand implements SlideCommand {
  readonly description: string
  private deletedElements: Array<{ element: ElementNode; index: number }> | undefined
  private readonly elementIds: string[]

  constructor(elementIds: string[], description = 'Delete selected elements') {
    this.elementIds = [...elementIds]
    this.description = description
  }

  execute(slide: SlideDocument): SlideDocument {
    if (this.deletedElements === undefined) {
      const deleteIds = new Set(this.elementIds)
      this.deletedElements = slide.elements
        .map((element, index) => ({ element, index }))
        .filter(({ element }) => deleteIds.has(element.id))
        .map(({ element, index }) => ({ element: cloneElement(element), index }))
    }

    const deleteIds = new Set(this.elementIds)
    return {
      ...cloneSlide(slide),
      elements: slide.elements.filter((element) => !deleteIds.has(element.id)).map(cloneElement)
    }
  }

  undo(slide: SlideDocument): SlideDocument {
    if (this.deletedElements === undefined) {
      return cloneSlide(slide)
    }

    return this.deletedElements.reduce(
      (nextSlide, deleted) => restoreElement(nextSlide, deleted.element, deleted.index),
      cloneSlide(slide)
    )
  }
}

export class GroupElementsCommand implements SlideCommand {
  readonly description: string
  private beforeSlide: SlideDocument | undefined
  private afterSlide: SlideDocument | undefined
  private readonly elementIds: string[]

  constructor(elementIds: string[], private readonly groupId: string, description = 'Group selected elements') {
    this.elementIds = [...elementIds]
    this.description = description
  }

  execute(slide: SlideDocument): SlideDocument {
    if (this.beforeSlide === undefined || this.afterSlide === undefined) {
      this.beforeSlide = cloneSlide(slide)
      this.afterSlide = groupElements(slide, this.elementIds, this.groupId)
    }

    return cloneSlide(this.afterSlide)
  }

  undo(slide: SlideDocument): SlideDocument {
    if (this.beforeSlide === undefined) {
      return cloneSlide(slide)
    }

    return cloneSlide(this.beforeSlide)
  }
}

export class UngroupElementCommand implements SlideCommand {
  readonly description: string
  private beforeSlide: SlideDocument | undefined
  private afterSlide: SlideDocument | undefined

  constructor(private readonly groupId: string, description = 'Ungroup selected group') {
    this.description = description
  }

  execute(slide: SlideDocument): SlideDocument {
    if (this.beforeSlide === undefined || this.afterSlide === undefined) {
      this.beforeSlide = cloneSlide(slide)
      this.afterSlide = ungroupElement(slide, this.groupId)
    }

    return cloneSlide(this.afterSlide)
  }

  undo(slide: SlideDocument): SlideDocument {
    if (this.beforeSlide === undefined) {
      return cloneSlide(slide)
    }

    return cloneSlide(this.beforeSlide)
  }
}

export class CommandHistory {
  private undoStack: SlideCommand[] = []
  private redoStack: SlideCommand[] = []
  private currentSlide: SlideDocument

  constructor(initialSlide: SlideDocument) {
    this.currentSlide = cloneSlide(initialSlide)
  }

  get current(): SlideDocument {
    return cloneSlide(this.currentSlide)
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0
  }

  run(command: SlideCommand): SlideDocument {
    this.currentSlide = cloneSlide(command.execute(cloneSlide(this.currentSlide)))
    this.undoStack = [...this.undoStack, command]
    this.redoStack = []
    return this.current
  }

  undo(): SlideDocument {
    const command = this.undoStack.at(-1)
    if (command === undefined) {
      return this.current
    }

    this.currentSlide = cloneSlide(command.undo(cloneSlide(this.currentSlide)))
    this.undoStack = this.undoStack.slice(0, -1)
    this.redoStack = [...this.redoStack, command]
    return this.current
  }

  redo(): SlideDocument {
    const command = this.redoStack.at(-1)
    if (command === undefined) {
      return this.current
    }

    this.currentSlide = cloneSlide(command.execute(cloneSlide(this.currentSlide)))
    this.redoStack = this.redoStack.slice(0, -1)
    this.undoStack = [...this.undoStack, command]
    return this.current
  }
}
