import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createSlide, serializeSlideToHtml } from '@ppht/core'
import { ProjectError } from '../src/errors.js'
import { createProject, openProject, saveSlide } from '../src/projectService.js'

describe('projectService', () => {
  async function createTempProjectPath() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ppht-'))
    return path.join(root, 'demo.ppht')
  }

  it('creates, opens, and saves a ppht project', async () => {
    const projectPath = await createTempProjectPath()

    const project = await createProject(projectPath, 'Demo Deck')
    expect(project.manifest.title).toBe('Demo Deck')
    expect(project.manifest.slides).toHaveLength(1)

    const firstSlide = project.slides[0]
    if (!firstSlide) throw new Error('Expected first slide')

    const saved = await saveSlide(projectPath, firstSlide.id, {
      ...firstSlide,
      title: 'Updated'
    })
    expect(saved.title).toBe('Updated')

    const reopened = await openProject(projectPath)
    expect(reopened.manifest.slides[0]?.id).toBe(firstSlide.id)
    expect(reopened.slides[0]?.title).toBe('Updated')
  })

  it('throws a 404 ProjectError when project.json is missing', async () => {
    const projectPath = await createTempProjectPath()

    await expect(openProject(projectPath)).rejects.toMatchObject({
      name: 'ProjectError',
      message: 'Missing project.json',
      statusCode: 404
    })
  })

  it('rejects manifest slide path traversal', async () => {
    const projectPath = await createTempProjectPath()
    const project = await createProject(projectPath, 'Demo Deck')
    const manifest = {
      ...project.manifest,
      slides: [
        {
          ...project.manifest.slides[0],
          html: '../escape.html'
        }
      ]
    }
    await fs.writeFile(path.join(projectPath, 'project.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

    await expect(openProject(projectPath)).rejects.toBeInstanceOf(ProjectError)
    await expect(openProject(projectPath)).rejects.toMatchObject({
      statusCode: 400
    })
  })

  it('rejects manifest slide ids that do not match parsed slide models', async () => {
    const projectPath = await createTempProjectPath()
    const project = await createProject(projectPath, 'Demo Deck')
    const firstRef = project.manifest.slides[0]
    if (!firstRef) throw new Error('Expected first slide ref')
    const manifest = {
      ...project.manifest,
      slides: [
        {
          ...firstRef,
          id: 'slide-manifest'
        }
      ]
    }
    await fs.writeFile(path.join(projectPath, 'project.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

    await expect(openProject(projectPath)).rejects.toMatchObject({
      name: 'ProjectError',
      statusCode: 400
    })
  })

  it('rejects unsafe slide ids when saving', async () => {
    const projectPath = await createTempProjectPath()
    const project = await createProject(projectPath, 'Demo Deck')
    const firstSlide = project.slides[0]
    if (!firstSlide) throw new Error('Expected first slide')

    await expect(saveSlide(projectPath, '../escape', { ...firstSlide, id: '../escape' })).rejects.toMatchObject({
      name: 'ProjectError',
      statusCode: 400
    })
  })

  it('rejects slide id mismatches when saving', async () => {
    const projectPath = await createTempProjectPath()
    const project = await createProject(projectPath, 'Demo Deck')
    const firstSlide = project.slides[0]
    if (!firstSlide) throw new Error('Expected first slide')

    await expect(saveSlide(projectPath, firstSlide.id, { ...firstSlide, id: 'slide-other' })).rejects.toMatchObject({
      name: 'ProjectError',
      statusCode: 400
    })
  })

  it('rejects unknown slide ids when saving', async () => {
    const projectPath = await createTempProjectPath()
    await createProject(projectPath, 'Demo Deck')

    await expect(saveSlide(projectPath, 'slide-unknown', createSlide('slide-unknown'))).rejects.toMatchObject({
      name: 'ProjectError',
      statusCode: 404
    })
  })

  it('saves slides to the manifest slide html path', async () => {
    const projectPath = await createTempProjectPath()
    const project = await createProject(projectPath, 'Demo Deck')
    const firstSlide = project.slides[0]
    const firstRef = project.manifest.slides[0]
    if (!firstSlide || !firstRef) throw new Error('Expected first slide')
    const customHtml = 'slides/custom.html'
    const manifest = {
      ...project.manifest,
      slides: [
        {
          ...firstRef,
          html: customHtml
        }
      ]
    }
    const customPath = path.join(projectPath, customHtml)
    await fs.writeFile(customPath, serializeSlideToHtml(firstSlide), 'utf8')
    await fs.writeFile(path.join(projectPath, 'project.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

    await saveSlide(projectPath, firstSlide.id, {
      ...firstSlide,
      title: 'Updated Custom'
    })

    const customFile = await fs.readFile(customPath, 'utf8')
    expect(customFile).toContain('Updated Custom')

    const reopened = await openProject(projectPath)
    expect(reopened.manifest.slides[0]?.html).toBe(customHtml)
    expect(reopened.slides[0]?.title).toBe('Updated Custom')
  })
})
