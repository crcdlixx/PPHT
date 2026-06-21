import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGroupElement, createSlide, createTextElement, type ProjectManifest, type SlideDocument } from '@ppht/core'
import { useEditorStore } from './editorStore'

type MockResponseOptions = {
  ok?: boolean
  status?: number
  body?: unknown
}

const manifest: ProjectManifest = {
  version: '1.0.0',
  title: 'Deck',
  canvas: { width: 1280, height: 720, ratio: '16:9' },
  slides: [{ id: 'slide-001', title: 'Intro', html: 'slides/slide-001.html', thumbnail: 'thumbnails/slide-001.png' }],
  theme: { fonts: ['Inter'], colors: ['#111827'] },
  assets: []
}

const firstSlide = createSlide('slide-001', 'Intro')
const secondSlide = createSlide('slide-002', 'Second')
const twoSlideManifest: ProjectManifest = {
  ...manifest,
  slides: [
    manifest.slides[0]!,
    { id: 'slide-002', title: 'Second', html: 'slides/slide-002.html', thumbnail: 'thumbnails/slide-002.png' }
  ]
}

type Deferred<T> = {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, resolve, reject }
}

function mockJsonResponse({ ok = true, status = 200, body }: MockResponseOptions) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body)
  } as unknown as Response
}

function mockProjectFetch(slides: SlideDocument[] = [firstSlide]) {
  return vi.fn().mockResolvedValue(mockJsonResponse({ body: { manifest, slides } }))
}

describe('editor store', () => {
  beforeEach(() => {
    useEditorStore.setState(useEditorStore.getInitialState(), true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts new editor sessions at full zoom', () => {
    expect(useEditorStore.getState().zoom).toBe(1)
  })

  it('createProject sets project data, current slide, and saved state', async () => {
    const fetchMock = mockProjectFetch()
    vi.stubGlobal('fetch', fetchMock)

    await useEditorStore.getState().createProject('D:/Decks/demo', 'Deck')

    const state = useEditorStore.getState()
    expect(state.projectPath).toBe('D:/Decks/demo')
    expect(state.manifest).toEqual(manifest)
    expect(state.slides).toEqual([firstSlide])
    expect(state.currentSlideId).toBe('slide-001')
    expect(state.saveState).toBe('saved')
    expect(state.error).toBeUndefined()
  })

  it('openProject sets the first slide as current and saved', async () => {
    const fetchMock = mockProjectFetch([firstSlide, secondSlide])
    vi.stubGlobal('fetch', fetchMock)

    await useEditorStore.getState().openProject('D:/Decks/demo')

    const state = useEditorStore.getState()
    expect(state.projectPath).toBe('D:/Decks/demo')
    expect(state.currentSlideId).toBe('slide-001')
    expect(state.slides).toEqual([firstSlide, secondSlide])
    expect(state.saveState).toBe('saved')
  })

  it('starts playback from the selected slide and clamps next and previous navigation', async () => {
    const fetchMock = mockProjectFetch([firstSlide, secondSlide])
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.getState().selectSlide('slide-002')

    useEditorStore.getState().startPlayback()
    useEditorStore.getState().nextPlaybackSlide()

    expect(useEditorStore.getState().isPresenting).toBe(true)
    expect(useEditorStore.getState().playbackSlideId).toBe('slide-002')

    useEditorStore.getState().previousPlaybackSlide()
    useEditorStore.getState().previousPlaybackSlide()

    expect(useEditorStore.getState().playbackSlideId).toBe('slide-001')
  })

  it('jumps and stops playback without changing the editing slide selection', async () => {
    const fetchMock = mockProjectFetch([firstSlide, secondSlide])
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')

    useEditorStore.getState().startPlayback()
    useEditorStore.getState().showPlaybackSlide('slide-002')
    useEditorStore.getState().showPlaybackSlide('missing-slide')

    expect(useEditorStore.getState().currentSlideId).toBe('slide-001')
    expect(useEditorStore.getState().playbackSlide()?.id).toBe('slide-002')

    useEditorStore.getState().stopPlayback()

    expect(useEditorStore.getState().isPresenting).toBe(false)
    expect(useEditorStore.getState().playbackSlideId).toBeUndefined()
  })

  it('openProject reports errors without silently keeping a saved state', async () => {
    const fetchMock = mockProjectFetch()
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ ok: false, status: 404, body: { error: 'Project not found' } }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')

    await useEditorStore.getState().openProject('D:/Decks/missing')

    const state = useEditorStore.getState()
    expect(state.saveState).toBe('error')
    expect(state.error).toBe('Project not found')
  })

  it('addText marks the deck dirty and selects the new text element', async () => {
    vi.stubGlobal('fetch', mockProjectFetch())
    await useEditorStore.getState().openProject('D:/Decks/demo')

    useEditorStore.getState().addText()

    const state = useEditorStore.getState()
    const element = state.slides[0]?.elements[0]
    expect(element?.type).toBe('text')
    expect(element?.type === 'text' ? element.content.text : undefined).toBe('Text')
    expect(state.selectedElementIds).toEqual([element?.id])
    expect(state.saveState).toBe('dirty')
  })

  it('addImage inserts an image element and selects it', async () => {
    vi.stubGlobal('fetch', mockProjectFetch())
    await useEditorStore.getState().openProject('D:/Decks/demo')

    useEditorStore.getState().addImage()

    const state = useEditorStore.getState()
    const element = state.slides[0]?.elements[0]
    expect(element?.type).toBe('image')
    expect(element?.type === 'image' ? element.content.src : '').toContain('data:image/svg+xml;base64,')
    expect(state.selectedElementIds).toEqual([element?.id])
    expect(state.saveState).toBe('dirty')
  })

  it('addShape inserts a rectangle shape and selects it', async () => {
    vi.stubGlobal('fetch', mockProjectFetch())
    await useEditorStore.getState().openProject('D:/Decks/demo')

    useEditorStore.getState().addShape()

    const state = useEditorStore.getState()
    const element = state.slides[0]?.elements[0]
    expect(element?.type).toBe('shape')
    expect(element?.type === 'shape' ? element.content.shape : undefined).toBe('rectangle')
    expect(state.selectedElementIds).toEqual([element?.id])
    expect(state.saveState).toBe('dirty')
  })

  it('addShape can insert an ellipse shape and select it', async () => {
    vi.stubGlobal('fetch', mockProjectFetch())
    await useEditorStore.getState().openProject('D:/Decks/demo')

    useEditorStore.getState().addShape('ellipse')

    const state = useEditorStore.getState()
    const element = state.slides[0]?.elements[0]
    expect(element?.type).toBe('shape')
    expect(element?.type === 'shape' ? element.content.shape : undefined).toBe('ellipse')
    expect(state.selectedElementIds).toEqual([element?.id])
    expect(state.saveState).toBe('dirty')
  })

  it('addLine inserts a line element and selects it', async () => {
    vi.stubGlobal('fetch', mockProjectFetch())
    await useEditorStore.getState().openProject('D:/Decks/demo')

    useEditorStore.getState().addLine()

    const state = useEditorStore.getState()
    const element = state.slides[0]?.elements[0]
    expect(element?.type).toBe('line')
    expect(state.selectedElementIds).toEqual([element?.id])
    expect(state.saveState).toBe('dirty')
  })

  it('selectElement ignores ids outside the current slide and allows clearing selection', async () => {
    vi.stubGlobal('fetch', mockProjectFetch())
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.getState().addText()
    const selectedId = useEditorStore.getState().selectedElementIds[0]

    useEditorStore.getState().selectElement('missing-element')

    expect(useEditorStore.getState().selectedElementIds).toEqual([selectedId])

    useEditorStore.getState().selectElement('')

    expect(useEditorStore.getState().selectedElementIds).toEqual([])
  })

  it('toggles elements into and out of a multi-selection', async () => {
    const slideWithText: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-001', { x: 10, y: 20, width: 100, height: 40 }, 'One'),
        createTextElement('text-002', { x: 120, y: 80, width: 100, height: 40 }, 'Two')
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithText]))
    await useEditorStore.getState().openProject('D:/Decks/demo')

    useEditorStore.getState().selectElement('text-001')
    useEditorStore.getState().selectElement('text-002', { additive: true })
    expect(useEditorStore.getState().selectedElementIds).toEqual(['text-001', 'text-002'])

    useEditorStore.getState().selectElement('text-001', { additive: true })
    expect(useEditorStore.getState().selectedElementIds).toEqual(['text-002'])
  })

  it('selectElements replaces selection with ids from the current slide only', async () => {
    const slideWithText: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-001', { x: 10, y: 20, width: 100, height: 40 }, 'One'),
        createTextElement('text-002', { x: 120, y: 80, width: 100, height: 40 }, 'Two'),
        createTextElement('text-003', { x: 240, y: 140, width: 100, height: 40 }, 'Three')
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithText]))
    await useEditorStore.getState().openProject('D:/Decks/demo')

    useEditorStore.getState().selectElement('text-001')
    useEditorStore.getState().selectElements(['text-002', 'missing-element', 'text-003'])

    expect(useEditorStore.getState().selectedElementIds).toEqual(['text-002', 'text-003'])
  })

  it('aligns and distributes selected elements through undoable commands', async () => {
    const slideWithText: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-001', { x: 10, y: 20, width: 100, height: 40 }, 'One'),
        createTextElement('text-002', { x: 80, y: 90, width: 100, height: 40 }, 'Two'),
        createTextElement('text-003', { x: 220, y: 180, width: 100, height: 40 }, 'Three')
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithText]))
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.setState({ selectedElementIds: ['text-001', 'text-002', 'text-003'] })

    useEditorStore.getState().alignSelection('left')
    expect(useEditorStore.getState().slides[0]?.elements.map((element) => element.x)).toEqual([10, 10, 10])

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().slides[0]?.elements.map((element) => element.x)).toEqual([10, 80, 220])

    useEditorStore.getState().distributeSelection('horizontal')
    expect(useEditorStore.getState().slides[0]?.elements.map((element) => element.x)).toEqual([10, 115, 220])
  })

  it('distributes selected elements by equal gaps between object bounds', async () => {
    const slideWithText: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-001', { x: 10, y: 20, width: 100, height: 40 }, 'One'),
        createTextElement('text-002', { x: 160, y: 80, width: 40, height: 40 }, 'Two'),
        createTextElement('text-003', { x: 320, y: 180, width: 100, height: 40 }, 'Three')
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithText]))
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.setState({ selectedElementIds: ['text-001', 'text-002', 'text-003'] })

    useEditorStore.getState().distributeSelection('horizontal')

    expect(useEditorStore.getState().slides[0]?.elements.map((element) => element.x)).toEqual([10, 195, 320])
  })

  it('arranges selected elements and applies style patches', async () => {
    const slideWithText: SlideDocument = {
      ...firstSlide,
      elements: [
        { ...createTextElement('text-001', { x: 10, y: 20, width: 100, height: 40 }, 'One'), zIndex: 1 },
        { ...createTextElement('text-002', { x: 120, y: 80, width: 100, height: 40 }, 'Two'), zIndex: 2 },
        { ...createTextElement('text-003', { x: 240, y: 120, width: 100, height: 40 }, 'Three'), zIndex: 3 }
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithText]))
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.setState({ selectedElementIds: ['text-001', 'text-002'] })

    useEditorStore.getState().arrangeSelection('front')
    expect(useEditorStore.getState().slides[0]?.elements.map((element) => ({ id: element.id, zIndex: element.zIndex }))).toEqual([
      { id: 'text-001', zIndex: 4 },
      { id: 'text-002', zIndex: 5 },
      { id: 'text-003', zIndex: 3 }
    ])

    useEditorStore.getState().updateSelectedElementStyles({ color: '#dc2626', fontSize: 36 })
    const styled = useEditorStore.getState().slides[0]?.elements.slice(0, 2) ?? []
    expect(styled.map((element) => element.style.color)).toEqual(['#dc2626', '#dc2626'])
    expect(styled.map((element) => element.style.fontSize)).toEqual([36, 36])

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().slides[0]?.elements[0]?.style.color).toBe('#111827')
  })

  it('moves adjacent selected elements forward without duplicating layer indices', async () => {
    const slideWithText: SlideDocument = {
      ...firstSlide,
      elements: [
        { ...createTextElement('text-001', { x: 10, y: 20, width: 100, height: 40 }, 'One'), zIndex: 1 },
        { ...createTextElement('text-002', { x: 120, y: 80, width: 100, height: 40 }, 'Two'), zIndex: 2 },
        { ...createTextElement('text-003', { x: 240, y: 120, width: 100, height: 40 }, 'Three'), zIndex: 3 }
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithText]))
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.setState({ selectedElementIds: ['text-001', 'text-002'] })

    useEditorStore.getState().arrangeSelection('forward')

    expect(useEditorStore.getState().slides[0]?.elements.map((element) => ({ id: element.id, zIndex: element.zIndex }))).toEqual([
      { id: 'text-001', zIndex: 2 },
      { id: 'text-002', zIndex: 3 },
      { id: 'text-003', zIndex: 1 }
    ])
  })

  it('moves adjacent selected elements backward without duplicating layer indices', async () => {
    const slideWithText: SlideDocument = {
      ...firstSlide,
      elements: [
        { ...createTextElement('text-001', { x: 10, y: 20, width: 100, height: 40 }, 'One'), zIndex: 1 },
        { ...createTextElement('text-002', { x: 120, y: 80, width: 100, height: 40 }, 'Two'), zIndex: 2 },
        { ...createTextElement('text-003', { x: 240, y: 120, width: 100, height: 40 }, 'Three'), zIndex: 3 }
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithText]))
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.setState({ selectedElementIds: ['text-002', 'text-003'] })

    useEditorStore.getState().arrangeSelection('backward')

    expect(useEditorStore.getState().slides[0]?.elements.map((element) => ({ id: element.id, zIndex: element.zIndex }))).toEqual([
      { id: 'text-001', zIndex: 3 },
      { id: 'text-002', zIndex: 1 },
      { id: 'text-003', zIndex: 2 }
    ])
  })

  it('undo and redo update slides from command history snapshots', async () => {
    vi.stubGlobal('fetch', mockProjectFetch())
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.getState().addText()

    useEditorStore.getState().undo()

    expect(useEditorStore.getState().slides[0]?.elements).toEqual([])
    expect(useEditorStore.getState().saveState).toBe('dirty')

    useEditorStore.getState().redo()

    expect(useEditorStore.getState().slides[0]?.elements).toHaveLength(1)
  })

  it('copies the selected element and pastes a fresh offset copy', async () => {
    const slideWithText: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-original', { x: 100, y: 120, width: 260, height: 80 }, 'Copied')
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithText]))
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.getState().selectElement('text-original')

    useEditorStore.getState().copySelection()
    useEditorStore.getState().pasteClipboard()

    const state = useEditorStore.getState()
    const elements = state.slides[0]?.elements ?? []
    expect(state.clipboard?.elements).toHaveLength(1)
    expect(elements).toHaveLength(2)
    expect(elements[1]?.id).not.toBe('text-original')
    expect(elements[1]?.type).toBe('text')
    expect(elements[1]?.x).toBe(124)
    expect(elements[1]?.y).toBe(144)
    expect(state.selectedElementIds).toEqual([elements[1]?.id])
    expect(state.saveState).toBe('dirty')
  })

  it('deletes selected elements through one undoable command', async () => {
    const slideWithText: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-001', { x: 100, y: 120, width: 260, height: 80 }, 'One'),
        createTextElement('text-002', { x: 180, y: 220, width: 260, height: 80 }, 'Two'),
        createTextElement('text-003', { x: 260, y: 320, width: 260, height: 80 }, 'Three')
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithText]))
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.setState({ selectedElementIds: ['text-001', 'text-003'] })

    useEditorStore.getState().deleteSelection()

    expect(useEditorStore.getState().slides[0]?.elements.map((element) => element.id)).toEqual(['text-002'])
    expect(useEditorStore.getState().selectedElementIds).toEqual([])

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().slides[0]?.elements.map((element) => element.id)).toEqual(['text-001', 'text-002', 'text-003'])
  })

  it('duplicates selected elements as fresh offset copies', async () => {
    const slideWithText: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-001', { x: 100, y: 120, width: 260, height: 80 }, 'One'),
        createTextElement('text-002', { x: 180, y: 220, width: 260, height: 80 }, 'Two')
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithText]))
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.setState({ selectedElementIds: ['text-001', 'text-002'] })

    useEditorStore.getState().duplicateSelection()

    const state = useEditorStore.getState()
    const elements = state.slides[0]?.elements ?? []
    expect(elements).toHaveLength(4)
    expect(elements.slice(2).map((element) => ({ type: element.type, x: element.x, y: element.y }))).toEqual([
      { type: 'text', x: 124, y: 144 },
      { type: 'text', x: 204, y: 244 }
    ])
    expect(elements[2]?.id).not.toBe('text-001')
    expect(elements[3]?.id).not.toBe('text-002')
    expect(state.selectedElementIds).toEqual([elements[2]?.id, elements[3]?.id])
  })

  it('groups and ungroups selected elements through undoable commands', async () => {
    const slideWithText: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-001', { x: 100, y: 120, width: 260, height: 80 }, 'One'),
        createTextElement('text-002', { x: 420, y: 260, width: 180, height: 90 }, 'Two'),
        createTextElement('text-003', { x: 40, y: 60, width: 120, height: 60 }, 'Three')
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithText]))
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.setState({ selectedElementIds: ['text-001', 'text-002'] })

    useEditorStore.getState().groupSelection()

    let state = useEditorStore.getState()
    expect(state.slides[0]?.elements.map((element) => element.type)).toEqual(['group', 'text'])
    const group = state.slides[0]?.elements[0]
    expect(group).toMatchObject({ type: 'group', x: 100, y: 120, width: 500, height: 230 })
    expect(state.selectedElementIds).toEqual([group?.id])

    useEditorStore.getState().ungroupSelection()

    state = useEditorStore.getState()
    expect(state.slides[0]?.elements.map((element) => ({ id: element.id, x: element.x, y: element.y }))).toEqual([
      { id: 'text-001', x: 100, y: 120 },
      { id: 'text-002', x: 420, y: 260 },
      { id: 'text-003', x: 40, y: 60 }
    ])
    expect(state.selectedElementIds).toEqual(['text-001', 'text-002'])

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().slides[0]?.elements.map((element) => element.type)).toEqual(['group', 'text'])
  })

  it('creates group ids that do not collide with existing slide elements', async () => {
    const existingGroup = createGroupElement('group-0001', { x: 20, y: 20, width: 100, height: 60 }, [])
    const slideWithExistingGroup: SlideDocument = {
      ...firstSlide,
      elements: [
        existingGroup,
        createTextElement('text-001', { x: 100, y: 120, width: 260, height: 80 }, 'One'),
        createTextElement('text-002', { x: 420, y: 260, width: 180, height: 90 }, 'Two')
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithExistingGroup]))
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.setState({ selectedElementIds: ['text-001', 'text-002'] })

    useEditorStore.getState().groupSelection()

    const ids = useEditorStore.getState().slides[0]?.elements.map((element) => element.id) ?? []
    expect(ids).toHaveLength(new Set(ids).size)
    expect(useEditorStore.getState().selectedElementIds[0]).not.toBe('group-0001')
  })

  it('filters stale selection ids after undoing group and ungroup actions', async () => {
    const slideWithText: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-001', { x: 100, y: 120, width: 260, height: 80 }, 'One'),
        createTextElement('text-002', { x: 420, y: 260, width: 180, height: 90 }, 'Two')
      ]
    }
    vi.stubGlobal('fetch', mockProjectFetch([slideWithText]))
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.setState({ selectedElementIds: ['text-001', 'text-002'] })

    useEditorStore.getState().groupSelection()
    expect(useEditorStore.getState().selectedElementIds).toHaveLength(1)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().selectedElementIds).toEqual([])

    useEditorStore.setState({ selectedElementIds: ['text-001', 'text-002'] })
    useEditorStore.getState().groupSelection()
    useEditorStore.getState().ungroupSelection()
    expect(useEditorStore.getState().selectedElementIds).toEqual(['text-001', 'text-002'])

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().selectedElementIds).toEqual([])
  })

  it('requests an AI suggestion with slide context and stores the pending summary', async () => {
    const afterSlide: SlideDocument = {
      ...firstSlide,
      title: 'Intro',
      elements: [
        createTextElement('text-ai', { x: 140, y: 130, width: 360, height: 90 }, 'AI copy')
      ]
    }
    const fetchMock = mockProjectFetch([firstSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({
        body: {
          summary: 'Added AI copy',
          beforeSlide: firstSlide,
          afterSlide,
          changedElementIds: ['text-ai']
        }
      }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')

    await useEditorStore.getState().requestAiSuggestion('Add a concise title')

    const aiRequest = JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string) as {
      instruction: string
      projectPath: string
      manifest: ProjectManifest
      slide: SlideDocument
      slideHtml: string
    }
    expect(fetchMock).toHaveBeenLastCalledWith('/api/ai/suggest', expect.objectContaining({ method: 'POST' }))
    expect(aiRequest.instruction).toBe('Add a concise title')
    expect(aiRequest.projectPath).toBe('D:/Decks/demo')
    expect(aiRequest.manifest).toEqual(manifest)
    expect(aiRequest.slide).toEqual(firstSlide)
    expect(aiRequest.slideHtml).toContain('data-ppht-slide-model')
    expect(useEditorStore.getState().pendingAiSuggestion?.summary).toBe('Added AI copy')
    expect(useEditorStore.getState().aiError).toBeUndefined()
  })

  it('clears AI pending state when a suggestion response arrives after changing slides', async () => {
    const suggestionResponse = deferred<Response>()
    const afterSlide: SlideDocument = {
      ...firstSlide,
      title: 'Late suggestion'
    }
    const fetchMock = mockProjectFetch([firstSlide, secondSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest: twoSlideManifest, slides: [firstSlide, secondSlide] } }))
      .mockReturnValueOnce(suggestionResponse.promise)
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')

    const request = useEditorStore.getState().requestAiSuggestion('title: Late suggestion')
    useEditorStore.getState().selectSlide('slide-002')
    suggestionResponse.resolve(mockJsonResponse({
      body: {
        summary: 'Updated title',
        beforeSlide: firstSlide,
        afterSlide,
        changedElementIds: []
      }
    }))
    await request

    expect(useEditorStore.getState().currentSlideId).toBe('slide-002')
    expect(useEditorStore.getState().pendingAiSuggestion).toBeUndefined()
    expect(useEditorStore.getState().aiPending).toBe(false)
    expect(useEditorStore.getState().aiError).toBeUndefined()
  })

  it('accepts an AI suggestion through history so undo restores the prior slide', async () => {
    const afterSlide: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-ai', { x: 140, y: 130, width: 360, height: 90 }, 'AI copy')
      ]
    }
    const fetchMock = mockProjectFetch([firstSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({
        body: {
          summary: 'Added AI copy',
          beforeSlide: firstSlide,
          afterSlide,
          changedElementIds: ['text-ai']
        }
      }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')
    await useEditorStore.getState().requestAiSuggestion('Add a concise title')

    useEditorStore.getState().acceptAiSuggestion()

    expect(useEditorStore.getState().pendingAiSuggestion).toBeUndefined()
    expect(useEditorStore.getState().lastAiSuggestion?.summary).toBe('Added AI copy')
    expect(useEditorStore.getState().slides[0]).toEqual(afterSlide)
    expect(useEditorStore.getState().selectedElementIds).toEqual(['text-ai'])
    expect(useEditorStore.getState().saveState).toBe('dirty')

    useEditorStore.getState().undo()

    expect(useEditorStore.getState().slides[0]).toEqual(firstSlide)
  })

  it('does not accept an AI suggestion after the source slide has changed', async () => {
    const afterSlide: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-ai', { x: 140, y: 130, width: 360, height: 90 }, 'AI copy')
      ]
    }
    const fetchMock = mockProjectFetch([firstSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({
        body: {
          summary: 'Added AI copy',
          beforeSlide: firstSlide,
          afterSlide,
          changedElementIds: ['text-ai']
        }
      }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')
    await useEditorStore.getState().requestAiSuggestion('Add a concise title')
    useEditorStore.getState().addText()

    const manuallyEditedSlide = useEditorStore.getState().slides[0]
    useEditorStore.getState().acceptAiSuggestion()

    expect(useEditorStore.getState().slides[0]).toEqual(manuallyEditedSlide)
    expect(useEditorStore.getState().pendingAiSuggestion).toBeUndefined()
    expect(useEditorStore.getState().lastAiSuggestion).toBeUndefined()
    expect(useEditorStore.getState().aiError).toBe('AI suggestion is out of date')
    expect(useEditorStore.getState().saveState).toBe('dirty')
  })

  it('rejects a pending AI suggestion without changing the slide', async () => {
    const afterSlide: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-ai', { x: 140, y: 130, width: 360, height: 90 }, 'AI copy')
      ]
    }
    const fetchMock = mockProjectFetch([firstSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({
        body: {
          summary: 'Added AI copy',
          beforeSlide: firstSlide,
          afterSlide,
          changedElementIds: ['text-ai']
        }
      }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')
    await useEditorStore.getState().requestAiSuggestion('Add a concise title')

    useEditorStore.getState().rejectAiSuggestion()

    expect(useEditorStore.getState().pendingAiSuggestion).toBeUndefined()
    expect(useEditorStore.getState().slides[0]).toEqual(firstSlide)
    expect(useEditorStore.getState().saveState).toBe('saved')
  })

  it('rolls back the last accepted AI suggestion with undo history', async () => {
    const afterSlide: SlideDocument = {
      ...firstSlide,
      elements: [
        createTextElement('text-ai', { x: 140, y: 130, width: 360, height: 90 }, 'AI copy')
      ]
    }
    const fetchMock = mockProjectFetch([firstSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({
        body: {
          summary: 'Added AI copy',
          beforeSlide: firstSlide,
          afterSlide,
          changedElementIds: ['text-ai']
        }
      }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')
    await useEditorStore.getState().requestAiSuggestion('Add a concise title')
    useEditorStore.getState().acceptAiSuggestion()

    useEditorStore.getState().rollbackLastAiSuggestion()

    expect(useEditorStore.getState().slides[0]).toEqual(firstSlide)
    expect(useEditorStore.getState().lastAiSuggestion).toBeUndefined()
    expect(useEditorStore.getState().saveState).toBe('dirty')
  })

  it('undo and redo without stack leave saveState unchanged', async () => {
    vi.stubGlobal('fetch', mockProjectFetch())
    await useEditorStore.getState().openProject('D:/Decks/demo')

    useEditorStore.getState().undo()
    useEditorStore.getState().redo()

    expect(useEditorStore.getState().saveState).toBe('saved')
    expect(useEditorStore.getState().slides).toEqual([firstSlide])
  })

  it('saveCurrentSlide saves the current slide and marks saved', async () => {
    const slideWithReservedId = createSlide('slide 001/a', 'Intro')
    const fetchMock = mockProjectFetch()
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [slideWithReservedId] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: manifest }))
      .mockResolvedValueOnce(mockJsonResponse({ body: slideWithReservedId }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')

    await useEditorStore.getState().saveCurrentSlide()

    expect(fetchMock).toHaveBeenLastCalledWith('/api/projects/slides/slide%20001%2Fa', expect.objectContaining({ method: 'PUT' }))
    expect(useEditorStore.getState().saveState).toBe('saved')
    expect(useEditorStore.getState().error).toBeUndefined()
  })

  it('saveCurrentSlide persists the manifest before saving all slide snapshots', async () => {
    const fetchMock = mockProjectFetch([firstSlide, secondSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest: twoSlideManifest, slides: [firstSlide, secondSlide] } }))
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { manifest: ProjectManifest }
        return mockJsonResponse({ body: body.manifest })
      })
      .mockImplementation(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { slide: SlideDocument }
        return mockJsonResponse({ body: body.slide })
      })
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.getState().addSlide()

    await useEditorStore.getState().saveCurrentSlide()

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/projects/manifest',
      expect.objectContaining({ method: 'PUT' })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/projects/slides/slide-001',
      expect.objectContaining({ method: 'PUT' })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/projects/slides/slide-002',
      expect.objectContaining({ method: 'PUT' })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      expect.stringMatching(/\/api\/projects\/slides\/slide-/),
      expect.objectContaining({ method: 'PUT' })
    )
    const manifestRequest = JSON.parse((fetchMock.mock.calls[1]?.[1] as RequestInit).body as string) as {
      manifest: ProjectManifest
    }
    expect(manifestRequest.manifest.slides).toHaveLength(3)
    expect(useEditorStore.getState().saveState).toBe('saved')
  })

  it('saveCurrentSlide reports an error when a slide save fails after manifest save succeeds', async () => {
    const fetchMock = mockProjectFetch([firstSlide, secondSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest: twoSlideManifest, slides: [firstSlide, secondSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: twoSlideManifest }))
      .mockResolvedValueOnce(mockJsonResponse({ body: firstSlide }))
      .mockResolvedValueOnce(mockJsonResponse({ ok: false, status: 500, body: { error: 'Slide write failed' } }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')

    await useEditorStore.getState().saveCurrentSlide()

    expect(useEditorStore.getState().saveState).toBe('error')
    expect(useEditorStore.getState().error).toBe('Slide write failed')
  })

  it('exportDeck saves first and then exports with the requested mode suffix', async () => {
    const fetchMock = mockProjectFetch([firstSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: manifest }))
      .mockResolvedValueOnce(mockJsonResponse({ body: firstSlide }))
      .mockResolvedValueOnce(mockJsonResponse({ body: { outputPath: 'D:/Decks/demo-full.html' } }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo.ppht')

    await useEditorStore.getState().exportDeck('self-contained')

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/projects/export',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          projectPath: 'D:/Decks/demo.ppht',
          outputPath: 'D:/Decks/demo-full.html',
          mode: 'self-contained'
        })
      })
    )
    expect(useEditorStore.getState().saveState).toBe('saved')
  })

  it('exportDeck does not export when saving fails', async () => {
    const fetchMock = mockProjectFetch([firstSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ ok: false, status: 500, body: { error: 'Manifest write failed' } }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo.ppht')

    await useEditorStore.getState().exportDeck('clean')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(useEditorStore.getState().saveState).toBe('error')
    expect(useEditorStore.getState().error).toBe('Manifest write failed')
  })

  it('exportDeck does not export when the save leaves newer edits dirty', async () => {
    const saveResponse = deferred<Response>()
    const fetchMock = mockProjectFetch([firstSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: manifest }))
      .mockReturnValueOnce(saveResponse.promise)
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo.ppht')
    useEditorStore.getState().addText()

    const savedBeforeSecondEdit = useEditorStore.getState().slides[0]!
    const exportPromise = useEditorStore.getState().exportDeck('clean')
    useEditorStore.getState().addText()

    saveResponse.resolve(mockJsonResponse({ body: savedBeforeSecondEdit }))
    await exportPromise

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).not.toHaveBeenCalledWith('/api/projects/export', expect.anything())
    expect(useEditorStore.getState().saveState).toBe('dirty')
  })

  it('exportDeck does not mark saved when edits happen while exporting', async () => {
    const exportResponse = deferred<Response>()
    const fetchMock = mockProjectFetch([firstSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: manifest }))
      .mockResolvedValueOnce(mockJsonResponse({ body: firstSlide }))
      .mockReturnValueOnce(exportResponse.promise)
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo.ppht')

    const exportPromise = useEditorStore.getState().exportDeck('clean')
    for (let attempt = 0; attempt < 10 && fetchMock.mock.calls.length < 4; attempt += 1) {
      await Promise.resolve()
    }
    expect(fetchMock).toHaveBeenCalledWith('/api/projects/export', expect.anything())

    useEditorStore.getState().addText()

    exportResponse.resolve(mockJsonResponse({ body: { outputPath: 'D:/Decks/demo-clean.html' } }))
    await exportPromise

    expect(useEditorStore.getState().saveState).toBe('dirty')
    expect(useEditorStore.getState().slides[0]?.elements).toHaveLength(1)
  })

  it('saveCurrentSlide preserves undo history after a successful save', async () => {
    const fetchMock = mockProjectFetch()
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: manifest }))
      .mockImplementationOnce(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { slide: SlideDocument }
        return mockJsonResponse({ body: body.slide })
      })
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.getState().addText()

    await useEditorStore.getState().saveCurrentSlide()
    useEditorStore.getState().undo()

    expect(useEditorStore.getState().slides[0]?.elements).toEqual([])
    expect(useEditorStore.getState().saveState).toBe('dirty')
  })

  it('imports an HTML slide through the project client and selects the imported slide', async () => {
    const importedSlide = createSlide('slide-imported', 'Imported')
    const importedManifest: ProjectManifest = {
      ...twoSlideManifest,
      slides: [
        ...twoSlideManifest.slides,
        { id: 'slide-imported', title: 'Imported', html: 'slides/slide-imported.html', thumbnail: 'thumbnails/slide-imported.png' }
      ]
    }
    const fetchMock = mockProjectFetch([firstSlide, secondSlide])
      .mockResolvedValueOnce(mockJsonResponse({ body: { projectPath: 'D:/Decks/demo', manifest: twoSlideManifest, slides: [firstSlide, secondSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: { projectPath: 'D:/Decks/demo', manifest: importedManifest, slides: [firstSlide, secondSlide, importedSlide] } }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')

    await useEditorStore.getState().importHtmlSlide('D:/Decks/imported.html')

    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/projects/import/html',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          projectPath: 'D:/Decks/demo',
          htmlFilePath: 'D:/Decks/imported.html'
        })
      })
    )
    expect(useEditorStore.getState().manifest).toEqual(importedManifest)
    expect(useEditorStore.getState().slides).toEqual([firstSlide, secondSlide, importedSlide])
    expect(useEditorStore.getState().currentSlideId).toBe('slide-imported')
    expect(useEditorStore.getState().saveState).toBe('saved')
  })

  it('saveCurrentSlide does not replace current slide history when selection changes while saving', async () => {
    const saveResponse = deferred<Response>()
    const fetchMock = mockProjectFetch()
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide, secondSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: manifest }))
      .mockReturnValueOnce(saveResponse.promise)
      .mockImplementation(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { slide: SlideDocument }
        return mockJsonResponse({ body: body.slide })
      })
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.getState().addText()

    const savePromise = useEditorStore.getState().saveCurrentSlide()
    useEditorStore.getState().selectSlide('slide-002')
    saveResponse.resolve(mockJsonResponse({ body: useEditorStore.getState().slides[0] }))
    await savePromise
    useEditorStore.getState().addText()

    const state = useEditorStore.getState()
    expect(state.currentSlideId).toBe('slide-002')
    expect(state.slides.find((slide) => slide.id === 'slide-002')?.elements).toHaveLength(1)
  })

  it('saveCurrentSlide leaves saving state after success resolves on another slide', async () => {
    const saveResponse = deferred<Response>()
    const fetchMock = mockProjectFetch()
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide, secondSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: manifest }))
      .mockReturnValueOnce(saveResponse.promise)
      .mockImplementation(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { slide: SlideDocument }
        return mockJsonResponse({ body: body.slide })
      })
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.getState().addText()
    const savedSlide = useEditorStore.getState().slides[0]!

    const savePromise = useEditorStore.getState().saveCurrentSlide()
    useEditorStore.getState().selectSlide('slide-002')

    saveResponse.resolve(mockJsonResponse({ body: savedSlide }))
    await savePromise

    const state = useEditorStore.getState()
    expect(state.currentSlideId).toBe('slide-002')
    expect(state.saveState).not.toBe('saving')
    expect(state.saveState).toBe('saved')
  })

  it('saveCurrentSlide does not mark saved when another slide is edited before stale success resolves', async () => {
    const saveResponse = deferred<Response>()
    const fetchMock = mockProjectFetch()
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide, secondSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: manifest }))
      .mockReturnValueOnce(saveResponse.promise)
      .mockImplementation(async (_url: string, init: RequestInit) => {
        const body = JSON.parse(init.body as string) as { slide: SlideDocument }
        return mockJsonResponse({ body: body.slide })
      })
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.getState().addText()
    const savedSlide = useEditorStore.getState().slides[0]!

    const savePromise = useEditorStore.getState().saveCurrentSlide()
    useEditorStore.getState().selectSlide('slide-002')
    useEditorStore.getState().addText()

    saveResponse.resolve(mockJsonResponse({ body: savedSlide }))
    await savePromise

    const state = useEditorStore.getState()
    expect(state.currentSlideId).toBe('slide-002')
    expect(state.saveState).toBe('dirty')
    expect(state.slides.find((slide) => slide.id === 'slide-002')?.elements).toHaveLength(1)
  })

  it('saveCurrentSlide leaves saving state after error resolves on another slide', async () => {
    const saveResponse = deferred<Response>()
    const fetchMock = mockProjectFetch()
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide, secondSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: manifest }))
      .mockReturnValueOnce(saveResponse.promise)
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.getState().addText()

    const savePromise = useEditorStore.getState().saveCurrentSlide()
    useEditorStore.getState().selectSlide('slide-002')

    saveResponse.resolve(mockJsonResponse({ ok: false, status: 500, body: { error: 'Disk full' } }))
    await savePromise

    const state = useEditorStore.getState()
    expect(state.currentSlideId).toBe('slide-002')
    expect(state.saveState).not.toBe('saving')
    expect(state.saveState).toBe('error')
    expect(state.error).toBe('Disk full')
  })

  it('saveCurrentSlide does not overwrite newer edits on the same slide with a stale response', async () => {
    const saveResponse = deferred<Response>()
    const fetchMock = mockProjectFetch()
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: manifest }))
      .mockReturnValueOnce(saveResponse.promise)
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')
    useEditorStore.getState().addText()

    const savedBeforeSecondEdit = useEditorStore.getState().slides[0]!
    const savePromise = useEditorStore.getState().saveCurrentSlide()
    useEditorStore.getState().addText()

    saveResponse.resolve(mockJsonResponse({ body: savedBeforeSecondEdit }))
    await savePromise

    const state = useEditorStore.getState()
    expect(state.slides[0]?.elements).toHaveLength(2)
    expect(state.saveState).toBe('dirty')
  })

  it('saveCurrentSlide sets error state when saving fails', async () => {
    const fetchMock = mockProjectFetch()
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: manifest }))
      .mockResolvedValueOnce(mockJsonResponse({ ok: false, status: 500, body: { error: 'Disk full' } }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')

    await useEditorStore.getState().saveCurrentSlide()

    expect(useEditorStore.getState().saveState).toBe('error')
    expect(useEditorStore.getState().error).toBe('Disk full')
  })

  it('ignores slower project load responses after a newer request commits', async () => {
    const firstResponse = deferred<Response>()
    const secondResponse = deferred<Response>()
    const newerSlide = createSlide('slide-newer', 'Newer')
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise)
    vi.stubGlobal('fetch', fetchMock)

    const olderOpen = useEditorStore.getState().openProject('D:/Decks/older')
    const newerOpen = useEditorStore.getState().openProject('D:/Decks/newer')

    secondResponse.resolve(mockJsonResponse({ body: { projectPath: 'D:/Decks/newer', manifest, slides: [newerSlide] } }))
    await newerOpen
    firstResponse.resolve(mockJsonResponse({ body: { projectPath: 'D:/Decks/older', manifest, slides: [firstSlide] } }))
    await olderOpen

    const state = useEditorStore.getState()
    expect(state.projectPath).toBe('D:/Decks/newer')
    expect(state.currentSlideId).toBe('slide-newer')
    expect(state.slides).toEqual([newerSlide])
  })

  it('ignores slower create project responses after a newer create commits', async () => {
    const firstResponse = deferred<Response>()
    const secondResponse = deferred<Response>()
    const newerSlide = createSlide('slide-created-newer', 'Created Newer')
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstResponse.promise)
      .mockReturnValueOnce(secondResponse.promise)
    vi.stubGlobal('fetch', fetchMock)

    const olderCreate = useEditorStore.getState().createProject('D:/Decks/older-create', 'Older')
    const newerCreate = useEditorStore.getState().createProject('D:/Decks/newer-create', 'Newer')

    secondResponse.resolve(mockJsonResponse({ body: { projectPath: 'D:/Decks/newer-create', manifest, slides: [newerSlide] } }))
    await newerCreate
    firstResponse.resolve(mockJsonResponse({ body: { projectPath: 'D:/Decks/older-create', manifest, slides: [firstSlide] } }))
    await olderCreate

    const state = useEditorStore.getState()
    expect(state.projectPath).toBe('D:/Decks/newer-create')
    expect(state.currentSlideId).toBe('slide-created-newer')
    expect(state.slides).toEqual([newerSlide])
  })
})
