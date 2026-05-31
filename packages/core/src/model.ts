export type ElementType = 'text' | 'image' | 'shape' | 'line'

export type CanvasSize = {
  width: number
  height: number
  ratio: '16:9' | '4:3' | 'custom'
}

export type ProjectSlideRef = {
  id: string
  title: string
  html: string
  thumbnail: string
}

export type ProjectManifest = {
  version: string
  title: string
  canvas: CanvasSize
  slides: ProjectSlideRef[]
  theme: {
    fonts: string[]
    colors: string[]
  }
  assets: Array<{
    id: string
    type: 'image' | 'font' | 'media'
    path: string
  }>
}

export type Background =
  | { type: 'color'; value: string }
  | { type: 'image'; assetId: string; fit: 'cover' | 'contain' | 'stretch' }

export type ElementRect = {
  x: number
  y: number
  width: number
  height: number
}

export type BaseElement = ElementRect & {
  id: string
  type: ElementType
  rotation: number
  zIndex: number
  locked: boolean
  visible: boolean
  style: Record<string, unknown>
}

export type TextElement = BaseElement & {
  type: 'text'
  content: {
    text: string
  }
}

export type ImageElement = BaseElement & {
  type: 'image'
  content: {
    assetId: string
    src: string
    alt: string
  }
}

export type ShapeElement = BaseElement & {
  type: 'shape'
  content: {
    shape: 'rectangle' | 'ellipse' | 'triangle'
  }
}

export type LineElement = BaseElement & {
  type: 'line'
  content: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
}

export type ElementNode = TextElement | ImageElement | ShapeElement | LineElement

export type SlideDocument = {
  id: string
  title: string
  background: Background
  elements: ElementNode[]
}
