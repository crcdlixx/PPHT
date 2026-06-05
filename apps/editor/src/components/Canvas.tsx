import { UpdateElementCommand, type ElementNode, type LineElement, type ShapeElement } from '@ppht/core'
import { type CSSProperties, type PointerEvent, useMemo, useState } from 'react'
import { useEditorStore } from '../store/editorStore'

const SLIDE_WIDTH = 1280
const SLIDE_HEIGHT = 720

type DragState = {
  elementId: string
  originX: number
  originY: number
  pointerX: number
  pointerY: number
  x: number
  y: number
}

function cssValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  return undefined
}

function cssNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function toReactStyle(style: Record<string, unknown>): CSSProperties {
  return Object.fromEntries(
    Object.entries(style).filter((entry): entry is [string, string | number] => {
      const value = entry[1]
      return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
    })
  ) as CSSProperties
}

function shapeStyle(element: ShapeElement): CSSProperties {
  const fill = cssValue(element.style.fill) ?? 'transparent'
  const stroke = cssValue(element.style.stroke) ?? 'transparent'
  const strokeWidth = cssNumber(element.style.strokeWidth)
  const borderRadius =
    element.content.shape === 'ellipse'
      ? '9999px'
      : cssValue(element.style.borderRadius) ?? `${cssNumber(element.style.borderRadius)}px`

  return {
    background: fill,
    border: strokeWidth > 0 ? `${strokeWidth}px solid ${stroke}` : undefined,
    borderRadius,
    clipPath: element.content.shape === 'triangle' ? 'polygon(50% 0, 100% 100%, 0 100%)' : undefined
  }
}

function elementFrameStyle(element: ElementNode, drag: DragState | undefined): CSSProperties {
  const x = drag?.elementId === element.id ? drag.x : element.x
  const y = drag?.elementId === element.id ? drag.y : element.y

  return {
    left: x,
    top: y,
    width: element.width,
    height: element.height,
    zIndex: element.zIndex,
    transform: `rotate(${element.rotation}deg)`
  }
}

function renderElementContent(element: ElementNode): JSX.Element {
  switch (element.type) {
    case 'text':
      return <div className="canvas-text-content">{element.content.text}</div>
    case 'image':
      return <img className="canvas-image-content" src={element.content.src} alt={element.content.alt} draggable={false} />
    case 'shape':
      return <div className={`canvas-shape-content shape-${element.content.shape}`} style={shapeStyle(element)} />
    case 'line':
      return <LineElementView element={element} />
  }
}

function LineElementView({ element }: { element: LineElement }) {
  const stroke = cssValue(element.style.stroke) ?? '#111827'
  const strokeWidth = cssNumber(element.style.strokeWidth, 3)

  return (
    <svg className="canvas-line-content" viewBox={`0 0 ${element.width} ${element.height}`} aria-hidden="true">
      <line
        x1={element.content.x1}
        y1={element.content.y1}
        x2={element.content.x2}
        y2={element.content.y2}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </svg>
  )
}

export function Canvas() {
  const slide = useEditorStore((state) => state.currentSlide())
  const zoom = useEditorStore((state) => state.zoom)
  const selectedElementIds = useEditorStore((state) => state.selectedElementIds)
  const selectElement = useEditorStore((state) => state.selectElement)
  const runCommand = useEditorStore((state) => state.runCommand)
  const [drag, setDrag] = useState<DragState>()

  const selectedElementId = selectedElementIds[0]
  const sortedElements = useMemo(
    () => [...(slide?.elements ?? [])].filter((element) => element.visible).sort((a, b) => a.zIndex - b.zIndex),
    [slide]
  )

  if (slide === undefined) {
    return (
      <div className="canvas-empty" role="status">
        No slide selected
      </div>
    )
  }

  function handleElementPointerDown(event: PointerEvent<HTMLDivElement>, element: ElementNode) {
    event.stopPropagation()
    selectElement(element.id)

    if (element.locked) {
      return
    }

    event.currentTarget.setPointerCapture(event.pointerId)
    setDrag({
      elementId: element.id,
      originX: element.x,
      originY: element.y,
      pointerX: event.clientX,
      pointerY: event.clientY,
      x: element.x,
      y: element.y
    })
  }

  function handleElementPointerMove(event: PointerEvent<HTMLDivElement>) {
    setDrag((current) => {
      if (current === undefined) {
        return current
      }

      const safeZoom = zoom > 0 ? zoom : 1
      return {
        ...current,
        x: Math.round(current.originX + (event.clientX - current.pointerX) / safeZoom),
        y: Math.round(current.originY + (event.clientY - current.pointerY) / safeZoom)
      }
    })
  }

  function handleElementPointerUp(event: PointerEvent<HTMLDivElement>) {
    if (drag === undefined) {
      return
    }

    event.currentTarget.releasePointerCapture(event.pointerId)
    const safeZoom = zoom > 0 ? zoom : 1
    const x = Math.round(drag.originX + (event.clientX - drag.pointerX) / safeZoom)
    const y = Math.round(drag.originY + (event.clientY - drag.pointerY) / safeZoom)
    setDrag(undefined)

    if (x !== drag.originX || y !== drag.originY) {
      runCommand(new UpdateElementCommand(drag.elementId, { x, y }))
    }
  }

  return (
    <div className="canvas-viewport">
      <div
        className="canvas-slide"
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          transform: `scale(${zoom})`,
          background: slide.background.type === 'color' ? slide.background.value : undefined,
          backgroundImage: slide.background.type === 'image' ? `url("${slide.background.assetId}")` : undefined,
          backgroundSize: slide.background.type === 'image' ? slide.background.fit : undefined,
          backgroundPosition: slide.background.type === 'image' ? 'center' : undefined,
          backgroundRepeat: slide.background.type === 'image' ? 'no-repeat' : undefined
        }}
        aria-label={slide.title}
        onPointerDown={() => selectElement()}
      >
        {sortedElements.map((element) => {
          const isSelected = element.id === selectedElementId
          return (
            <div
              className={`canvas-element canvas-element-${element.type}${isSelected ? ' selected' : ''}${element.locked ? ' locked' : ''}`}
              key={element.id}
              style={{ ...toReactStyle(element.style), ...elementFrameStyle(element, drag) }}
              data-element-id={element.id}
              data-element-type={element.type}
              onPointerDown={(event) => handleElementPointerDown(event, element)}
              onPointerMove={handleElementPointerMove}
              onPointerUp={handleElementPointerUp}
              onPointerCancel={handleElementPointerUp}
            >
              {renderElementContent(element)}
            </div>
          )
        })}
      </div>
    </div>
  )
}
