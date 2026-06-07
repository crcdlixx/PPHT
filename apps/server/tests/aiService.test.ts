import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  createSlide,
  createTextElement,
  serializeSlideToHtml,
  type ProjectManifest,
  type SlideDocument
} from '@ppht/core'
import { suggestSlideEdit } from '../src/aiService.js'

describe('suggestSlideEdit', () => {
  const manifest: ProjectManifest = {
    version: '1.0.0',
    title: 'AI Deck',
    canvas: {
      width: 1280,
      height: 720,
      ratio: '16:9'
    },
    slides: [
      {
        id: 'slide-001',
        title: 'Intro',
        html: 'slides/slide-001.html',
        thumbnail: 'thumbs/slide-001.svg'
      }
    ],
    theme: {
      fonts: [],
      colors: []
    },
    assets: []
  }

  it('updates the slide title when the instruction asks for a title edit', () => {
    const slide = createSlide('slide-001', 'Old Title')

    const result = suggestSlideEdit({
      manifest,
      slide,
      slideHtml: serializeSlideToHtml(slide),
      instruction: 'title: Phase 3 Overview'
    })

    expect(result.summary).toMatch(/title/i)
    expect(result.beforeSlide).toEqual(slide)
    expect(result.afterSlide).toMatchObject({
      id: slide.id,
      title: 'Phase 3 Overview'
    })
    expect(result.afterSlide).not.toBe(slide)
    expect(result.changedElementIds).toEqual([])
  })

  it('recognizes Chinese title and text instructions', () => {
    const text = createTextElement('text-001', { x: 80, y: 100, width: 360, height: 90 }, 'Old copy')
    const slide: SlideDocument = {
      ...createSlide('slide-001', 'Old Title'),
      elements: [text]
    }

    const titleResult = suggestSlideEdit({
      manifest,
      slide,
      slideHtml: serializeSlideToHtml(slide),
      instruction: '标题: Phase 3 中文标题'
    })
    const textResult = suggestSlideEdit({
      manifest,
      slide,
      slideHtml: serializeSlideToHtml(slide),
      instruction: '文本: 更清楚的说明'
    })

    expect(titleResult.afterSlide.title).toBe('Phase 3 中文标题')
    expect(textResult.afterSlide.elements[0]).toMatchObject({
      id: text.id,
      type: 'text',
      content: {
        text: '更清楚的说明'
      }
    })
  })

  it('updates the first text element when the instruction asks for text', () => {
    const text = createTextElement('text-001', { x: 80, y: 100, width: 360, height: 90 }, 'Old copy')
    const slide: SlideDocument = {
      ...createSlide('slide-001', 'Intro'),
      elements: [text]
    }

    const result = suggestSlideEdit({
      manifest,
      slide,
      slideHtml: serializeSlideToHtml(slide),
      instruction: 'text: explain offline AI suggestions'
    })

    expect(result.beforeSlide).toEqual(slide)
    expect(result.afterSlide.elements).toHaveLength(1)
    expect(result.afterSlide.elements[0]).toMatchObject({
      id: text.id,
      type: 'text',
      content: {
        text: 'explain offline AI suggestions'
      }
    })
    expect(result.changedElementIds).toEqual([text.id])
  })

  it('adds a text box for general instructions and does not write files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ppht-ai-'))
    const sentinelPath = path.join(root, 'sentinel.txt')
    await fs.writeFile(sentinelPath, 'unchanged', 'utf8')
    const slide = createSlide('slide-001', 'Intro')

    const result = suggestSlideEdit({
      manifest,
      slide,
      slideHtml: serializeSlideToHtml(slide),
      instruction: `Summarize launch risks near ${sentinelPath}`
    })

    expect(result.beforeSlide).toEqual(slide)
    expect(result.afterSlide.elements).toHaveLength(1)
    expect(result.afterSlide.elements[0]).toMatchObject({
      id: expect.stringMatching(/^ai-text-/),
      type: 'text',
      content: {
        text: expect.stringContaining('Summarize launch risks')
      }
    })
    expect(result.changedElementIds).toEqual([result.afterSlide.elements[0]?.id])
    await expect(fs.readFile(sentinelPath, 'utf8')).resolves.toBe('unchanged')
    await expect(fs.readdir(root)).resolves.toEqual(['sentinel.txt'])
  })
})
