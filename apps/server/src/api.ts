import cors from 'cors'
import express, { type ErrorRequestHandler, type RequestHandler } from 'express'
import { z, ZodError } from 'zod'
import type { ProjectManifest, SlideDocument } from '@ppht/core'
import { suggestSlideEdit } from './aiService.js'
import { exportDeck } from './exportService.js'
import { ProjectError } from './errors.js'
import { createProject, importSlideHtml, openProject, saveProject, saveSlide } from './projectService.js'

const projectPathSchema = z.string().min(1)
const titleSchema = z.string().min(1)
const outputPathSchema = z.string().min(1)
const exportModeSchema = z.enum(['self-contained', 'clean'])
const slideIdParamSchema = z.object({
  slideId: z.string().min(1)
})

const createProjectBodySchema = z.object({
  projectPath: projectPathSchema,
  title: titleSchema
})

const openProjectBodySchema = z.object({
  projectPath: projectPathSchema
})

const saveProjectBodySchema = z.object({
  projectPath: projectPathSchema,
  manifest: z.unknown()
})

const saveSlideBodySchema = z.object({
  projectPath: projectPathSchema,
  slide: z.unknown()
})

const exportProjectBodySchema = z.object({
  projectPath: projectPathSchema,
  outputPath: outputPathSchema,
  mode: exportModeSchema
})

const importHtmlBodySchema = z.object({
  projectPath: projectPathSchema,
  htmlFilePath: z.string().min(1)
})

const suggestAiBodySchema = z.object({
  manifest: z.unknown(),
  slide: z.unknown(),
  slideHtml: z.string(),
  instruction: z.string().min(1)
})

export type CreateApiOptions = {
  jsonLimit?: string | number
}

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined
  }

  const status = 'status' in error ? error.status : undefined
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return status
  }

  const statusCode = 'statusCode' in error ? error.statusCode : undefined
  if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 600) {
    return statusCode
  }

  return undefined
}

function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }

  return 'Request failed'
}

const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ProjectError) {
    response.status(error.statusCode).json({ error: error.message })
    return
  }

  if (error instanceof ZodError) {
    response.status(400).json({ error: 'Invalid request', issues: error.issues })
    return
  }

  const status = errorStatus(error)
  if (status !== undefined) {
    response.status(status).json({ error: errorMessage(error) })
    return
  }

  response.status(500).json({ error: 'Internal server error' })
}

export function createApi(options: CreateApiOptions = {}) {
  const app = express()

  app.use(
    cors({
      origin: 'http://127.0.0.1:5173'
    })
  )
  app.use(express.json({ limit: options.jsonLimit ?? '50mb' }))

  app.post(
    '/api/projects',
    asyncHandler(async (request, response) => {
      const body = createProjectBodySchema.parse(request.body)
      response.json(await createProject(body.projectPath, body.title))
    })
  )

  app.post(
    '/api/projects/open',
    asyncHandler(async (request, response) => {
      const body = openProjectBodySchema.parse(request.body)
      response.json(await openProject(body.projectPath))
    })
  )

  app.put(
    '/api/projects/manifest',
    asyncHandler(async (request, response) => {
      const body = saveProjectBodySchema.parse(request.body)
      response.json(await saveProject(body.projectPath, body.manifest as ProjectManifest))
    })
  )

  app.put(
    '/api/projects/slides/:slideId',
    asyncHandler(async (request, response) => {
      const params = slideIdParamSchema.parse(request.params)
      const body = saveSlideBodySchema.parse(request.body)
      response.json(await saveSlide(body.projectPath, params.slideId, body.slide as SlideDocument))
    })
  )

  app.post(
    '/api/projects/export',
    asyncHandler(async (request, response) => {
      const body = exportProjectBodySchema.parse(request.body)
      const outputPath = await exportDeck(body.projectPath, body.outputPath, body.mode)
      response.json({ outputPath })
    })
  )

  app.post(
    '/api/projects/import/html',
    asyncHandler(async (request, response) => {
      const body = importHtmlBodySchema.parse(request.body)
      response.json(await importSlideHtml(body.projectPath, body.htmlFilePath))
    })
  )

  app.post(
    '/api/ai/suggest',
    asyncHandler(async (request, response) => {
      const body = suggestAiBodySchema.parse(request.body)
      response.json(
        suggestSlideEdit({
          manifest: body.manifest as ProjectManifest,
          slide: body.slide as SlideDocument,
          slideHtml: body.slideHtml,
          instruction: body.instruction
        })
      )
    })
  )

  app.use(errorHandler)

  return app
}
