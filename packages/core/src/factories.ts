import type { ElementRect, ImageElement, LineElement, ShapeElement, SlideDocument, TextElement } from './model'

const defaultTextStyle = {
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: 48,
  color: '#111827',
  fontWeight: 400,
  fontStyle: 'normal',
  textAlign: 'left',
  lineHeight: 1.2
}

const defaultShapeStyle = {
  fill: '#ffffff',
  stroke: '#2563eb',
  strokeWidth: 3,
  borderRadius: 0
}

export function createSlide(id: string, title = 'Untitled'): SlideDocument {
  return {
    id,
    title,
    background: { type: 'color', value: '#ffffff' },
    elements: []
  }
}

export function createTextElement(id: string, rect: ElementRect, text: string): TextElement {
  return {
    id,
    type: 'text',
    ...rect,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    style: defaultTextStyle,
    content: { text }
  }
}

export function createImageElement(id: string, rect: ElementRect, src: string, alt = ''): ImageElement {
  return {
    id,
    type: 'image',
    ...rect,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    style: { opacity: 1 },
    content: { assetId: id, src, alt }
  }
}

export function createShapeElement(id: string, rect: ElementRect, shape: ShapeElement['content']['shape']): ShapeElement {
  return {
    id,
    type: 'shape',
    ...rect,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    style: defaultShapeStyle,
    content: { shape }
  }
}

export function createLineElement(id: string, rect: ElementRect): LineElement {
  return {
    id,
    type: 'line',
    ...rect,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    style: { stroke: '#111827', strokeWidth: 3, startMarker: 'none', endMarker: 'none' },
    content: { x1: 0, y1: rect.height / 2, x2: rect.width, y2: rect.height / 2 }
  }
}
