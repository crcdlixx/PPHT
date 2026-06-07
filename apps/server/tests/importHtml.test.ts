import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  addElement,
  createSlide,
  createTextElement,
  parseSlideHtml,
  serializeSlideToHtml,
  type ProjectManifest,
  type SlideDocument
} from '@ppht/core'
import { ProjectError } from '../src/errors.js'
import { createProject } from '../src/projectService.js'
import * as projectService from '../src/projectService.js'

type ImportSlideHtmlResult = {
  manifest: ProjectManifest
  slides: SlideDocument[]
  compatibilityReport: {
    imported: Array<{
      type: 'slide'
      sourcePath: string
      id: string
      title: string
    }>
    skipped: Array<{
      sourcePath: string
      reason: string
    }>
  }
}

type ImportSlideHtml = (projectPath: string, htmlFilePath: string) => Promise<ImportSlideHtmlResult>

describe('importSlideHtml', () => {
  async function createTempProjectPath() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ppht-import-'))
    return {
      root,
      projectPath: path.join(root, 'demo.ppht')
    }
  }

  function importSlideHtml(): ImportSlideHtml {
    const candidate = (projectService as { importSlideHtml?: ImportSlideHtml }).importSlideHtml
    if (!candidate) {
      throw new Error('Expected projectService.importSlideHtml to be exported')
    }

    return candidate
  }

  it('imports one PPHT-authored slide HTML file as a new slide with manifest, file, thumbnail, and report updates', async () => {
    const { root, projectPath } = await createTempProjectPath()
    const project = await createProject(projectPath, 'Demo Deck')
    const existingSlide = project.slides[0]
    if (!existingSlide) throw new Error('Expected existing slide')

    const sourceSlide = addElement(
      createSlide(existingSlide.id, 'Imported Slide'),
      createTextElement('text-imported', { x: 120, y: 140, width: 360, height: 90 }, 'Imported copy')
    )
    const htmlFilePath = path.join(root, 'imported.html')
    await fs.writeFile(htmlFilePath, serializeSlideToHtml(sourceSlide), 'utf8')

    const result = await importSlideHtml()(projectPath, htmlFilePath)

    expect(result.manifest.slides).toHaveLength(2)
    const importedRef = result.manifest.slides[1]
    if (!importedRef) throw new Error('Expected imported slide ref')
    expect(importedRef.id).not.toBe(existingSlide.id)
    expect(importedRef.title).toBe('Imported Slide')
    expect(importedRef.html).toBe(`slides/${importedRef.id}.html`)
    expect(importedRef.thumbnail).toBe(`thumbs/${importedRef.id}.svg`)
    expect(result.slides.map((slide) => slide.id)).toEqual([existingSlide.id, importedRef.id])
    expect(result.slides[1]).toMatchObject({
      id: importedRef.id,
      title: 'Imported Slide',
      elements: [{ id: 'text-imported', type: 'text' }]
    })

    const manifestJson = JSON.parse(await fs.readFile(path.join(projectPath, 'project.json'), 'utf8')) as ProjectManifest
    expect(manifestJson.slides.map((slide) => slide.id)).toEqual([existingSlide.id, importedRef.id])

    const slideFiles = (await fs.readdir(path.join(projectPath, 'slides'))).filter((file) => file.endsWith('.html'))
    expect(slideFiles).toHaveLength(2)
    expect(slideFiles).toEqual(expect.arrayContaining([`${existingSlide.id}.html`, `${importedRef.id}.html`]))

    const importedHtml = await fs.readFile(path.join(projectPath, importedRef.html), 'utf8')
    expect(parseSlideHtml(importedHtml)).toMatchObject({
      id: importedRef.id,
      title: 'Imported Slide'
    })

    const thumbnail = await fs.readFile(path.join(projectPath, importedRef.thumbnail), 'utf8')
    expect(thumbnail).toContain('Imported Slide')

    expect(result.compatibilityReport).toEqual({
      imported: [
        {
          type: 'slide',
          sourcePath: path.resolve(htmlFilePath),
          id: importedRef.id,
          title: 'Imported Slide'
        }
      ],
      skipped: []
    })
  })

  it('rejects HTML that does not contain a PPHT slide model without changing the project', async () => {
    const { root, projectPath } = await createTempProjectPath()
    const project = await createProject(projectPath, 'Demo Deck')
    const htmlFilePath = path.join(root, 'missing-model.html')
    await fs.writeFile(htmlFilePath, '<!doctype html><html><body>No model here</body></html>', 'utf8')

    await expect(importSlideHtml()(projectPath, htmlFilePath)).rejects.toMatchObject({
      name: 'ProjectError',
      statusCode: 400
    })

    const manifestJson = JSON.parse(await fs.readFile(path.join(projectPath, 'project.json'), 'utf8')) as ProjectManifest
    expect(manifestJson.slides).toEqual(project.manifest.slides)
    const slideFiles = (await fs.readdir(path.join(projectPath, 'slides'))).filter((file) => file.endsWith('.html'))
    expect(slideFiles).toEqual([`${project.slides[0]?.id}.html`])
  })

  it('rejects source HTML paths outside the project directory and project parent directory', async () => {
    const { projectPath } = await createTempProjectPath()
    await createProject(projectPath, 'Demo Deck')
    const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ppht-import-outside-'))
    const htmlFilePath = path.join(outsideRoot, 'outside.html')
    await fs.writeFile(htmlFilePath, serializeSlideToHtml(createSlide('slide-outside', 'Outside')), 'utf8')

    await expect(importSlideHtml()(projectPath, htmlFilePath)).rejects.toBeInstanceOf(ProjectError)
    await expect(importSlideHtml()(projectPath, htmlFilePath)).rejects.toMatchObject({
      statusCode: 400
    })
  })
})
