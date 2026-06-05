import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'

export function SlideRail() {
  const slides = useEditorStore((state) => state.slides)
  const currentSlideId = useEditorStore((state) => state.currentSlideId)
  const selectSlide = useEditorStore((state) => state.selectSlide)
  const addSlide = useEditorStore((state) => state.addSlide)
  const duplicateCurrentSlide = useEditorStore((state) => state.duplicateCurrentSlide)
  const deleteCurrentSlide = useEditorStore((state) => state.deleteCurrentSlide)
  const moveCurrentSlide = useEditorStore((state) => state.moveCurrentSlide)
  const currentIndex = slides.findIndex((slide) => slide.id === currentSlideId)
  const hasCurrentSlide = currentIndex !== -1

  return (
    <aside className="slide-rail" aria-label="Slides">
      <div className="slide-actions" aria-label="Slide actions">
        <button type="button" title="Add slide" aria-label="Add slide" onClick={addSlide}>
          <Plus size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Duplicate slide"
          aria-label="Duplicate slide"
          onClick={duplicateCurrentSlide}
          disabled={!hasCurrentSlide}
        >
          <Copy size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Move slide up"
          aria-label="Move slide up"
          onClick={() => moveCurrentSlide(-1)}
          disabled={!hasCurrentSlide || currentIndex === 0}
        >
          <ArrowUp size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Move slide down"
          aria-label="Move slide down"
          onClick={() => moveCurrentSlide(1)}
          disabled={!hasCurrentSlide || currentIndex === slides.length - 1}
        >
          <ArrowDown size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          title="Delete slide"
          aria-label="Delete slide"
          onClick={deleteCurrentSlide}
          disabled={!hasCurrentSlide || slides.length <= 1}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
      {slides.length === 0 ? (
        <div className="slide-rail-empty">No slides</div>
      ) : (
        slides.map((slide, index) => (
          <button
            className={`slide-thumb${slide.id === currentSlideId ? ' active' : ''}`}
            type="button"
            key={slide.id}
            onClick={() => selectSlide(slide.id)}
            aria-current={slide.id === currentSlideId ? 'true' : undefined}
          >
            <span className="slide-index">{index + 1}</span>
            <span className="slide-summary">
              <span className="slide-title">{slide.title}</span>
              <small className="slide-count">{slide.elements.length} elements</small>
            </span>
          </button>
        ))
      )}
    </aside>
  )
}
