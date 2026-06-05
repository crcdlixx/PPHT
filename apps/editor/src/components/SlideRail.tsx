import { useEditorStore } from '../store/editorStore'

export function SlideRail() {
  const slides = useEditorStore((state) => state.slides)
  const currentSlideId = useEditorStore((state) => state.currentSlideId)
  const selectSlide = useEditorStore((state) => state.selectSlide)

  return (
    <aside className="slide-rail" aria-label="Slides">
      {slides.length === 0 ? (
        <div className="slide-rail-empty">No slides</div>
      ) : (
        slides.map((slide, index) => (
          <button
            className={`slide-thumb${slide.id === currentSlideId ? ' active' : ''}`}
            type="button"
            key={slide.id}
            onClick={() => selectSlide(slide.id)}
          >
            <span className="slide-index">{index + 1}</span>
            <span className="slide-title">{slide.title}</span>
          </button>
        ))
      )}
    </aside>
  )
}
