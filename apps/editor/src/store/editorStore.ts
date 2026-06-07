import {
  AddElementCommand,
  CommandHistory,
  DeleteElementsCommand,
  UpdateElementsCommand,
  serializeSlideToHtml,
  type ElementNode,
  type ShapeElement,
  createId,
  createImageElement,
  createLineElement,
  createSlide,
  createSlideRef,
  createShapeElement,
  createTextElement,
  deleteSlideRef,
  duplicateSlide,
  duplicateSlideRef,
  type ProjectManifest,
  reorderSlides,
  type SlideCommand,
  type SlideDocument
} from '@ppht/core'
import { create } from 'zustand'
import { type AiSuggestion, projectClient } from '../api/projectClient'

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export type ClipboardPayload = {
  elements: ElementNode[]
}

export type SelectElementOptions = {
  additive?: boolean
}

export type AlignmentMode = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
export type DistributionMode = 'horizontal' | 'vertical'
export type ArrangeMode = 'front' | 'back' | 'forward' | 'backward'
export type ElementStylePatch = Record<string, string | number | boolean>

export type EditorState = {
  projectPath: string
  manifest: ProjectManifest | undefined
  slides: SlideDocument[]
  currentSlideId: string | undefined
  selectedElementIds: string[]
  clipboard: ClipboardPayload | undefined
  isPresenting: boolean
  playbackSlideId: string | undefined
  zoom: number
  saveState: SaveState
  error: string | undefined
  pendingAiSuggestion: AiSuggestion | undefined
  lastAiSuggestion: AiSuggestion | undefined
  aiPending: boolean
  aiError: string | undefined
  history: CommandHistory | undefined
  slideRevisions: Record<string, number>
  manifestRevision: number
  currentSlide: () => SlideDocument | undefined
  playbackSlide: () => SlideDocument | undefined
  createProject: (projectPath: string, title: string) => Promise<void>
  openProject: (projectPath: string) => Promise<void>
  selectSlide: (slideId: string) => void
  startPlayback: () => void
  stopPlayback: () => void
  nextPlaybackSlide: () => void
  previousPlaybackSlide: () => void
  showPlaybackSlide: (slideId: string) => void
  selectElement: (elementId?: string, options?: SelectElementOptions) => void
  selectElements: (elementIds: string[]) => void
  runCommand: (command: SlideCommand) => void
  copySelection: () => void
  pasteClipboard: () => void
  deleteSelection: () => void
  duplicateSelection: () => void
  alignSelection: (mode: AlignmentMode) => void
  distributeSelection: (mode: DistributionMode) => void
  arrangeSelection: (mode: ArrangeMode) => void
  updateSelectedElementStyles: (patch: ElementStylePatch) => void
  addSlide: () => void
  duplicateCurrentSlide: () => void
  deleteCurrentSlide: () => void
  moveCurrentSlide: (direction: -1 | 1) => void
  addText: () => void
  addImage: () => void
  addShape: (shape?: ShapeElement['content']['shape']) => void
  addLine: () => void
  undo: () => void
  redo: () => void
  saveCurrentSlide: () => Promise<void>
  exportDeck: (mode: 'self-contained' | 'clean') => Promise<void>
  importHtmlSlide: (htmlFilePath: string) => Promise<void>
  requestAiSuggestion: (instruction: string) => Promise<void>
  acceptAiSuggestion: () => void
  rejectAiSuggestion: () => void
  rollbackLastAiSuggestion: () => void
}

const PASTE_OFFSET = 24

class AddElementsCommand implements SlideCommand {
  readonly description: string
  private readonly elements: ElementNode[]

  constructor(elements: ElementNode[], description = 'Paste elements') {
    this.elements = structuredClone(elements)
    this.description = description
  }

  execute(slide: SlideDocument): SlideDocument {
    return {
      ...structuredClone(slide),
      elements: [...slide.elements.map((element) => structuredClone(element)), ...structuredClone(this.elements)]
    }
  }

  undo(slide: SlideDocument): SlideDocument {
    const pastedIds = new Set(this.elements.map((element) => element.id))
    return {
      ...structuredClone(slide),
      elements: slide.elements.filter((element) => !pastedIds.has(element.id)).map((element) => structuredClone(element))
    }
  }
}

class ReplaceSlideCommand implements SlideCommand {
  readonly description: string
  private readonly beforeSlide: SlideDocument
  private readonly afterSlide: SlideDocument

  constructor(beforeSlide: SlideDocument, afterSlide: SlideDocument, description = 'Apply AI suggestion') {
    this.beforeSlide = structuredClone(beforeSlide)
    this.afterSlide = structuredClone(afterSlide)
    this.description = description
  }

  execute(_slide: SlideDocument): SlideDocument {
    return structuredClone(this.afterSlide)
  }

  undo(_slide: SlideDocument): SlideDocument {
    return structuredClone(this.beforeSlide)
  }
}

function replaceSlide(slides: SlideDocument[], next: SlideDocument): SlideDocument[] {
  return slides.map((slide) => (slide.id === next.id ? next : slide))
}

function initialSlideRevisions(slides: SlideDocument[]): Record<string, number> {
  return Object.fromEntries(slides.map((slide) => [slide.id, 0]))
}

function bumpSlideRevision(revisions: Record<string, number>, slideId: string): Record<string, number> {
  return {
    ...revisions,
    [slideId]: (revisions[slideId] ?? 0) + 1
  }
}

function setSlideRevision(revisions: Record<string, number>, slideId: string, revision: number): Record<string, number> {
  return {
    ...revisions,
    [slideId]: revision
  }
}

function removeSlideRevision(revisions: Record<string, number>, slideId: string): Record<string, number> {
  const remaining = { ...revisions }
  delete remaining[slideId]
  return remaining
}

function outputPathForExport(projectPath: string, mode: 'self-contained' | 'clean'): string {
  const suffix = mode === 'self-contained' ? '-full.html' : '-clean.html'
  return projectPath.replace(/(?:\.ppht)?$/i, suffix)
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function slidesMatch(left: SlideDocument, right: SlideDocument): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function selectedElements(slide: SlideDocument | undefined, selectedElementIds: string[]): ElementNode[] {
  if (slide === undefined || selectedElementIds.length === 0) {
    return []
  }

  const selectedIds = new Set(selectedElementIds)
  return slide.elements.filter((element) => selectedIds.has(element.id))
}

function selectionBounds(elements: ElementNode[]) {
  const left = Math.min(...elements.map((element) => element.x))
  const top = Math.min(...elements.map((element) => element.y))
  const right = Math.max(...elements.map((element) => element.x + element.width))
  const bottom = Math.max(...elements.map((element) => element.y + element.height))

  return {
    left,
    top,
    right,
    bottom,
    center: left + (right - left) / 2,
    middle: top + (bottom - top) / 2
  }
}

let projectLoadToken = 0
let saveToken = 0

function nextProjectLoadToken(): number {
  projectLoadToken += 1
  return projectLoadToken
}

function isLatestProjectLoad(token: number): boolean {
  return token === projectLoadToken
}

function nextSaveToken(): number {
  saveToken += 1
  return saveToken
}

function isLatestSave(token: number): boolean {
  return token === saveToken
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projectPath: '',
  manifest: undefined,
  slides: [],
  currentSlideId: undefined,
  selectedElementIds: [],
  clipboard: undefined,
  isPresenting: false,
  playbackSlideId: undefined,
  zoom: 1,
  saveState: 'idle',
  error: undefined,
  pendingAiSuggestion: undefined,
  lastAiSuggestion: undefined,
  aiPending: false,
  aiError: undefined,
  history: undefined,
  slideRevisions: {},
  manifestRevision: 0,

  currentSlide: () => get().slides.find((slide) => slide.id === get().currentSlideId),
  playbackSlide: () => get().slides.find((slide) => slide.id === get().playbackSlideId),

  async createProject(projectPath, title) {
    const token = nextProjectLoadToken()
    set({ saveState: 'saving', error: undefined })

    try {
      const result = await projectClient.createProject(projectPath, title)

      if (!isLatestProjectLoad(token)) {
        return
      }

      const first = result.slides[0]
      set({
        projectPath: result.projectPath || projectPath,
        manifest: result.manifest,
        slides: result.slides,
        currentSlideId: first?.id,
        selectedElementIds: [],
        clipboard: undefined,
        isPresenting: false,
        playbackSlideId: undefined,
        history: first ? new CommandHistory(first) : undefined,
        slideRevisions: initialSlideRevisions(result.slides),
        manifestRevision: 0,
        saveState: 'saved',
        error: undefined,
        pendingAiSuggestion: undefined,
        lastAiSuggestion: undefined,
        aiPending: false,
        aiError: undefined
      })
    } catch (error) {
      if (isLatestProjectLoad(token)) {
        set({ saveState: 'error', error: getErrorMessage(error, 'Create project failed') })
      }
    }
  },

  async openProject(projectPath) {
    const token = nextProjectLoadToken()
    set({ saveState: 'saving', error: undefined })

    try {
      const result = await projectClient.openProject(projectPath)

      if (!isLatestProjectLoad(token)) {
        return
      }

      const first = result.slides[0]
      set({
        projectPath: result.projectPath || projectPath,
        manifest: result.manifest,
        slides: result.slides,
        currentSlideId: first?.id,
        selectedElementIds: [],
        clipboard: undefined,
        isPresenting: false,
        playbackSlideId: undefined,
        history: first ? new CommandHistory(first) : undefined,
        slideRevisions: initialSlideRevisions(result.slides),
        manifestRevision: 0,
        saveState: 'saved',
        error: undefined,
        pendingAiSuggestion: undefined,
        lastAiSuggestion: undefined,
        aiPending: false,
        aiError: undefined
      })
    } catch (error) {
      if (isLatestProjectLoad(token)) {
        set({ saveState: 'error', error: getErrorMessage(error, 'Open project failed') })
      }
    }
  },

  selectSlide(slideId) {
    const slide = get().slides.find((item) => item.id === slideId)

    if (slide === undefined) {
      return
    }

    set({
      currentSlideId: slide.id,
      selectedElementIds: [],
      history: new CommandHistory(slide)
    })
  },

  startPlayback() {
    const slides = get().slides

    if (slides.length === 0) {
      return
    }

    const selectedSlide = slides.find((slide) => slide.id === get().currentSlideId) ?? slides[0]
    set({
      isPresenting: true,
      playbackSlideId: selectedSlide?.id,
      selectedElementIds: []
    })
  },

  stopPlayback() {
    set({
      isPresenting: false,
      playbackSlideId: undefined
    })
  },

  nextPlaybackSlide() {
    const slides = get().slides
    const currentIndex = slides.findIndex((slide) => slide.id === get().playbackSlideId)

    if (slides.length === 0 || currentIndex === -1) {
      return
    }

    const nextIndex = Math.min(slides.length - 1, currentIndex + 1)
    set({ playbackSlideId: slides[nextIndex]?.id })
  },

  previousPlaybackSlide() {
    const slides = get().slides
    const currentIndex = slides.findIndex((slide) => slide.id === get().playbackSlideId)

    if (slides.length === 0 || currentIndex === -1) {
      return
    }

    const nextIndex = Math.max(0, currentIndex - 1)
    set({ playbackSlideId: slides[nextIndex]?.id })
  },

  showPlaybackSlide(slideId) {
    const slide = get().slides.find((item) => item.id === slideId)

    if (slide === undefined) {
      return
    }

    set({ playbackSlideId: slide.id })
  },

  selectElement(elementId, options = {}) {
    if (!elementId) {
      set({ selectedElementIds: [] })
      return
    }

    const currentSlide = get().currentSlide()
    const elementExists = currentSlide?.elements.some((element) => element.id === elementId) ?? false

    if (!elementExists) {
      return
    }

    if (options.additive) {
      const selected = get().selectedElementIds
      set({
        selectedElementIds: selected.includes(elementId)
          ? selected.filter((selectedId) => selectedId !== elementId)
          : [...selected, elementId]
      })
      return
    }

    set({ selectedElementIds: [elementId] })
  },

  selectElements(elementIds) {
    const currentSlide = get().currentSlide()

    if (currentSlide === undefined || elementIds.length === 0) {
      set({ selectedElementIds: [] })
      return
    }

    const validIds = new Set(currentSlide.elements.map((element) => element.id))
    set({ selectedElementIds: elementIds.filter((elementId) => validIds.has(elementId)) })
  },

  runCommand(command) {
    const history = get().history

    if (history === undefined) {
      return
    }

    const next = history.run(command)
    set({
      slides: replaceSlide(get().slides, next),
      slideRevisions: bumpSlideRevision(get().slideRevisions, next.id),
      saveState: 'dirty',
      error: undefined
    })
  },

  copySelection() {
    const current = get().currentSlide()
    const selectedIds = new Set(get().selectedElementIds)

    if (current === undefined || selectedIds.size === 0) {
      return
    }

    const elements = current.elements.filter((element) => selectedIds.has(element.id)).map((element) => structuredClone(element))

    if (elements.length === 0) {
      return
    }

    set({ clipboard: { elements } })
  },

  pasteClipboard() {
    const current = get().currentSlide()
    const clipboard = get().clipboard

    if (current === undefined || clipboard === undefined || clipboard.elements.length === 0) {
      return
    }

    const pasted = clipboard.elements.map((element) => ({
      ...structuredClone(element),
      id: createId(element.type),
      x: element.x + PASTE_OFFSET,
      y: element.y + PASTE_OFFSET
    }))

    get().runCommand(new AddElementsCommand(pasted))
    set({ selectedElementIds: pasted.map((element) => element.id) })
  },

  deleteSelection() {
    const selectedIds = get().selectedElementIds

    if (selectedIds.length === 0) {
      return
    }

    get().runCommand(new DeleteElementsCommand(selectedIds))
    set({ selectedElementIds: [] })
  },

  duplicateSelection() {
    const current = get().currentSlide()
    const selectedIds = new Set(get().selectedElementIds)

    if (current === undefined || selectedIds.size === 0) {
      return
    }

    const duplicated = current.elements
      .filter((element) => selectedIds.has(element.id))
      .map((element) => ({
        ...structuredClone(element),
        id: createId(element.type),
        x: element.x + PASTE_OFFSET,
        y: element.y + PASTE_OFFSET
      }))

    if (duplicated.length === 0) {
      return
    }

    get().runCommand(new AddElementsCommand(duplicated, 'Duplicate selected elements'))
    set({ selectedElementIds: duplicated.map((element) => element.id) })
  },

  alignSelection(mode) {
    const elements = selectedElements(get().currentSlide(), get().selectedElementIds)

    if (elements.length < 2) {
      return
    }

    const bounds = selectionBounds(elements)
    const instructions = elements.map((element) => {
      switch (mode) {
        case 'left':
          return { elementId: element.id, patch: { x: bounds.left } }
        case 'center':
          return { elementId: element.id, patch: { x: Math.round(bounds.center - element.width / 2) } }
        case 'right':
          return { elementId: element.id, patch: { x: bounds.right - element.width } }
        case 'top':
          return { elementId: element.id, patch: { y: bounds.top } }
        case 'middle':
          return { elementId: element.id, patch: { y: Math.round(bounds.middle - element.height / 2) } }
        case 'bottom':
          return { elementId: element.id, patch: { y: bounds.bottom - element.height } }
      }
    })

    get().runCommand(new UpdateElementsCommand(instructions, `Align ${mode}`))
  },

  distributeSelection(mode) {
    const elements = selectedElements(get().currentSlide(), get().selectedElementIds)

    if (elements.length < 3) {
      return
    }

    const sorted = [...elements].sort((first, second) => (mode === 'horizontal' ? first.x - second.x : first.y - second.y))
    const first = sorted[0]!
    const last = sorted.at(-1)!
    const start = mode === 'horizontal' ? first.x : first.y
    const end = mode === 'horizontal' ? last.x + last.width : last.y + last.height
    const totalSize = sorted.reduce((sum, element) => sum + (mode === 'horizontal' ? element.width : element.height), 0)
    const gap = (end - start - totalSize) / (sorted.length - 1)
    let cursor = start
    const instructions = sorted.map((element) => {
      const patch = mode === 'horizontal' ? { x: Math.round(cursor) } : { y: Math.round(cursor) }
      cursor += (mode === 'horizontal' ? element.width : element.height) + gap
      return {
        elementId: element.id,
        patch
      }
    })

    get().runCommand(new UpdateElementsCommand(instructions, `Distribute ${mode}`))
  },

  arrangeSelection(mode) {
    const current = get().currentSlide()
    const elements = selectedElements(current, get().selectedElementIds)

    if (current === undefined || elements.length === 0) {
      return
    }

    const selectedIds = new Set(elements.map((element) => element.id))
    const maxZ = current.elements.reduce((max, element) => Math.max(max, element.zIndex), 0)
    const minZ = current.elements.reduce((min, element) => Math.min(min, element.zIndex), Number.POSITIVE_INFINITY)
    const sorted = [...elements].sort((first, second) => first.zIndex - second.zIndex)
    const instructions = sorted.map((element, index) => {
      switch (mode) {
        case 'front':
          return { elementId: element.id, patch: { zIndex: maxZ + index + 1 } }
        case 'back':
          return { elementId: element.id, patch: { zIndex: minZ - sorted.length + index } }
        case 'forward':
          return { elementId: element.id, patch: { zIndex: element.zIndex + 1 } }
        case 'backward':
          return { elementId: element.id, patch: { zIndex: element.zIndex - 1 } }
      }
    })

    if (mode === 'forward' || mode === 'backward') {
      const stack = [...current.elements].sort((first, second) => first.zIndex - second.zIndex)
      const movedStack = [...stack]

      if (mode === 'forward') {
        for (let index = movedStack.length - 2; index >= 0; index -= 1) {
          const element = movedStack[index]!
          const nextElement = movedStack[index + 1]!
          if (selectedIds.has(element.id) && !selectedIds.has(nextElement.id)) {
            movedStack[index] = nextElement
            movedStack[index + 1] = element
          }
        }
      } else {
        for (let index = 1; index < movedStack.length; index += 1) {
          const element = movedStack[index]!
          const previousElement = movedStack[index - 1]!
          if (selectedIds.has(element.id) && !selectedIds.has(previousElement.id)) {
            movedStack[index] = previousElement
            movedStack[index - 1] = element
          }
        }
      }

      const adjusted = movedStack.map((element, index) => ({
        elementId: element.id,
        patch: { zIndex: stack[index]!.zIndex }
      }))
      get().runCommand(new UpdateElementsCommand(adjusted, `Arrange ${mode}`))
      return
    }

    get().runCommand(new UpdateElementsCommand(instructions, `Arrange ${mode}`))
  },

  updateSelectedElementStyles(patch) {
    const elements = selectedElements(get().currentSlide(), get().selectedElementIds)

    if (elements.length === 0) {
      return
    }

    get().runCommand(new UpdateElementsCommand(
      elements.map((element) => ({
        elementId: element.id,
        patch: {
          style: {
            ...element.style,
            ...patch
          }
        }
      })),
      'Update selected styles'
    ))
  },

  addSlide() {
    const manifest = get().manifest

    if (manifest === undefined) {
      return
    }

    const id = createId('slide')
    const slide = createSlide(id, `Slide ${get().slides.length + 1}`)
    const ref = createSlideRef(id, slide.title)

    set({
      manifest: { ...manifest, slides: [...manifest.slides, ref] },
      slides: [...get().slides, slide],
      currentSlideId: slide.id,
      selectedElementIds: [],
      history: new CommandHistory(slide),
      slideRevisions: setSlideRevision(get().slideRevisions, slide.id, 1),
      manifestRevision: get().manifestRevision + 1,
      saveState: 'dirty',
      error: undefined
    })
  },

  duplicateCurrentSlide() {
    const manifest = get().manifest
    const current = get().currentSlide()

    if (manifest === undefined || current === undefined) {
      return
    }

    const id = createId('slide')
    const duplicate = duplicateSlide(current, id)
    const currentIndex = get().slides.findIndex((slide) => slide.id === current.id)
    const insertIndex = currentIndex === -1 ? get().slides.length : currentIndex + 1
    const sourceRef = manifest.slides.find((slide) => slide.id === current.id) ?? createSlideRef(current.id, current.title)
    const duplicateRef = duplicateSlideRef(sourceRef, id)
    const nextSlides = [...get().slides]
    const nextRefs = [...manifest.slides]
    nextSlides.splice(insertIndex, 0, duplicate)
    nextRefs.splice(insertIndex, 0, duplicateRef)

    set({
      manifest: { ...manifest, slides: nextRefs },
      slides: nextSlides,
      currentSlideId: duplicate.id,
      selectedElementIds: [],
      history: new CommandHistory(duplicate),
      slideRevisions: setSlideRevision(get().slideRevisions, duplicate.id, 1),
      manifestRevision: get().manifestRevision + 1,
      saveState: 'dirty',
      error: undefined
    })
  },

  deleteCurrentSlide() {
    const manifest = get().manifest
    const currentSlideId = get().currentSlideId

    if (manifest === undefined || currentSlideId === undefined || get().slides.length <= 1) {
      return
    }

    const currentIndex = get().slides.findIndex((slide) => slide.id === currentSlideId)

    if (currentIndex === -1) {
      return
    }

    const nextSlides = get().slides.filter((slide) => slide.id !== currentSlideId)
    const nextCurrent = nextSlides[Math.min(currentIndex, nextSlides.length - 1)]

    set({
      manifest: { ...manifest, slides: deleteSlideRef(manifest.slides, currentSlideId) },
      slides: nextSlides,
      currentSlideId: nextCurrent?.id,
      selectedElementIds: [],
      history: nextCurrent ? new CommandHistory(nextCurrent) : undefined,
      slideRevisions: removeSlideRevision(get().slideRevisions, currentSlideId),
      manifestRevision: get().manifestRevision + 1,
      saveState: 'dirty',
      error: undefined
    })
  },

  moveCurrentSlide(direction) {
    const manifest = get().manifest
    const currentSlideId = get().currentSlideId

    if (manifest === undefined || currentSlideId === undefined) {
      return
    }

    const fromIndex = get().slides.findIndex((slide) => slide.id === currentSlideId)
    const toIndex = fromIndex + direction

    if (fromIndex === -1 || toIndex < 0 || toIndex >= get().slides.length) {
      return
    }

    set({
      manifest: { ...manifest, slides: reorderSlides(manifest.slides, fromIndex, toIndex) },
      slides: reorderSlides(get().slides, fromIndex, toIndex),
      currentSlideId,
      manifestRevision: get().manifestRevision + 1,
      saveState: 'dirty',
      error: undefined
    })
  },

  addText() {
    const element = createTextElement(createId('text'), { x: 160, y: 160, width: 420, height: 110 }, 'Text')
    get().runCommand(new AddElementCommand(element))
    set({ selectedElementIds: [element.id] })
  },

  addImage() {
    const svg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">',
      '<rect width="320" height="180" fill="#e5e7eb"/>',
      '<path d="M40 135 105 80l48 40 35-30 72 45H40Z" fill="#94a3b8"/>',
      '<circle cx="236" cy="54" r="22" fill="#f8fafc"/>',
      '<text x="160" y="160" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#475569">Image</text>',
      '</svg>'
    ].join('')
    const src = `data:image/svg+xml;base64,${btoa(svg)}`
    const element = createImageElement(createId('image'), { x: 180, y: 150, width: 320, height: 180 }, src, 'Placeholder image')
    get().runCommand(new AddElementCommand(element))
    set({ selectedElementIds: [element.id] })
  },

  addShape(shape = 'rectangle') {
    const element = createShapeElement(createId('shape'), { x: 220, y: 170, width: 220, height: 140 }, shape)
    get().runCommand(new AddElementCommand(element))
    set({ selectedElementIds: [element.id] })
  },

  addLine() {
    const element = createLineElement(createId('line'), { x: 220, y: 240, width: 300, height: 80 })
    get().runCommand(new AddElementCommand(element))
    set({ selectedElementIds: [element.id] })
  },

  undo() {
    const history = get().history

    if (history === undefined || !history.canUndo) {
      return
    }

    const next = history.undo()
    set({
      slides: replaceSlide(get().slides, next),
      slideRevisions: bumpSlideRevision(get().slideRevisions, next.id),
      saveState: 'dirty',
      error: undefined
    })
  },

  redo() {
    const history = get().history

    if (history === undefined || !history.canRedo) {
      return
    }

    const next = history.redo()
    set({
      slides: replaceSlide(get().slides, next),
      slideRevisions: bumpSlideRevision(get().slideRevisions, next.id),
      saveState: 'dirty',
      error: undefined
    })
  },

  async saveCurrentSlide() {
    const manifest = get().manifest
    const slides = get().slides
    const projectPath = get().projectPath

    if (manifest === undefined || slides.length === 0 || projectPath.length === 0) {
      return
    }

    const snapshotSlides = slides.map((slide) => structuredClone(slide))
    const snapshotManifest = structuredClone(manifest)
    const revisions = { ...get().slideRevisions }
    const manifestRevision = get().manifestRevision
    const token = nextSaveToken()
    set({ saveState: 'saving', error: undefined })

    try {
      const savedManifest = await projectClient.saveProject(projectPath, snapshotManifest)
      const savedSlides: SlideDocument[] = []

      for (const slide of snapshotSlides) {
        savedSlides.push(await projectClient.saveSlide(projectPath, slide))
      }

      const sameProject = get().projectPath === projectPath
      const latestSave = isLatestSave(token)
      const currentSaveState = get().saveState
      const sameManifestRevision = get().manifestRevision === manifestRevision
      const allSlideRevisionsMatch = snapshotSlides.every((slide) => (get().slideRevisions[slide.id] ?? 0) === (revisions[slide.id] ?? 0))
      const savedSlideIdsMatch = savedSlides.every((slide, index) => slide.id === snapshotSlides[index]?.id)

      if (!sameProject || !savedSlideIdsMatch || !sameManifestRevision || !allSlideRevisionsMatch) {
        if (sameProject && latestSave && currentSaveState === 'saving') {
          set({ saveState: 'dirty' })
        }
        return
      }

      const nextSaveState = latestSave && currentSaveState === 'saving' ? 'saved' : currentSaveState
      set({
        manifest: savedManifest,
        slides: savedSlides.reduce((nextSlides, savedSlide) => replaceSlide(nextSlides, savedSlide), get().slides),
        saveState: nextSaveState,
        error: undefined
      })
    } catch (error) {
      if (get().projectPath === projectPath && isLatestSave(token)) {
        set({ saveState: 'error', error: getErrorMessage(error, 'Save failed') })
      }
    }
  },

  async exportDeck(mode) {
    const projectPath = get().projectPath

    if (projectPath.length === 0) {
      return
    }

    await get().saveCurrentSlide()

    if (get().projectPath !== projectPath || get().saveState !== 'saved') {
      return
    }

    const token = nextSaveToken()
    set({ saveState: 'saving', error: undefined })

    try {
      await projectClient.exportDeck(projectPath, outputPathForExport(projectPath, mode), mode)

      if (get().projectPath === projectPath && isLatestSave(token)) {
        const currentSaveState = get().saveState
        set({
          saveState: currentSaveState === 'saving' ? 'saved' : currentSaveState,
          error: undefined
        })
      }
    } catch (error) {
      if (get().projectPath === projectPath && isLatestSave(token)) {
        set({ saveState: 'error', error: getErrorMessage(error, 'Export failed') })
      }
    }
  },

  async importHtmlSlide(htmlFilePath) {
    const projectPath = get().projectPath

    if (projectPath.length === 0 || htmlFilePath.trim().length === 0) {
      return
    }

    set({ saveState: 'saving', error: undefined })

    try {
      const result = await projectClient.importHtmlSlide(projectPath, htmlFilePath)
      const slides = result.slides
      const importedSlide = slides.at(-1)

      set({
        projectPath: result.projectPath || projectPath,
        manifest: result.manifest,
        slides,
        currentSlideId: importedSlide?.id,
        selectedElementIds: [],
        isPresenting: false,
        playbackSlideId: undefined,
        history: importedSlide ? new CommandHistory(importedSlide) : undefined,
        slideRevisions: initialSlideRevisions(slides),
        manifestRevision: 0,
        saveState: 'saved',
        error: undefined,
        pendingAiSuggestion: undefined,
        lastAiSuggestion: undefined,
        aiPending: false,
        aiError: undefined
      })
    } catch (error) {
      set({ saveState: 'error', error: getErrorMessage(error, 'Import HTML failed') })
    }
  },

  async requestAiSuggestion(instruction) {
    const trimmedInstruction = instruction.trim()
    const projectPath = get().projectPath
    const manifest = get().manifest
    const slide = get().currentSlide()

    if (trimmedInstruction.length === 0 || manifest === undefined || slide === undefined) {
      return
    }

    set({ aiPending: true, aiError: undefined, pendingAiSuggestion: undefined })

    try {
      const suggestion = await projectClient.suggestAiEdit({
        projectPath,
        manifest,
        slide,
        slideHtml: serializeSlideToHtml(slide),
        instruction: trimmedInstruction
      })

      if (get().currentSlideId !== slide.id) {
        set({
          aiPending: false,
          aiError: undefined
        })
        return
      }

      set({
        pendingAiSuggestion: suggestion,
        aiPending: false,
        aiError: undefined
      })
    } catch (error) {
      set({
        aiPending: false,
        aiError: getErrorMessage(error, 'AI suggestion failed')
      })
    }
  },

  acceptAiSuggestion() {
    const suggestion = get().pendingAiSuggestion
    const current = get().currentSlide()

    if (suggestion === undefined || current === undefined || current.id !== suggestion.beforeSlide.id) {
      return
    }

    if (!slidesMatch(current, suggestion.beforeSlide)) {
      set({
        pendingAiSuggestion: undefined,
        aiPending: false,
        aiError: 'AI suggestion is out of date'
      })
      return
    }

    get().runCommand(new ReplaceSlideCommand(current, suggestion.afterSlide))
    set({
      pendingAiSuggestion: undefined,
      lastAiSuggestion: suggestion,
      selectedElementIds: suggestion.changedElementIds,
      aiError: undefined
    })
  },

  rejectAiSuggestion() {
    set({
      pendingAiSuggestion: undefined,
      aiPending: false,
      aiError: undefined
    })
  },

  rollbackLastAiSuggestion() {
    const suggestion = get().lastAiSuggestion
    const current = get().currentSlide()
    const history = get().history

    if (suggestion === undefined || current === undefined || history === undefined || !history.canUndo) {
      return
    }

    if (JSON.stringify(current) !== JSON.stringify(suggestion.afterSlide)) {
      set({ aiError: 'Cannot rollback after later edits' })
      return
    }

    get().undo()
    set({
      lastAiSuggestion: undefined,
      selectedElementIds: [],
      aiError: undefined
    })
  }
}))
