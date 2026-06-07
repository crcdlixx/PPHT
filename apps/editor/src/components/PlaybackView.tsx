import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../store/editorStore'
import { SLIDE_HEIGHT, SLIDE_WIDTH, SlideView } from './SlideView'

const EDGE_PADDING = 56
const MIN_SCALE = 0.18

function playbackScale(): number {
  if (typeof window === 'undefined') {
    return 1
  }

  return Math.max(
    MIN_SCALE,
    Math.min((window.innerWidth - EDGE_PADDING) / SLIDE_WIDTH, (window.innerHeight - EDGE_PADDING) / SLIDE_HEIGHT)
  )
}

export function PlaybackView() {
  const isPresenting = useEditorStore((state) => state.isPresenting)
  const slides = useEditorStore((state) => state.slides)
  const playbackSlide = useEditorStore((state) => state.playbackSlide())
  const playbackSlideId = useEditorStore((state) => state.playbackSlideId)
  const stopPlayback = useEditorStore((state) => state.stopPlayback)
  const nextPlaybackSlide = useEditorStore((state) => state.nextPlaybackSlide)
  const previousPlaybackSlide = useEditorStore((state) => state.previousPlaybackSlide)
  const showPlaybackSlide = useEditorStore((state) => state.showPlaybackSlide)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const pointerStartX = useRef<number>()
  const [scale, setScale] = useState(playbackScale)

  const currentIndex = useMemo(
    () => Math.max(0, slides.findIndex((slide) => slide.id === playbackSlideId)),
    [playbackSlideId, slides]
  )

  useEffect(() => {
    if (!isPresenting) {
      return
    }

    function handleResize() {
      setScale(playbackScale())
    }

    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [isPresenting])

  useEffect(() => {
    if (!isPresenting) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
        event.preventDefault()
        nextPlaybackSlide()
      } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
        event.preventDefault()
        previousPlaybackSlide()
      } else if (event.key === 'Home') {
        event.preventDefault()
        const firstSlide = slides[0]
        if (firstSlide) {
          showPlaybackSlide(firstSlide.id)
        }
      } else if (event.key === 'End') {
        event.preventDefault()
        const lastSlide = slides.at(-1)
        if (lastSlide) {
          showPlaybackSlide(lastSlide.id)
        }
      } else if (event.key === 'Escape') {
        event.preventDefault()
        stopPlayback()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isPresenting, nextPlaybackSlide, previousPlaybackSlide, showPlaybackSlide, slides, stopPlayback])

  if (!isPresenting || playbackSlide === undefined) {
    return null
  }

  function requestFullscreen() {
    void surfaceRef.current?.requestFullscreen?.()
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointerStartX.current = event.clientX
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const startX = pointerStartX.current
    pointerStartX.current = undefined

    if (startX === undefined) {
      return
    }

    const deltaX = event.clientX - startX
    if (Math.abs(deltaX) < 32) {
      nextPlaybackSlide()
    } else if (deltaX < 0) {
      nextPlaybackSlide()
    } else {
      previousPlaybackSlide()
    }
  }

  return (
    <div className="playback-overlay" ref={surfaceRef} role="dialog" aria-label="Presentation playback">
      <div className="playback-topbar">
        <span className="playback-title">{playbackSlide.title}</span>
        <span className="playback-counter">{currentIndex + 1} / {slides.length}</span>
        <button className="playback-button" type="button" aria-label="Fullscreen" title="Fullscreen" onClick={requestFullscreen}>
          <Maximize2 aria-hidden="true" size={18} />
        </button>
        <button className="playback-button" type="button" aria-label="Exit playback" title="Exit playback" onClick={stopPlayback}>
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="playback-stage" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}>
        <SlideView className="playback-slide entering" slide={playbackSlide} scale={scale} />
      </div>
      <div className="playback-controls" aria-label="Playback controls">
        <button className="playback-button" type="button" aria-label="Previous slide" title="Previous slide" onClick={previousPlaybackSlide}>
          <ChevronLeft aria-hidden="true" size={22} />
        </button>
        <div className="playback-dots" aria-label="Slides">
          {slides.map((slide, index) => (
            <button
              className={slide.id === playbackSlideId ? 'playback-dot active' : 'playback-dot'}
              type="button"
              key={slide.id}
              aria-label={`Show slide ${index + 1}`}
              onClick={() => showPlaybackSlide(slide.id)}
            />
          ))}
        </div>
        <button className="playback-button" type="button" aria-label="Next slide" title="Next slide" onClick={nextPlaybackSlide}>
          <ChevronRight aria-hidden="true" size={22} />
        </button>
      </div>
    </div>
  )
}
