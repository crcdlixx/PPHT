import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import type { ElementNode, LineElement, ShapeElement, SlideDocument } from '@ppht/core'

export const SLIDE_WIDTH = 1280
export const SLIDE_HEIGHT = 720

export type SlideElementFrame = {
  x: number
  y: number
}

type SlideViewProps = {
  slide: SlideDocument
  className?: string
  scale?: number
  selectedElementId?: string | undefined
  frameOverrides?: Record<string, SlideElementFrame>
  onSlidePointerDown?: () => void
  onElementPointerDown?: (event: PointerEvent<HTMLDivElement>, element: ElementNode) => void
  onElementPointerMove?: (event: PointerEvent<HTMLDivElement>) => void
  onElementPointerUp?: (event: PointerEvent<HTMLDivElement>) => void
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
    width: element.width,
    height: element.height,
    zIndex: element.zIndex,
    transform: `rotate(${element.rotation}deg)`
  }
}

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

export function SlideView({
  slide,
  className,
  scale = 1,
  selectedElementId,
  frameOverrides = {},
  onSlidePointerDown,
  onElementPointerDown,
  onElementPointerMove,
  onElementPointerUp
}: SlideViewProps) {
  const sortedElements = [...slide.elements].filter((element) => element.visible).sort((a, b) => a.zIndex - b.zIndex)

  return (
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
    >
      {sortedElements.map((element) => {
        const isSelected = element.id === selectedElementId
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
          </div>
        )
      })}
    </div>
  )
}
