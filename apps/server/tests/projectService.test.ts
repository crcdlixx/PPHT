import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createProject, openProject, saveSlide } from '../src/projectService.js'

describe('projectService', () => {
  it('creates, opens, and saves a ppht project', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ppht-'))
    const projectPath = path.join(root, 'demo.ppht')

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
})
