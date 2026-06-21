import type {
  ChartElement,
  ElementNode,
  ElementRect,
  GroupElement,
  ImageElement,
  LineElement,
  MediaElement,
  ShapeElement,
  SlideDocument,
  TextElement
} from './model.js'

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

const defaultChartStyle = {
  background: '#ffffff',
  color: '#111827',
  accentColor: '#2563eb',
  borderColor: '#d1d5db',
  fontFamily: 'Inter, Arial, sans-serif'
}

const defaultMediaStyle = {
  background: '#111827',
  color: '#ffffff',
  borderRadius: 8
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
    style: { ...defaultTextStyle },
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
    style: { ...defaultShapeStyle },
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

export function createChartElement(
  id: string,
  rect: ElementRect,
  content: ChartElement['content']
): ChartElement {
  return {
    id,
    type: 'chart',
    ...rect,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    style: { ...defaultChartStyle },
    content: {
      kind: content.kind,
      labels: [...content.labels],
      values: [...content.values]
    }
  }
}

export function createMediaElement(
  id: string,
  rect: ElementRect,
  content: MediaElement['content']
): MediaElement {
  return {
    id,
    type: 'media',
    ...rect,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    style: { ...defaultMediaStyle },
    content: { ...content }
  }
}

export function createGroupElement(id: string, rect: ElementRect, elements: ElementNode[]): GroupElement {
  const maxZ = elements.reduce((max, element) => Math.max(max, element.zIndex), 0)
  return {
    id,
    type: 'group',
    ...rect,
    rotation: 0,
    zIndex: maxZ,
    locked: false,
    visible: true,
    style: {},
    content: {
      elements: structuredClone(elements)
    }
  }
}
