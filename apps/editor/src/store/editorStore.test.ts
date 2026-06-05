import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSlide, type ProjectManifest, type SlideDocument } from '@ppht/core'
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
    const secondSlide = createSlide('slide-002', 'Second')
    const fetchMock = mockProjectFetch([firstSlide, secondSlide])
    vi.stubGlobal('fetch', fetchMock)

    await useEditorStore.getState().openProject('D:/Decks/demo')

    const state = useEditorStore.getState()
    expect(state.projectPath).toBe('D:/Decks/demo')
    expect(state.currentSlideId).toBe('slide-001')
    expect(state.slides).toEqual([firstSlide, secondSlide])
    expect(state.saveState).toBe('saved')
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

  it('saveCurrentSlide saves the current slide and marks saved', async () => {
    const slideWithReservedId = createSlide('slide 001/a', 'Intro')
    const fetchMock = mockProjectFetch()
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [slideWithReservedId] } }))
      .mockResolvedValueOnce(mockJsonResponse({ body: slideWithReservedId }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')

    await useEditorStore.getState().saveCurrentSlide()

    expect(fetchMock).toHaveBeenLastCalledWith('/api/projects/slides/slide%20001%2Fa', expect.objectContaining({ method: 'PUT' }))
    expect(useEditorStore.getState().saveState).toBe('saved')
    expect(useEditorStore.getState().error).toBeUndefined()
  })

  it('saveCurrentSlide sets error state when saving fails', async () => {
    const fetchMock = mockProjectFetch()
      .mockResolvedValueOnce(mockJsonResponse({ body: { manifest, slides: [firstSlide] } }))
      .mockResolvedValueOnce(mockJsonResponse({ ok: false, status: 500, body: { error: 'Disk full' } }))
    vi.stubGlobal('fetch', fetchMock)
    await useEditorStore.getState().openProject('D:/Decks/demo')

    await useEditorStore.getState().saveCurrentSlide()

    expect(useEditorStore.getState().saveState).toBe('error')
    expect(useEditorStore.getState().error).toBe('Disk full')
  })
})
