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
