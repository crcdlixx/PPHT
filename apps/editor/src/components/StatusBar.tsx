import { useEditorStore } from '../store/editorStore'

export function StatusBar() {
  const zoom = useEditorStore((state) => state.zoom)
  const saveState = useEditorStore((state) => state.saveState)
  const currentSlideId = useEditorStore((state) => state.currentSlideId)

  return (
    <footer className="status-bar">
      <span>{currentSlideId ?? 'No slide'}</span>
      <span>{Math.round(zoom * 100)}%</span>
      <span>{saveState}</span>
    </footer>
  )
}
