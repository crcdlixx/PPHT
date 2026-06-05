import {
  AddElementCommand,
  CommandHistory,
  createId,
  createTextElement,
  type ProjectManifest,
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
  addText: () => void
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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

let projectLoadToken = 0

function nextProjectLoadToken(): number {
  projectLoadToken += 1
  return projectLoadToken
}

function isLatestProjectLoad(token: number): boolean {
  return token === projectLoadToken
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

  addText() {
    const element = createTextElement(createId('text'), { x: 160, y: 160, width: 420, height: 110 }, 'Text')
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
    set({ saveState: 'saving', error: undefined })

    try {
      const savedSlide = await projectClient.saveSlide(projectPath, slide)

      if (
        savedSlide.id !== slideId ||
        get().projectPath !== projectPath ||
        (get().slideRevisions[slideId] ?? 0) !== revision
      ) {
        if (get().projectPath === projectPath && get().currentSlideId === slideId) {
          set({ saveState: 'dirty' })
        }
        return
      }

      const saveState = get().currentSlideId === slideId ? 'saved' : get().saveState
      set({
        slides: replaceSlide(get().slides, savedSlide),
        saveState,
        error: undefined
      })
    } catch (error) {
      if (get().projectPath === projectPath && get().currentSlideId === slideId) {
        set({ saveState: 'error', error: getErrorMessage(error, 'Save failed') })
      }
    }
  }
}))
