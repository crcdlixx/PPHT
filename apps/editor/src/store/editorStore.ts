import {
  AddElementCommand,
  CommandHistory,
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
import { projectClient } from '../api/projectClient'

export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

export type EditorState = {
  projectPath: string
  manifest: ProjectManifest | undefined
  slides: SlideDocument[]
  currentSlideId: string | undefined
  selectedElementIds: string[]
  zoom: number
  saveState: SaveState
  error: string | undefined
  history: CommandHistory | undefined
  slideRevisions: Record<string, number>
  currentSlide: () => SlideDocument | undefined
  createProject: (projectPath: string, title: string) => Promise<void>
  openProject: (projectPath: string) => Promise<void>
  selectSlide: (slideId: string) => void
  selectElement: (elementId?: string) => void
  runCommand: (command: SlideCommand) => void
  addSlide: () => void
  duplicateCurrentSlide: () => void
  deleteCurrentSlide: () => void
  moveCurrentSlide: (direction: -1 | 1) => void
  addText: () => void
  addImage: () => void
  addShape: () => void
  addLine: () => void
  undo: () => void
  redo: () => void
  saveCurrentSlide: () => Promise<void>
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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
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
  zoom: 0.45,
  saveState: 'idle',
  error: undefined,
  history: undefined,
  slideRevisions: {},

  currentSlide: () => get().slides.find((slide) => slide.id === get().currentSlideId),

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
        history: first ? new CommandHistory(first) : undefined,
        slideRevisions: initialSlideRevisions(result.slides),
        saveState: 'saved',
        error: undefined
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
        history: first ? new CommandHistory(first) : undefined,
        slideRevisions: initialSlideRevisions(result.slides),
        saveState: 'saved',
        error: undefined
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

  selectElement(elementId) {
    if (!elementId) {
      set({ selectedElementIds: [] })
      return
    }

    const currentSlide = get().currentSlide()
    const elementExists = currentSlide?.elements.some((element) => element.id === elementId) ?? false

    if (!elementExists) {
      return
    }

    set({ selectedElementIds: [elementId] })
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

  addShape() {
    const element = createShapeElement(createId('shape'), { x: 220, y: 170, width: 220, height: 140 }, 'rectangle')
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
    const slide = get().currentSlide()
    const projectPath = get().projectPath

    if (slide === undefined || projectPath.length === 0) {
      return
    }

    const slideId = slide.id
    const revision = get().slideRevisions[slideId] ?? 0
    const token = nextSaveToken()
    set({ saveState: 'saving', error: undefined })

    try {
      const savedSlide = await projectClient.saveSlide(projectPath, slide)
      const sameProject = get().projectPath === projectPath
      const sameSlideRevision = (get().slideRevisions[slideId] ?? 0) === revision
      const latestSave = isLatestSave(token)

      if (
        savedSlide.id !== slideId ||
        !sameProject ||
        !sameSlideRevision
      ) {
        if (sameProject && latestSave) {
          set({ saveState: 'dirty' })
        }
        return
      }

      const currentSaveState = get().saveState
      const nextSaveState = latestSave && currentSaveState === 'saving' ? 'saved' : currentSaveState
      set({
        slides: replaceSlide(get().slides, savedSlide),
        saveState: nextSaveState,
        error: undefined
      })
    } catch (error) {
      if (get().projectPath === projectPath && isLatestSave(token)) {
        set({ saveState: 'error', error: getErrorMessage(error, 'Save failed') })
      }
    }
  }
}))
