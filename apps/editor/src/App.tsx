import { Canvas } from './components/Canvas'
import { PropertyPanel } from './components/PropertyPanel'
import { SlideRail } from './components/SlideRail'
import { StatusBar } from './components/StatusBar'
import { Toolbar } from './components/Toolbar'

export function App() {
  return (
    <main className="app-shell">
      <Toolbar />
      <div className="workspace">
        <SlideRail />
        <Canvas />
        <PropertyPanel />
      </div>
      <StatusBar />
    </main>
  )
}
