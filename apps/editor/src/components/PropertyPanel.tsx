import { UpdateElementCommand, type ElementNode } from '@ppht/core'
import { type ChangeEvent } from 'react'
import { useEditorStore } from '../store/editorStore'
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

export function PropertyPanel() {
  const slide = useEditorStore((state) => state.currentSlide())
  const selectedElementId = useEditorStore((state) => state.selectedElementIds[0])
  const runCommand = useEditorStore((state) => state.runCommand)
  const element = slide?.elements.find((item) => item.id === selectedElementId)

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
      </div>
      <AiPanel />
    </section>
  )
}
