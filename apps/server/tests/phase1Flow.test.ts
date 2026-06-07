import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addElement,
  createImageElement,
  createLineElement,
  createShapeElement,
  createSlide,
  createSlideRef,
  createTextElement,
  parseSlideHtml,
  updateElement,
  type ProjectManifest,
  type SlideDocument
} from '@ppht/core'
import { createApi } from '../src/api.js'

type OpenProjectResult = {
  manifest: ProjectManifest
  slides: SlideDocument[]
}

describe('phase 1 project flow', () => {
  let server: http.Server
  let baseUrl: string

  beforeEach(async () => {
    server = createApi().listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    if (typeof address !== 'object' || address === null) {
      throw new Error('Expected server address')
    }
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })

  async function request<T>(method: string, route: string, body: unknown): Promise<T> {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${await response.text()}`)
    }

    return response.json() as Promise<T>
  }

  async function createTempProjectPath() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ppht-phase1-'))
    return {
      root,
      projectPath: path.join(root, 'demo.ppht')
    }
  }

  it('creates, saves, reopens, and exports a multi-slide pure-web project', async () => {
    const { root, projectPath } = await createTempProjectPath()

    const created = await request<OpenProjectResult>('POST', '/api/projects', {
      projectPath,
      title: 'Phase 1 Deck'
    })
    const firstSlide = created.slides[0]
    if (!firstSlide) throw new Error('Expected first slide')

    const imageSvg = [
      '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">',
      '<rect width="320" height="180" fill="#dbeafe"/>',
      '<text x="160" y="100" text-anchor="middle" font-family="Arial" font-size="24">Image</text>',
      '</svg>'
    ].join('')
    const imageSrc = `data:image/svg+xml;base64,${Buffer.from(imageSvg).toString('base64')}`

    const text = createTextElement('text-001', { x: 80, y: 90, width: 360, height: 96 }, 'Edited text')
    const image = createImageElement('image-001', { x: 520, y: 110, width: 320, height: 180 }, imageSrc, 'Placeholder')
    const shape = createShapeElement('shape-001', { x: 160, y: 280, width: 240, height: 150 }, 'ellipse')
    const line = createLineElement('line-001', { x: 520, y: 360, width: 340, height: 70 })
    const editedFirstSlide = updateElement(
      addElement(addElement(addElement(addElement(firstSlide, text), image), shape), line),
      text.id,
      {
        x: 120,
        y: 140,
        width: 420,
        height: 112,
        rotation: 15,
        zIndex: 10,
        locked: true
      }
    )

    const secondSlide = addElement(
      createSlide('slide-002', 'Second Slide'),
      createTextElement('text-002', { x: 120, y: 120, width: 420, height: 100 }, 'Second page')
    )
    const manifest: ProjectManifest = {
      ...created.manifest,
      slides: [...created.manifest.slides, createSlideRef(secondSlide.id, secondSlide.title)]
    }

    await request<ProjectManifest>('PUT', '/api/projects/manifest', { projectPath, manifest })
    await request<SlideDocument>('PUT', `/api/projects/slides/${editedFirstSlide.id}`, {
      projectPath,
      slide: editedFirstSlide
    })
    await request<SlideDocument>('PUT', `/api/projects/slides/${secondSlide.id}`, {
      projectPath,
      slide: secondSlide
    })

    const firstHtml = await fs.readFile(path.join(projectPath, 'slides', `${editedFirstSlide.id}.html`), 'utf8')
    const secondHtml = await fs.readFile(path.join(projectPath, 'slides', `${secondSlide.id}.html`), 'utf8')
    expect(firstHtml).toContain('data-ppht-slide-model')
    expect(secondHtml).toContain('data-ppht-slide-model')
    expect(parseSlideHtml(firstHtml).elements).toHaveLength(4)
    expect(parseSlideHtml(secondHtml).elements).toHaveLength(1)

    const reopened = await request<OpenProjectResult>('POST', '/api/projects/open', { projectPath })
    expect(reopened.manifest.slides.map((slide) => slide.id)).toEqual([editedFirstSlide.id, secondSlide.id])
    expect(reopened.slides[0]?.elements.map((element) => element.type)).toEqual(['text', 'image', 'shape', 'line'])
    expect(reopened.slides[0]?.elements.find((element) => element.id === text.id)).toMatchObject({
      x: 120,
      y: 140,
      width: 420,
      height: 112,
      rotation: 15,
      zIndex: 10,
      locked: true
    })

    const selfContainedPath = path.join(root, 'demo-full.html')
    const cleanPath = path.join(root, 'demo-clean.html')
    await request<{ outputPath: string }>('POST', '/api/projects/export', {
      projectPath,
      outputPath: selfContainedPath,
      mode: 'self-contained'
    })
    await request<{ outputPath: string }>('POST', '/api/projects/export', {
      projectPath,
      outputPath: cleanPath,
      mode: 'clean'
    })

    const selfContainedHtml = await fs.readFile(selfContainedPath, 'utf8')
    const cleanHtml = await fs.readFile(cleanPath, 'utf8')
    expect(selfContainedHtml).toContain('data-ppht-project-model')
    expect(selfContainedHtml).toContain('Edited text')
    expect(selfContainedHtml).toContain('Second page')
    expect(selfContainedHtml).toContain('class="ppht-player"')
    expect(selfContainedHtml).toContain('aria-label="Fullscreen"')
    expect(selfContainedHtml).toContain('pointerdown')
    expect(cleanHtml).not.toContain('data-ppht-project-model')
    expect(cleanHtml).not.toContain('data-ppht-element-id')
    expect(cleanHtml).toContain('Edited text')
    expect(cleanHtml).toContain('Second page')
    expect(cleanHtml).toContain('class="ppht-player"')
    expect(cleanHtml).toContain('ppht-slide-enter')
    expect(cleanHtml).toContain('@media (max-width: 760px)')
  })
})
