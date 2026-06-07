import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { SlideDocument } from '@ppht/core'
import { SlideView } from './SlideView'

describe('SlideView', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders chart and media placeholders with visible content', () => {
    const slide: SlideDocument = {
      id: 'slide-001',
      title: 'Rich',
      background: { type: 'color', value: '#ffffff' },
      elements: [
        {
          id: 'chart-001',
          type: 'chart',
          x: 20,
          y: 30,
          width: 360,
          height: 220,
          rotation: 0,
          zIndex: 1,
          locked: false,
          visible: true,
          style: { color: '#111827' },
          content: { kind: 'bar', labels: ['North', 'South'], values: [12, 18] }
        },
        {
          id: 'media-001',
          type: 'media',
          x: 420,
          y: 30,
          width: 300,
          height: 180,
          rotation: 0,
          zIndex: 2,
          locked: false,
          visible: true,
          style: { color: '#ffffff', background: '#111827' },
          content: { mediaType: 'video', src: 'demo.mp4', title: 'Demo Clip' }
        }
      ]
    }

    render(<SlideView slide={slide} />)

    expect(screen.getByText('bar chart')).toBeInTheDocument()
    expect(screen.getByText('North')).toBeInTheDocument()
    expect(screen.getByText('18')).toBeInTheDocument()
    expect(screen.getByText('Demo Clip')).toBeInTheDocument()
    expect(screen.getByText('video')).toBeInTheDocument()
  })

  it('marks all selected elements when given multiple selected ids', () => {
    const slide: SlideDocument = {
      id: 'slide-001',
      title: 'Selection',
      background: { type: 'color', value: '#ffffff' },
      elements: [
        {
          id: 'text-001',
          type: 'text',
          x: 20,
          y: 30,
          width: 160,
          height: 60,
          rotation: 0,
          zIndex: 1,
          locked: false,
          visible: true,
          style: {},
          content: { text: 'One' }
        },
        {
          id: 'text-002',
          type: 'text',
          x: 220,
          y: 30,
          width: 160,
          height: 60,
          rotation: 0,
          zIndex: 2,
          locked: false,
          visible: true,
          style: {},
          content: { text: 'Two' }
        }
      ]
    }

    const { container } = render(<SlideView slide={slide} selectedElementIds={['text-001', 'text-002']} />)

    expect(container.querySelectorAll('.canvas-element.selected')).toHaveLength(2)
  })

  it('uses scaled layout dimensions so the visible slide stays centered', () => {
    const slide: SlideDocument = {
      id: 'slide-001',
      title: 'Scaled',
      background: { type: 'color', value: '#ffffff' },
      elements: []
    }

    const { container } = render(<SlideView slide={slide} scale={0.5} />)
    const frame = container.querySelector('.canvas-slide-frame')
    const surface = container.querySelector('.canvas-slide')

    expect(frame).toHaveStyle({ width: '640px', height: '360px' })
    expect(surface).toHaveStyle({ width: '1280px', height: '720px', transform: 'scale(0.5)' })
  })
})
