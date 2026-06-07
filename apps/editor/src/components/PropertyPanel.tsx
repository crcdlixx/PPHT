import {
  AlignCenter,
  AlignHorizontalDistributeCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalDistributeCenter,
  ArrowDownToLine,
  ArrowUpFromLine,
  BringToFront,
  ChevronDown,
  ChevronUp,
  SendToBack
} from 'lucide-react'
import { UpdateElementCommand, type ElementNode } from '@ppht/core'
import { type ChangeEvent } from 'react'
import { type AlignmentMode, type ArrangeMode, type DistributionMode, useEditorStore } from '../store/editorStore'
import { AiPanel } from './AiPanel'

type NumericField = 'x' | 'y' | 'width' | 'height' | 'rotation' | 'zIndex'

const numericFields: Array<{ key: NumericField; label: string; min?: number }> = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'width', label: 'W', min: 1 },
  { key: 'height', label: 'H', min: 1 },
  { key: 'rotation', label: 'Rotate' },
  { key: 'zIndex', label: 'Layer' }
]

function fieldValue(element: ElementNode, key: NumericField): number {
  return element[key]
}

const alignControls: Array<{ mode: AlignmentMode; label: string; icon: typeof AlignLeft }> = [
  { mode: 'left', label: 'Align left', icon: AlignLeft },
  { mode: 'center', label: 'Align center', icon: AlignCenter },
  { mode: 'right', label: 'Align right', icon: AlignRight },
  { mode: 'top', label: 'Align top', icon: ArrowUpFromLine },
  { mode: 'middle', label: 'Align middle', icon: AlignCenter },
  { mode: 'bottom', label: 'Align bottom', icon: ArrowDownToLine }
]

const distributeControls: Array<{ mode: DistributionMode; label: string; icon: typeof AlignLeft }> = [
  { mode: 'horizontal', label: 'Distribute horizontal', icon: AlignHorizontalDistributeCenter },
  { mode: 'vertical', label: 'Distribute vertical', icon: AlignVerticalDistributeCenter }
]

const arrangeControls: Array<{ mode: ArrangeMode; label: string; icon: typeof AlignLeft }> = [
  { mode: 'front', label: 'Bring to front', icon: BringToFront },
  { mode: 'forward', label: 'Bring forward', icon: ChevronUp },
  { mode: 'backward', label: 'Send backward', icon: ChevronDown },
  { mode: 'back', label: 'Send to back', icon: SendToBack }
]

export function PropertyPanel() {
  const slide = useEditorStore((state) => state.currentSlide())
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds)
  const selectedElementId = selectedElementIds[0]
  const runCommand = useEditorStore((state) => state.runCommand)
  const alignSelection = useEditorStore((state) => state.alignSelection)
  const distributeSelection = useEditorStore((state) => state.distributeSelection)
  const arrangeSelection = useEditorStore((state) => state.arrangeSelection)
  const updateSelectedElementStyles = useEditorStore((state) => state.updateSelectedElementStyles)
  const element = slide?.elements.find((item) => item.id === selectedElementId)
  const canAlign = selectedElementIds.length > 1
  const canDistribute = selectedElementIds.length > 2
  const hasSelection = selectedElementIds.length > 0

  function handleNumericChange(key: NumericField, event: ChangeEvent<HTMLInputElement>) {
    if (element === undefined) {
      return
    }

    const value = Number(event.target.value)

    if (!Number.isFinite(value)) {
      return
    }

    runCommand(new UpdateElementCommand(element.id, { [key]: value }))
  }

  function handleCheckboxChange(key: 'visible' | 'locked', event: ChangeEvent<HTMLInputElement>) {
    if (element === undefined) {
      return
    }

    runCommand(new UpdateElementCommand(element.id, { [key]: event.target.checked }))
  }

  function handleStyleTextChange(key: string, event: ChangeEvent<HTMLInputElement>) {
    updateSelectedElementStyles({ [key]: event.target.value })
  }

  function handleStyleNumberChange(key: string, event: ChangeEvent<HTMLInputElement>) {
    const value = Number(event.target.value)

    if (Number.isFinite(value)) {
      updateSelectedElementStyles({ [key]: value })
    }
  }

  if (element === undefined) {
    return (
      <section className="property-panel-content">
        <div className="property-section">
          <h2 className="property-panel-title">Properties</h2>
          <div className="property-empty">Select an element to edit its position and size.</div>
        </div>
        <AiPanel />
      </section>
    )
  }

  return (
    <section className="property-panel-content">
      <div className="property-section">
        <h2 className="property-panel-title">Properties</h2>
        <div className="property-summary">
          <span className="property-type">{element.type}</span>
          <span className="property-id">{element.id}</span>
        </div>
        <div className="property-grid" aria-label="Selected element geometry">
          {numericFields.map((field) => (
            <label className="property-field" key={field.key}>
              <span>{field.label}</span>
              <input
                type="number"
                value={fieldValue(element, field.key)}
                min={field.min}
                step={field.key === 'rotation' ? 1 : 1}
                onChange={(event) => handleNumericChange(field.key, event)}
              />
            </label>
          ))}
        </div>
        <div className="property-checkboxes" aria-label="Selected element state">
          <label className="property-checkbox-row">
            <input
              type="checkbox"
              checked={element.visible}
              onChange={(event) => handleCheckboxChange('visible', event)}
            />
            <span>Visible</span>
          </label>
          <label className="property-checkbox-row">
            <input
              type="checkbox"
              checked={element.locked}
              onChange={(event) => handleCheckboxChange('locked', event)}
            />
            <span>Locked</span>
          </label>
        </div>
        <div className="property-tool-section" aria-label="Selection layout controls">
          <div className="property-tool-grid">
            {alignControls.map((control) => {
              const Icon = control.icon
              return (
                <button
                  aria-label={control.label}
                  className="property-icon-button"
                  disabled={!canAlign}
                  key={control.label}
                  type="button"
                  onClick={() => alignSelection(control.mode)}
                >
                  <Icon aria-hidden="true" size={15} />
                </button>
              )
            })}
            {distributeControls.map((control) => {
              const Icon = control.icon
              return (
                <button
                  aria-label={control.label}
                  className="property-icon-button"
                  disabled={!canDistribute}
                  key={control.label}
                  type="button"
                  onClick={() => distributeSelection(control.mode)}
                >
                  <Icon aria-hidden="true" size={15} />
                </button>
              )
            })}
            {arrangeControls.map((control) => {
              const Icon = control.icon
              return (
                <button
                  aria-label={control.label}
                  className="property-icon-button"
                  disabled={!hasSelection}
                  key={control.label}
                  type="button"
                  onClick={() => arrangeSelection(control.mode)}
                >
                  <Icon aria-hidden="true" size={15} />
                </button>
              )
            })}
          </div>
        </div>
        <div className="property-style-grid" aria-label="Selected element style">
          <label className="property-field">
            <span>Text color</span>
            <input
              aria-label="Text color"
              type="color"
              value={typeof element.style.color === 'string' ? element.style.color : '#111827'}
              onChange={(event) => handleStyleTextChange('color', event)}
            />
          </label>
          <label className="property-field">
            <span>Font size</span>
            <input
              aria-label="Font size"
              min={1}
              type="number"
              value={typeof element.style.fontSize === 'number' ? element.style.fontSize : 32}
              onChange={(event) => handleStyleNumberChange('fontSize', event)}
            />
          </label>
          <label className="property-field">
            <span>Fill</span>
            <input
              aria-label="Fill color"
              type="color"
              value={typeof element.style.fill === 'string' ? element.style.fill : '#f8fafc'}
              onChange={(event) => handleStyleTextChange('fill', event)}
            />
          </label>
          <label className="property-field">
            <span>Stroke</span>
            <input
              aria-label="Stroke color"
              type="color"
              value={typeof element.style.stroke === 'string' ? element.style.stroke : '#111827'}
              onChange={(event) => handleStyleTextChange('stroke', event)}
            />
          </label>
        </div>
      </div>
      <AiPanel />
    </section>
  )
}
