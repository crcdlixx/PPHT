import { useEffect } from 'react'
import { type AlignmentMode, type DistributionMode, useEditorStore } from '../store/editorStore'

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
  const groupSelection = useEditorStore((state) => state.groupSelection)
  const ungroupSelection = useEditorStore((state) => state.ungroupSelection)
  const alignSelection = useEditorStore((state) => state.alignSelection)
  const distributeSelection = useEditorStore((state) => state.distributeSelection)
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

      const alignmentShortcuts: Record<string, AlignmentMode> = {
        l: 'left',
        c: 'center',
        r: 'right',
        t: 'top',
        m: 'middle',
        b: 'bottom'
      }
      const distributionShortcuts: Record<string, DistributionMode> = {
        h: 'horizontal',
        v: 'vertical'
      }

      if (commandModifier && event.altKey && key in alignmentShortcuts) {
        event.preventDefault()
        alignSelection(alignmentShortcuts[key]!)
      } else if (commandModifier && event.altKey && key in distributionShortcuts) {
        event.preventDefault()
        distributeSelection(distributionShortcuts[key]!)
      } else if (commandModifier && key === 'c') {
        event.preventDefault()
        copySelection()
      } else if (commandModifier && key === 'v') {
        event.preventDefault()
        pasteClipboard()
      } else if (commandModifier && key === 'd') {
        event.preventDefault()
        duplicateSelection()
      } else if (commandModifier && event.shiftKey && key === 'g') {
        event.preventDefault()
        ungroupSelection()
      } else if (commandModifier && key === 'g') {
        event.preventDefault()
        groupSelection()
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
  }, [
    alignSelection,
    copySelection,
    deleteSelection,
    distributeSelection,
    duplicateSelection,
    groupSelection,
    pasteClipboard,
    redo,
    saveCurrentSlide,
    startPlayback,
    ungroupSelection,
    undo
  ])

  return null
}
