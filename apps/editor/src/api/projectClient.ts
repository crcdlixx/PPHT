import type { ProjectManifest, SlideDocument } from '@ppht/core'

export type OpenProjectResult = {
  projectPath: string
  manifest: ProjectManifest
  slides: SlideDocument[]
}

export type ExportDeckMode = 'self-contained' | 'clean'

type ErrorResponseBody = {
  error?: string
  message?: string
}

function errorMessage(body: ErrorResponseBody, fallback: string): string {
  return body.error ?? body.message ?? fallback
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined)
  }

  const response = await fetch(url, {
    ...init,
    headers
  })

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorResponseBody
    throw new Error(errorMessage(body, `Request failed with status ${response.status}`))
  }

  return response.json() as Promise<T>
}

export const projectClient = {
  createProject(projectPath: string, title: string) {
    return request<OpenProjectResult>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ projectPath, title })
    })
  },

  openProject(projectPath: string) {
    return request<OpenProjectResult>('/api/projects/open', {
      method: 'POST',
      body: JSON.stringify({ projectPath })
    })
  },

  saveSlide(projectPath: string, slide: SlideDocument) {
    return request<SlideDocument>(`/api/projects/slides/${encodeURIComponent(slide.id)}`, {
      method: 'PUT',
      body: JSON.stringify({ projectPath, slide })
    })
  },

  saveProject(projectPath: string, manifest: ProjectManifest) {
    return request<ProjectManifest>('/api/projects/manifest', {
      method: 'PUT',
      body: JSON.stringify({ projectPath, manifest })
    })
  },

  exportDeck(projectPath: string, outputPath: string, mode: ExportDeckMode) {
    return request<{ outputPath: string }>('/api/projects/export', {
      method: 'POST',
      body: JSON.stringify({ projectPath, outputPath, mode })
    })
  }
}
