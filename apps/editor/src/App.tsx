import { Canvas } from './components/Canvas'
import { PlaybackView } from './components/PlaybackView'
import { PropertyPanel } from './components/PropertyPanel'
import { SlideRail } from './components/SlideRail'
import { StatusBar } from './components/StatusBar'
import { Toolbar } from './components/Toolbar'

export function App() {
  return (
    <div className="editor-shell">
      <Toolbar />
      <div className="editor-body">
        <SlideRail />
        <main className="workspace" aria-label="Editor workspace">
          <div className="canvas-stage">
            <Canvas />
          </div>
        </main>
        <aside className="property-panel" aria-label="Properties">
          <PropertyPanel />
        </aside>
      </div>
      <StatusBar />
      <PlaybackView />
    </div>
  )
}
