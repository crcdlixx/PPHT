import fs from 'node:fs/promises'
import path from 'node:path'
import {
  createSlideRef,
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

export type CompatibilityReport = {
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

export type ImportSlideHtmlResult = OpenProjectResult & {
  compatibilityReport: CompatibilityReport
}

const projectDirectories = ['slides', 'assets/images', 'assets/fonts', 'assets/media', 'thumbs']
const safeSlideIdPattern = /^slide-[A-Za-z0-9_-]+$/

function manifestPath(projectPath: string): string {
  return path.join(projectPath, 'project.json')
}

function resolveProjectPath(projectPath: string): string {
  return path.resolve(projectPath)
}

function assertInsideProject(projectRoot: string, candidatePath: string): void {
  const relativePath = path.relative(projectRoot, candidatePath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new ProjectError('Project path escapes project directory', 400)
  }
}

function isInsideDirectory(directory: string, candidatePath: string): boolean {
  const relativePath = path.relative(directory, candidatePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

function assertSafeSlideId(slideId: string): void {
  if (!safeSlideIdPattern.test(slideId)) {
    throw new ProjectError('Unsafe slide id', 400)
  }
}

function resolveSlideRefPath(projectPath: string, slideHtmlPath: string): string {
  if (typeof slideHtmlPath !== 'string') {
    throw new ProjectError('Invalid slide HTML path', 400)
  }

  const pathParts = slideHtmlPath.split(/[\\/]/)
  if (
    pathParts.length !== 2 ||
    pathParts[0] !== 'slides' ||
    pathParts[1] === undefined ||
    pathParts[1] === '' ||
    pathParts[1].includes('..') ||
    !pathParts[1].endsWith('.html')
  ) {
    throw new ProjectError('Invalid slide HTML path', 400)
  }

  const projectRoot = resolveProjectPath(projectPath)
  const slidePath = path.resolve(projectRoot, pathParts[0], pathParts[1])
  assertInsideProject(projectRoot, slidePath)
  return slidePath
}

function resolveProjectRefPath(projectPath: string, refPath: string, invalidMessage: string): string {
  if (typeof refPath !== 'string' || refPath.trim() === '' || path.isAbsolute(refPath)) {
    throw new ProjectError(invalidMessage, 400)
  }

  const projectRoot = resolveProjectPath(projectPath)
  const resolvedPath = path.resolve(projectRoot, refPath)
  assertInsideProject(projectRoot, resolvedPath)
  return resolvedPath
}

function resolveImportHtmlPath(projectPath: string, htmlFilePath: string): string {
  if (typeof htmlFilePath !== 'string' || htmlFilePath.trim() === '') {
    throw new ProjectError('Invalid import HTML path', 400)
  }

  const projectRoot = resolveProjectPath(projectPath)
  const projectParent = path.dirname(projectRoot)
  const resolvedPath = path.resolve(htmlFilePath)

  if (!isInsideDirectory(projectRoot, resolvedPath) && !isInsideDirectory(projectParent, resolvedPath)) {
    throw new ProjectError('Import HTML path cannot be outside the project directory or project parent directory', 400)
  }

  return resolvedPath
}

function parseImportedSlideHtml(html: string): SlideDocument {
  try {
    return parseSlideHtml(html)
  } catch (error) {
    if (error instanceof Error && /Missing PPHT slide model/i.test(error.message)) {
      throw new ProjectError('Missing PPHT slide model', 400)
    }

    throw new ProjectError('Invalid PPHT slide model', 400)
  }
}

function nextImportedSlideId(manifest: ProjectManifest, sourceSlideId: string): string {
  const usedIds = new Set([...manifest.slides.map((slide) => slide.id), sourceSlideId])

  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `slide-${String(index).padStart(3, '0')}`
    if (!usedIds.has(candidate)) {
      return candidate
    }
  }

  throw new ProjectError('Could not allocate slide id', 400)
}

function escapeSvgText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function thumbnailSvg(slide: SlideDocument): string {
  const title = escapeSvgText(slide.title)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <rect width="320" height="180" rx="10" fill="#f8fafc"/>
  <rect x="12" y="12" width="296" height="156" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  <text x="160" y="94" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif" font-size="22" font-weight="700" fill="#1f2937">${title}</text>
</svg>
`
}

async function writeSlideThumbnail(projectPath: string, thumbnailPath: string, slide: SlideDocument): Promise<void> {
  const resolvedThumbnailPath = resolveProjectRefPath(projectPath, thumbnailPath, 'Invalid slide thumbnail path')
  await fs.mkdir(path.dirname(resolvedThumbnailPath), { recursive: true })
  await fs.writeFile(resolvedThumbnailPath, thumbnailSvg(slide), 'utf8')
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
        thumbnail: 'thumbs/slide-001.svg'
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
  await writeSlideThumbnail(projectPath, manifest.slides[0]?.thumbnail ?? `thumbs/${slide.id}.svg`, slide)

  return {
    manifest,
    slides: [slide]
  }
}

export async function openProject(projectPath: string): Promise<OpenProjectResult> {
  const manifest = await readManifest(projectPath)
  const slides = await Promise.all(
    manifest.slides.map(async (slideRef) => {
      const html = await fs.readFile(resolveSlideRefPath(projectPath, slideRef.html), 'utf8')
      const slide = parseSlideHtml(html)
      if (slide.id !== slideRef.id) {
        throw new ProjectError('Slide id does not match manifest', 400)
      }

      return slide
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
  assertSafeSlideId(slideId)
  if (slide.id !== slideId) {
    throw new ProjectError('Slide id mismatch', 400)
  }

  const manifest = await readManifest(projectPath)
  const slideRef = manifest.slides.find((candidate) => candidate.id === slideId)
  if (!slideRef) {
    throw new ProjectError('Unknown slide id', 404)
  }

  await fs.mkdir(path.join(projectPath, 'slides'), { recursive: true })
  await fs.writeFile(resolveSlideRefPath(projectPath, slideRef.html), serializeSlideToHtml(slide), 'utf8')
  await writeSlideThumbnail(projectPath, slideRef.thumbnail, slide)

  slideRef.title = slide.title

  await saveProject(projectPath, manifest)
  return slide
}

export async function importSlideHtml(projectPath: string, htmlFilePath: string): Promise<ImportSlideHtmlResult> {
  const sourcePath = resolveImportHtmlPath(projectPath, htmlFilePath)
  const manifest = await readManifest(projectPath)
  const html = await fs.readFile(sourcePath, 'utf8')
  const sourceSlide = parseImportedSlideHtml(html)
  const slideId = nextImportedSlideId(manifest, sourceSlide.id)
  const importedSlide: SlideDocument = {
    ...sourceSlide,
    id: slideId
  }
  const importedRef = createSlideRef(importedSlide.id, importedSlide.title)
  const updatedManifest: ProjectManifest = {
    ...manifest,
    slides: [...manifest.slides.map((slide) => ({ ...slide })), importedRef]
  }

  await ensureProjectDirectories(projectPath)
  await fs.writeFile(resolveSlideRefPath(projectPath, importedRef.html), serializeSlideToHtml(importedSlide), 'utf8')
  await writeSlideThumbnail(projectPath, importedRef.thumbnail, importedSlide)
  await saveProject(projectPath, updatedManifest)

  return {
    ...(await openProject(projectPath)),
    compatibilityReport: {
      imported: [
        {
          type: 'slide',
          sourcePath,
          id: importedSlide.id,
          title: importedSlide.title
        }
      ],
      skipped: []
    }
  }
}
