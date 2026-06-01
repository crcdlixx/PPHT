import fs from 'node:fs/promises'
import path from 'node:path'
import {
  createSlide,
  parseSlideHtml,
  serializeSlideToHtml,
  type ProjectManifest,
  type SlideDocument
} from '@ppht/core'
import { ProjectError } from './errors.js'

export type OpenProjectResult = {
  manifest: ProjectManifest
  slides: SlideDocument[]
}

const projectDirectories = ['slides', 'assets/images', 'assets/fonts', 'assets/media', 'thumbs']

function manifestPath(projectPath: string): string {
  return path.join(projectPath, 'project.json')
}

async function ensureProjectDirectories(projectPath: string): Promise<void> {
  await fs.mkdir(projectPath, { recursive: true })
  await Promise.all(projectDirectories.map((directory) => fs.mkdir(path.join(projectPath, directory), { recursive: true })))
}

async function readManifest(projectPath: string): Promise<ProjectManifest> {
  try {
    const manifestJson = await fs.readFile(manifestPath(projectPath), 'utf8')
    return JSON.parse(manifestJson) as ProjectManifest
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
      throw new ProjectError('Missing project.json', 404)
    }

    throw error
  }
}

export async function createProject(projectPath: string, title: string): Promise<OpenProjectResult> {
  await ensureProjectDirectories(projectPath)

  const slide = createSlide('slide-001', title)
  const manifest: ProjectManifest = {
    version: '1.0.0',
    title,
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
        thumbnail: 'thumbs/slide-001.png'
      }
    ],
    theme: {
      fonts: [],
      colors: []
    },
    assets: []
  }

  await saveProject(projectPath, manifest)
  await fs.writeFile(path.join(projectPath, 'slides', `${slide.id}.html`), serializeSlideToHtml(slide), 'utf8')

  return {
    manifest,
    slides: [slide]
  }
}

export async function openProject(projectPath: string): Promise<OpenProjectResult> {
  const manifest = await readManifest(projectPath)
  const slides = await Promise.all(
    manifest.slides.map(async (slideRef) => {
      const html = await fs.readFile(path.join(projectPath, slideRef.html), 'utf8')
      return parseSlideHtml(html)
    })
  )

  return {
    manifest,
    slides
  }
}

export async function saveProject(projectPath: string, manifest: ProjectManifest): Promise<ProjectManifest> {
  await ensureProjectDirectories(projectPath)
  await fs.writeFile(manifestPath(projectPath), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return manifest
}

export async function saveSlide(projectPath: string, slideId: string, slide: SlideDocument): Promise<SlideDocument> {
  const manifest = await readManifest(projectPath)
  await fs.mkdir(path.join(projectPath, 'slides'), { recursive: true })
  await fs.writeFile(path.join(projectPath, 'slides', `${slideId}.html`), serializeSlideToHtml(slide), 'utf8')

  const slideRef = manifest.slides.find((candidate) => candidate.id === slideId)
  if (slideRef) {
    slideRef.title = slide.title
  }

  await saveProject(projectPath, manifest)
  return slide
}
