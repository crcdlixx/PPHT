import {
  Circle,
  Copy,
  CopyPlus,
  Download,
  FileInput,
  FilePlus2,
  FolderOpen,
  Image,
  Minus,
  Play,
  Redo2,
  Save,
  Square,
  Type,
  Undo2,
  ClipboardPaste,
  Trash2
} from 'lucide-react'
import { useEditorStore } from '../store/editorStore'

export function Toolbar() {
  const createProject = useEditorStore((state) => state.createProject)
  const openProject = useEditorStore((state) => state.openProject)
  const addText = useEditorStore((state) => state.addText)
  const addImage = useEditorStore((state) => state.addImage)
  const addShape = useEditorStore((state) => state.addShape)
  const addLine = useEditorStore((state) => state.addLine)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const copySelection = useEditorStore((state) => state.copySelection)
  const pasteClipboard = useEditorStore((state) => state.pasteClipboard)
  const duplicateSelection = useEditorStore((state) => state.duplicateSelection)
  const deleteSelection = useEditorStore((state) => state.deleteSelection)
  const saveCurrentSlide = useEditorStore((state) => state.saveCurrentSlide)
  const exportDeck = useEditorStore((state) => state.exportDeck)
  const importHtmlSlide = useEditorStore((state) => state.importHtmlSlide)
  const startPlayback = useEditorStore((state) => state.startPlayback)
  const projectPath = useEditorStore((state) => state.projectPath)
  const hasSlides = useEditorStore((state) => state.slides.length > 0)
  const hasSelection = useEditorStore((state) => state.selectedElementIds.length > 0)
  const hasClipboard = useEditorStore((state) => state.clipboard !== undefined)

  function handleCreateProject() {
    const nextProjectPath = window.prompt('Project folder path')?.trim()

    if (nextProjectPath === undefined || nextProjectPath.length === 0) {
      return
    }

    const nextTitle = window.prompt('Project title')?.trim() || 'Untitled Deck'
    void createProject(nextProjectPath, nextTitle)
  }

  function handleOpenProject() {
    const nextProjectPath = window.prompt('Project folder path to open')?.trim()

    if (nextProjectPath === undefined || nextProjectPath.length === 0) {
      return
    }

    void openProject(nextProjectPath)
  }

  function handleImportHtml() {
    const htmlFilePath = window.prompt('HTML file path to import')?.trim()

    if (htmlFilePath === undefined || htmlFilePath.length === 0) {
      return
    }

    void importHtmlSlide(htmlFilePath)
  }

  return (
    <header className="toolbar" aria-label="Editor toolbar">
      <div className="toolbar-group" role="group" aria-label="Project">
        <button
          className="toolbar-button"
          type="button"
          title="New"
          aria-label="New"
          onClick={handleCreateProject}
        >
          <FilePlus2 aria-hidden="true" size={18} />
        </button>
        <button
          className="toolbar-button"
          type="button"
          title="Open"
          aria-label="Open"
          onClick={handleOpenProject}
        >
          <FolderOpen aria-hidden="true" size={18} />
        </button>
        <button
          className="toolbar-button"
          type="button"
          title="Save"
          aria-label="Save"
          onClick={() => void saveCurrentSlide()}
        >
          <Save aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="toolbar-group" role="group" aria-label="History">
        <button className="toolbar-button" type="button" title="Undo" aria-label="Undo" onClick={undo}>
          <Undo2 aria-hidden="true" size={18} />
        </button>
        <button className="toolbar-button" type="button" title="Redo" aria-label="Redo" onClick={redo}>
          <Redo2 aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="toolbar-group" role="group" aria-label="Clipboard">
        <button
          className="toolbar-button"
          type="button"
          title="Copy"
          aria-label="Copy"
          disabled={!hasSelection}
          onClick={copySelection}
        >
          <Copy aria-hidden="true" size={18} />
        </button>
        <button
          className="toolbar-button"
          type="button"
          title="Paste"
          aria-label="Paste"
          disabled={!hasClipboard || !hasSlides}
          onClick={pasteClipboard}
        >
          <ClipboardPaste aria-hidden="true" size={18} />
        </button>
        <button
          className="toolbar-button"
          type="button"
          title="Duplicate selection"
          aria-label="Duplicate selection"
          disabled={!hasSelection}
          onClick={duplicateSelection}
        >
          <CopyPlus aria-hidden="true" size={18} />
        </button>
        <button
          className="toolbar-button"
          type="button"
          title="Delete selection"
          aria-label="Delete selection"
          disabled={!hasSelection}
          onClick={deleteSelection}
        >
          <Trash2 aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="toolbar-group" role="group" aria-label="Insert">
        <button className="toolbar-button" type="button" title="Text" aria-label="Text" onClick={addText}>
          <Type aria-hidden="true" size={18} />
        </button>
        <button className="toolbar-button" type="button" title="Image" aria-label="Image" onClick={addImage}>
          <Image aria-hidden="true" size={18} />
        </button>
        <button className="toolbar-button" type="button" title="Shape" aria-label="Shape" onClick={() => addShape()}>
          <Square aria-hidden="true" size={18} />
        </button>
        <button className="toolbar-button" type="button" title="Line" aria-label="Line" onClick={addLine}>
          <Minus aria-hidden="true" size={18} />
        </button>
        <button
          className="toolbar-button"
          type="button"
          title="Ellipse"
          aria-label="Ellipse"
          onClick={() => addShape('ellipse')}
        >
          <Circle aria-hidden="true" size={18} />
        </button>
      </div>
      <div className="toolbar-spacer" />
      <button
        className="toolbar-button"
        type="button"
        title="Import HTML"
        aria-label="Import HTML"
        disabled={!projectPath}
        onClick={handleImportHtml}
      >
        <FileInput aria-hidden="true" size={18} />
      </button>
      <button
        className="toolbar-button"
        type="button"
        title="Play"
        aria-label="Play"
        disabled={!hasSlides}
        onClick={startPlayback}
      >
        <Play aria-hidden="true" size={18} />
      </button>
      <button
        className="toolbar-button"
        type="button"
        title="Export self-contained HTML"
        aria-label="Export self-contained HTML"
        disabled={!projectPath}
        onClick={() => void exportDeck('self-contained')}
      >
        <Download aria-hidden="true" size={18} />
      </button>
      <button
        className="toolbar-button"
        type="button"
        title="Export clean HTML"
        aria-label="Export clean HTML"
        disabled={!projectPath}
        onClick={() => void exportDeck('clean')}
      >
        <Download aria-hidden="true" size={18} />
      </button>
    </header>
  )
}
