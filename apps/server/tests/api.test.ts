import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createSlide, createTextElement, serializeSlideToHtml } from '@ppht/core'
import { createApi } from '../src/api.js'

describe('api', () => {
  let server: http.Server
  let baseUrl: string

  async function startApi(options?: Parameters<typeof createApi>[0]) {
    server = createApi(options).listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address()
    if (typeof address !== 'object' || address === null) {
      throw new Error('Expected server address')
    }
    baseUrl = `http://127.0.0.1:${address.port}`
  }

  beforeEach(async () => {
    await startApi()
  })

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })

  async function createTempProjectPath() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ppht-api-'))
    return {
      root,
      projectPath: path.join(root, 'demo.ppht')
    }
  }

  async function request(method: string, route: string, body: unknown) {
    const response = await fetch(`${baseUrl}${route}`, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
    const contentType = response.headers.get('content-type') ?? ''
    const json = contentType.includes('application/json') ? ((await response.json()) as unknown) : await response.text()
    return { response, json }
  }

  async function rawJsonRequest(route: string, body: string) {
    const response = await fetch(`${baseUrl}${route}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body
    })
    const json = (await response.json()) as unknown
    return { response, json }
  }

  it('creates, opens, and exports a project', async () => {
    const { root, projectPath } = await createTempProjectPath()

    const created = await request('POST', '/api/projects', {
      projectPath,
      title: 'API Deck'
    })
    expect(created.response.status).toBe(200)
    expect(created.json).toMatchObject({
      manifest: {
        title: 'API Deck'
      }
    })

    const opened = await request('POST', '/api/projects/open', { projectPath })
    expect(opened.response.status).toBe(200)
    expect(opened.json).toMatchObject({
      manifest: {
        title: 'API Deck'
      }
    })

    const outputPath = path.join(root, 'api-export.html')
    const exported = await request('POST', '/api/projects/export', {
      projectPath,
      outputPath,
      mode: 'clean'
    })
    expect(exported.response.status).toBe(200)
    expect(exported.json).toEqual({ outputPath })
    await expect(fs.readFile(outputPath, 'utf8')).resolves.toContain('API Deck')
  })

  it('imports a PPHT-authored slide HTML file through the project import endpoint', async () => {
    const { root, projectPath } = await createTempProjectPath()
    await request('POST', '/api/projects', {
      projectPath,
      title: 'API Deck'
    })
    const htmlFilePath = path.join(root, 'imported.html')
    await fs.writeFile(htmlFilePath, serializeSlideToHtml(createSlide('slide-source', 'Imported API Slide')), 'utf8')

    const result = await request('POST', '/api/projects/import/html', {
      projectPath,
      htmlFilePath
    })

    expect(result.response.status).toBe(200)
    expect(result.json).toMatchObject({
      manifest: {
        slides: [
          { id: 'slide-001' },
          {
            title: 'Imported API Slide'
          }
        ]
      },
      compatibilityReport: {
        imported: [
          {
            type: 'slide',
            sourcePath: path.resolve(htmlFilePath),
            title: 'Imported API Slide'
          }
        ],
        skipped: []
      }
    })
  })

  it('maps missing PPHT slide model import errors to 400', async () => {
    const { root, projectPath } = await createTempProjectPath()
    await request('POST', '/api/projects', {
      projectPath,
      title: 'API Deck'
    })
    const htmlFilePath = path.join(root, 'missing-model.html')
    await fs.writeFile(htmlFilePath, '<!doctype html><html><body>No model here</body></html>', 'utf8')

    const result = await request('POST', '/api/projects/import/html', {
      projectPath,
      htmlFilePath
    })

    expect(result.response.status).toBe(400)
    expect(result.json).toMatchObject({
      error: expect.stringMatching(/PPHT slide model/i)
    })
  })

  it('returns a deterministic AI suggestion without requiring files', async () => {
    const slide = {
      ...createSlide('slide-001', 'Intro'),
      elements: [createTextElement('text-001', { x: 80, y: 100, width: 360, height: 90 }, 'Old copy')]
    }
    const manifest = {
      version: '1.0.0',
      title: 'AI Deck',
      canvas: {
        width: 1280,
        height: 720,
        ratio: '16:9'
      },
      slides: [
        {
          id: slide.id,
          title: slide.title,
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

    const result = await request('POST', '/api/ai/suggest', {
      manifest,
      slide,
      slideHtml: serializeSlideToHtml(slide),
      instruction: 'text: make the copy clearer'
    })

    expect(result.response.status).toBe(200)
    expect(result.json).toMatchObject({
      summary: expect.any(String),
      beforeSlide: slide,
      afterSlide: {
        id: slide.id,
        elements: [
          {
            id: 'text-001',
            type: 'text',
            content: {
              text: expect.stringContaining('make the copy clearer')
            }
          }
        ]
      },
      changedElementIds: ['text-001']
    })
  })

  it('maps zod validation errors to 400', async () => {
    const result = await request('POST', '/api/projects/export', {
      projectPath: 'demo.ppht',
      outputPath: 'demo.html',
      mode: 'invalid'
    })

    expect(result.response.status).toBe(400)
    expect(result.json).toMatchObject({
      error: 'Invalid request'
    })
  })

  it('maps project errors to their status code', async () => {
    const { projectPath } = await createTempProjectPath()

    const result = await request('POST', '/api/projects/open', { projectPath })

    expect(result.response.status).toBe(404)
    expect(result.json).toEqual({
      error: 'Missing project.json'
    })
  })

  it('maps malformed json parser errors to 400', async () => {
    const result = await rawJsonRequest('/api/projects/open', '{"projectPath":')

    expect(result.response.status).toBe(400)
    expect(result.json).toEqual({
      error: 'Unexpected end of JSON input'
    })
  })

  it('maps oversized json parser errors to 413', async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
    await startApi({ jsonLimit: '1b' })

    const result = await rawJsonRequest('/api/projects/open', '{"projectPath":"demo.ppht"}')

    expect(result.response.status).toBe(413)
    expect(result.json).toEqual({
      error: 'request entity too large'
    })
  })
})
