import cors from 'cors'
import express, { type ErrorRequestHandler, type RequestHandler } from 'express'
import { z, ZodError } from 'zod'
import type { ProjectManifest, SlideDocument } from '@ppht/core'
import { exportDeck } from './exportService.js'
import { ProjectError } from './errors.js'
import { createProject, openProject, saveProject, saveSlide } from './projectService.js'

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

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next)
  }
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

  response.status(500).json({ error: 'Internal server error' })
}

export function createApi() {
  const app = express()

  app.use(
    cors({
      origin: 'http://127.0.0.1:5173'
    })
  )
  app.use(express.json())

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

  app.use(errorHandler)

  return app
}
