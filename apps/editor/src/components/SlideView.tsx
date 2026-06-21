import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import type { ChartElement, ElementNode, LineElement, MediaElement, ShapeElement, SlideDocument } from '@ppht/core'

export const SLIDE_WIDTH = 1280
export const SLIDE_HEIGHT = 720

export type SlideElementFrame = {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
}

export type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

type SlideViewProps = {
  slide: SlideDocument
  className?: string
  scale?: number
  selectedElementId?: string | undefined
  selectedElementIds?: string[]
  frameOverrides?: Record<string, SlideElementFrame>
  overlay?: ReactNode
  onSlidePointerDown?: (event: PointerEvent<HTMLDivElement>) => void
  onSlidePointerMove?: (event: PointerEvent<HTMLDivElement>) => void
  onSlidePointerUp?: (event: PointerEvent<HTMLDivElement>) => void
  onElementPointerDown?: (event: PointerEvent<HTMLDivElement>, element: ElementNode) => void
  onElementPointerMove?: (event: PointerEvent<HTMLDivElement>) => void
  onElementPointerUp?: (event: PointerEvent<HTMLDivElement>) => void
  onResizeHandlePointerDown?: (event: PointerEvent<HTMLButtonElement>, element: ElementNode, handle: ResizeHandle) => void
  onResizeHandlePointerMove?: (event: PointerEvent<HTMLButtonElement>) => void
  onResizeHandlePointerUp?: (event: PointerEvent<HTMLButtonElement>) => void
  onRotateHandlePointerDown?: (event: PointerEvent<HTMLButtonElement>, element: ElementNode) => void
  onRotateHandlePointerMove?: (event: PointerEvent<HTMLButtonElement>) => void
  onRotateHandlePointerUp?: (event: PointerEvent<HTMLButtonElement>) => void
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

function elementFrameStyle(element: ElementNode, override: SlideElementFrame | undefined): CSSProperties {
  const x = override?.x ?? element.x
  const y = override?.y ?? element.y

  return {
    left: x,
    top: y,
    width: override?.width ?? element.width,
    height: override?.height ?? element.height,
    zIndex: element.zIndex,
    transform: `rotate(${override?.rotation ?? element.rotation}deg)`
  }
}

const resizeHandles: Array<{ handle: ResizeHandle; label: string }> = [
  { handle: 'nw', label: 'Resize northwest' },
  { handle: 'n', label: 'Resize north' },
  { handle: 'ne', label: 'Resize northeast' },
  { handle: 'e', label: 'Resize east' },
  { handle: 'se', label: 'Resize southeast' },
  { handle: 's', label: 'Resize south' },
  { handle: 'sw', label: 'Resize southwest' },
  { handle: 'w', label: 'Resize west' }
]

function renderElementContent(element: ElementNode): ReactNode {
  switch (element.type) {
    case 'text':
      return <div className="canvas-text-content">{element.content.text}</div>
    case 'image':
      return <img className="canvas-image-content" src={element.content.src} alt={element.content.alt} draggable={false} />
    case 'shape':
      return <div className={`canvas-shape-content shape-${element.content.shape}`} style={shapeStyle(element)} />
    case 'line':
      return <LineElementView element={element} />
    case 'chart':
      return <ChartElementView element={element} />
    case 'media':
      return <MediaElementView element={element} />
  }
}

function ChartElementView({ element }: { element: ChartElement }) {
  const values = element.content.values.map((value) => (Number.isFinite(value) ? value : 0))
  const maxValue = values.reduce((max, value) => Math.max(max, Math.abs(value)), 0)

  return (
    <div className="canvas-chart-content">
      <strong>{element.content.kind} chart</strong>
      <ol>
        {element.content.labels.map((label, index) => {
          const value = values[index] ?? 0
          const width = maxValue > 0 ? Math.max(4, Math.round((Math.abs(value) / maxValue) * 100)) : 4
          return (
            <li key={`${label}-${index}`}>
              <span className="canvas-chart-label">{label}</span>
              <span className="canvas-chart-track">
                <span className="canvas-chart-bar" style={{ width: `${width}%` }} />
              </span>
              <strong>{value}</strong>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function MediaElementView({ element }: { element: MediaElement }) {
  return (
    <figure className="canvas-media-content">
      <figcaption>{element.content.title}</figcaption>
      <span className="canvas-media-type">{element.content.mediaType}</span>
      {element.content.mediaType === 'audio' ? (
        <audio controls src={element.content.src} />
      ) : (
        <video controls src={element.content.src} />
      )}
    </figure>
  )
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

export function SlideView({
  slide,
  className,
  scale = 1,
  selectedElementId,
  selectedElementIds,
  frameOverrides = {},
  overlay,
  onSlidePointerDown,
  onSlidePointerMove,
  onSlidePointerUp,
  onElementPointerDown,
  onElementPointerMove,
  onElementPointerUp,
  onResizeHandlePointerDown,
  onResizeHandlePointerMove,
  onResizeHandlePointerUp,
  onRotateHandlePointerDown,
  onRotateHandlePointerMove,
  onRotateHandlePointerUp
}: SlideViewProps) {
  const sortedElements = [...slide.elements].filter((element) => element.visible).sort((a, b) => a.zIndex - b.zIndex)
  const selectedIds = new Set(selectedElementIds ?? (selectedElementId ? [selectedElementId] : []))

  return (
    <div
      className="canvas-slide-frame"
      style={{
        width: SLIDE_WIDTH * scale,
        height: SLIDE_HEIGHT * scale
      }}
    >
      <div
        className={['canvas-slide', className].filter(Boolean).join(' ')}
        style={{
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          transform: `scale(${scale})`,
          background: slide.background.type === 'color' ? slide.background.value : undefined,
          backgroundImage: slide.background.type === 'image' ? `url("${slide.background.assetId}")` : undefined,
          backgroundSize: slide.background.type === 'image' ? slide.background.fit : undefined,
          backgroundPosition: slide.background.type === 'image' ? 'center' : undefined,
          backgroundRepeat: slide.background.type === 'image' ? 'no-repeat' : undefined
        }}
        aria-label={slide.title}
        onPointerDown={onSlidePointerDown}
        onPointerMove={onSlidePointerMove}
        onPointerUp={onSlidePointerUp}
        onPointerCancel={onSlidePointerUp}
      >
        {sortedElements.map((element) => {
          const isSelected = selectedIds.has(element.id)
          return (
            <div
              className={`canvas-element canvas-element-${element.type}${isSelected ? ' selected' : ''}${element.locked ? ' locked' : ''}`}
              key={element.id}
              style={{ ...toReactStyle(element.style), ...elementFrameStyle(element, frameOverrides[element.id]) }}
              data-element-id={element.id}
              data-element-type={element.type}
              onPointerDown={onElementPointerDown ? (event) => onElementPointerDown(event, element) : undefined}
              onPointerMove={onElementPointerMove}
              onPointerUp={onElementPointerUp}
              onPointerCancel={onElementPointerUp}
            >
              {renderElementContent(element)}
              {isSelected && selectedIds.size === 1 && !element.locked
                ? (
                    <>
                      {resizeHandles.map((item) => (
                        <button
                          aria-label={item.label}
                          className={`canvas-resize-handle handle-${item.handle}`}
                          data-resize-handle={item.handle}
                          key={item.handle}
                          type="button"
                          onPointerDown={onResizeHandlePointerDown ? (event) => onResizeHandlePointerDown(event, element, item.handle) : undefined}
                          onPointerMove={onResizeHandlePointerMove}
                          onPointerUp={onResizeHandlePointerUp}
                          onPointerCancel={onResizeHandlePointerUp}
                        />
                      ))}
                      <button
                        aria-label="Rotate"
                        className="canvas-rotate-handle"
                        data-rotate-handle="true"
                        type="button"
                        onPointerDown={onRotateHandlePointerDown ? (event) => onRotateHandlePointerDown(event, element) : undefined}
                        onPointerMove={onRotateHandlePointerMove}
                        onPointerUp={onRotateHandlePointerUp}
                        onPointerCancel={onRotateHandlePointerUp}
                      />
                    </>
                  )
                : null}
            </div>
          )
        })}
        {overlay}
      </div>
    </div>
  )
}
