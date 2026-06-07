import { useEffect } from 'react'
import { useEditorStore } from '../store/editorStore'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

function hasCommandModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey
}

export function KeyboardShortcuts() {
  const copySelection = useEditorStore((state) => state.copySelection)
  const pasteClipboard = useEditorStore((state) => state.pasteClipboard)
  const deleteSelection = useEditorStore((state) => state.deleteSelection)
  const duplicateSelection = useEditorStore((state) => state.duplicateSelection)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const saveCurrentSlide = useEditorStore((state) => state.saveCurrentSlide)
  const startPlayback = useEditorStore((state) => state.startPlayback)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target)) {
        return
      }

      const key = event.key.toLowerCase()
      const commandModifier = hasCommandModifier(event)

      if (commandModifier && key === 'c') {
        event.preventDefault()
        copySelection()
      } else if (commandModifier && key === 'v') {
        event.preventDefault()
        pasteClipboard()
      } else if (commandModifier && key === 'd') {
        event.preventDefault()
        duplicateSelection()
      } else if (commandModifier && key === 'z' && !event.shiftKey) {
        event.preventDefault()
        undo()
      } else if ((commandModifier && key === 'y') || (commandModifier && event.shiftKey && key === 'z')) {
        event.preventDefault()
        redo()
      } else if (commandModifier && key === 's') {
        event.preventDefault()
        void saveCurrentSlide()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelection()
      } else if (event.key === 'F5' || (commandModifier && event.key === 'Enter')) {
        event.preventDefault()
        startPlayback()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [copySelection, deleteSelection, duplicateSelection, pasteClipboard, redo, saveCurrentSlide, startPlayback, undo])

  return null
}
