import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApi } from '../src/api.js'

describe('api', () => {
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
})
