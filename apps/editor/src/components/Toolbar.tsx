import { Circle, Download, FilePlus2, FolderOpen, Image, Minus, Redo2, Save, Square, Type, Undo2 } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'

const DEMO_PROJECT_PATH = 'D:\\NewStarProject\\PPHT\\demo.ppht'

export function Toolbar() {
  const createProject = useEditorStore((state) => state.createProject)
  const openProject = useEditorStore((state) => state.openProject)
  const addText = useEditorStore((state) => state.addText)
  const addImage = useEditorStore((state) => state.addImage)
  const addShape = useEditorStore((state) => state.addShape)
  const addLine = useEditorStore((state) => state.addLine)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const saveCurrentSlide = useEditorStore((state) => state.saveCurrentSlide)
  const projectPath = useEditorStore((state) => state.projectPath)

  return (
    <header className="toolbar" aria-label="Editor toolbar">
      <div className="toolbar-group" role="group" aria-label="Project">
        <button
          className="toolbar-button"
          type="button"
          title="New"
          aria-label="New"
          onClick={() => void createProject(DEMO_PROJECT_PATH, 'Demo Deck')}
        >
          <FilePlus2 aria-hidden="true" size={18} />
        </button>
        <button
          className="toolbar-button"
          type="button"
          title="Open"
          aria-label="Open"
          onClick={() => void openProject(DEMO_PROJECT_PATH)}
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
        title="Export"
        aria-label="Export"
        disabled={!projectPath}
      >
        <Download aria-hidden="true" size={18} />
      </button>
    </header>
  )
}
