import fs from 'node:fs/promises'
import path from 'node:path'
import { serializeSlideToHtml, type ProjectManifest } from '@ppht/core'
import { openProject } from './projectService.js'

export type ExportMode = 'self-contained' | 'clean'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function escapeAttribute(value: string): string {
  return escapeHtml(value)
}

function escapeJsonForScript(value: string): string {
  return value.replace(/<\/script/gi, '<\\/script')
}

function unescapeAttribute(value: string): string {
  return value
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}

function extractSlideRoot(slideHtml: string): string {
  const match = slideHtml.match(/<main\b(?=[^>]*\bdata-ppht-slide-root\b)[\s\S]*?<\/main>/i)
  if (!match) {
    throw new Error('Serialized slide is missing a slide root')
  }

  return match[0]
}

function isInsideDirectory(directory: string, candidatePath: string): boolean {
  const relativePath = path.relative(directory, candidatePath)
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

async function assertHtmlOutputPath(projectPath: string, outputPath: string): Promise<string> {
  const resolvedOutputPath = path.resolve(outputPath)
  const projectRoot = path.resolve(projectPath)
  const projectParent = path.dirname(projectRoot)

  if (!isInsideDirectory(projectRoot, resolvedOutputPath) && !isInsideDirectory(projectParent, resolvedOutputPath)) {
    throw new Error('Export output path cannot be outside the project directory or project parent directory')
  }

  try {
    const stats = await fs.stat(resolvedOutputPath)
    if (stats.isDirectory()) {
      throw new Error('Export output path cannot be a directory')
    }
  } catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) {
      throw error
    }
  }

  if (path.extname(resolvedOutputPath).toLowerCase() !== '.html') {
    throw new Error('Export output path must be an .html file')
  }

  return resolvedOutputPath
}

function assertCanvasDimensions(width: unknown, height: unknown): asserts width is number {
  if (
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('Project canvas dimensions must be finite positive numbers')
  }
}

function mimeTypeForPath(resourcePath: string): string {
  switch (path.extname(resourcePath).toLowerCase()) {
    case '.apng':
      return 'image/apng'
    case '.avif':
      return 'image/avif'
    case '.gif':
      return 'image/gif'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.svg':
      return 'image/svg+xml'
    case '.webp':
      return 'image/webp'
    case '.woff':
      return 'font/woff'
    case '.woff2':
      return 'font/woff2'
    case '.ttf':
      return 'font/ttf'
    case '.otf':
      return 'font/otf'
    case '.mp3':
      return 'audio/mpeg'
    case '.mp4':
      return 'video/mp4'
    case '.ogg':
      return 'audio/ogg'
    case '.wav':
      return 'audio/wav'
    case '.webm':
      return 'video/webm'
    default:
      return 'application/octet-stream'
  }
}

function shouldSkipResource(resource: string): boolean {
  const trimmed = resource.trim()
  return (
    trimmed === '' ||
    trimmed.startsWith('#') ||
    /^(?:data|https?|blob|about|mailto|tel):/i.test(trimmed) ||
    trimmed.startsWith('//')
  )
}

function stripResourceDecorators(resource: string): string {
  const trimmed = unescapeAttribute(resource).trim()
  const quoted =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))

  return quoted ? trimmed.slice(1, -1) : trimmed
}

function resolveProjectResource(projectRoot: string, manifest: ProjectManifest, resource: string): string {
  const resourcePath = resource.split(/[?#]/, 1)[0] ?? ''
  const assetPath = manifest.assets.find((asset) => asset.id === resourcePath)?.path ?? resourcePath
  const resolvedPath = path.resolve(projectRoot, assetPath)

  if (!isInsideDirectory(projectRoot, resolvedPath)) {
    throw new Error('Export resource path escapes project directory')
  }

  return resolvedPath
}

async function resourceToDataUrl(resourcePath: string): Promise<string> {
  const data = await fs.readFile(resourcePath)
  return `data:${mimeTypeForPath(resourcePath)};base64,${data.toString('base64')}`
}

async function inlineProjectResources(markup: string, projectRoot: string, manifest: ProjectManifest): Promise<string> {
  const replacements = new Map<string, string>()
  const resourcePattern = /\bsrc="([^"]*)"|url\(\s*(?:"([^"]*)"|'([^']*)'|([^'")\s]+))\s*\)/gi
  const resources = Array.from(markup.matchAll(resourcePattern))

  await Promise.all(
    resources.map(async (match) => {
      const rawResource = match[1] ?? match[2] ?? match[3] ?? match[4]
      if (rawResource === undefined) {
        return
      }

      const resource = stripResourceDecorators(rawResource)
      if (shouldSkipResource(resource) || replacements.has(resource)) {
        return
      }

      const resourcePath = resolveProjectResource(projectRoot, manifest, resource)
      replacements.set(resource, await resourceToDataUrl(resourcePath))
    })
  )

  return markup.replace(resourcePattern, (match, srcResource, doubleQuotedUrl, singleQuotedUrl, bareUrl) => {
    const rawResource = srcResource ?? doubleQuotedUrl ?? singleQuotedUrl ?? bareUrl
    if (rawResource === undefined) {
      return match
    }

    const resource = stripResourceDecorators(rawResource)
    const replacement = replacements.get(resource)
    if (replacement === undefined) {
      return match
    }

    if (srcResource !== undefined) {
      return `src="${escapeAttribute(replacement)}"`
    }

    return rawResource.includes('&quot;') || rawResource.includes('&#39;')
      ? `url(&quot;${escapeAttribute(replacement)}&quot;)`
      : `url("${replacement}")`
  })
}

function convertSlideRootToDiv(slideRoot: string): string {
  return slideRoot
    .replace(/^<main\b([^>]*)>/i, (_match, attributes: string) => `<div class="ppht-slide-root"${attributes}>`)
    .replace(/<\/main>\s*$/i, '</div>')
}

function stripCleanMetadata(markup: string): string {
  return markup
    .replace(/\sdata-ppht-[\w-]+="[^"]*"/g, '')
    .replace(/\sdata-ppht-[\w-]+='[^']*'/g, '')
    .replace(/\sdata-ppht-[\w-]+(?=[\s>])/g, '')
}

export async function exportDeck(projectPath: string, outputPath: string, mode: ExportMode): Promise<string> {
  const resolvedOutputPath = await assertHtmlOutputPath(projectPath, outputPath)
  const project = await openProject(projectPath)
  const width = project.manifest.canvas.width
  const height = project.manifest.canvas.height
  assertCanvasDimensions(width, height)

  const projectRoot = path.resolve(projectPath)
  const slidesHtml = (
    await Promise.all(
      project.slides.map(async (slide, index) => {
        const serializedRoot = convertSlideRootToDiv(extractSlideRoot(serializeSlideToHtml(slide)))
        const resourceReadyRoot =
          mode === 'self-contained'
            ? await inlineProjectResources(serializedRoot, projectRoot, project.manifest)
            : serializedRoot
        const slideRoot = mode === 'clean' ? stripCleanMetadata(resourceReadyRoot) : resourceReadyRoot

        return `<section class="ppht-slide" aria-label="${escapeAttribute(slide.title)}" data-slide-index="${index}"${
          index === 0 ? '' : ' hidden'
        }>
        ${slideRoot}
      </section>`
      })
    )
  ).join('\n')
  const projectModel =
    mode === 'self-contained'
      ? `\n    <script type="application/json" data-ppht-project-model>${escapeJsonForScript(JSON.stringify(project))}</script>`
      : ''

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(project.manifest.title)}</title>
    <style>
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #111;
        overflow: hidden;
      }

      body {
        display: grid;
        place-items: center;
        font-family: system-ui, sans-serif;
      }

      .ppht-stage {
        width: ${width}px;
        height: ${height}px;
        transform-origin: center center;
      }

      .ppht-slide {
        width: ${width}px;
        height: ${height}px;
      }

      .ppht-slide[hidden] {
        display: none;
      }

      .ppht-slide-root {
        box-sizing: border-box;
      }

      .ppht-slide-root,
      .ppht-slide-root *,
      .ppht-slide-root *::before,
      .ppht-slide-root *::after {
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <main class="ppht-stage">
      ${slidesHtml}
    </main>${projectModel}
    <script>
      (() => {
        const stage = document.querySelector('.ppht-stage');
        const slides = Array.from(document.querySelectorAll('.ppht-slide'));
        let current = 0;

        function scaleStage() {
          const scale = Math.min(window.innerWidth / ${width}, window.innerHeight / ${height});
          stage.style.transform = \`scale(\${scale})\`;
        }

        function showSlide(index) {
          current = Math.max(0, Math.min(slides.length - 1, index));
          slides.forEach((slide, slideIndex) => {
            slide.hidden = slideIndex !== current;
          });
        }

        window.addEventListener('resize', scaleStage);
        window.addEventListener('keydown', (event) => {
          if (['ArrowRight', 'PageDown', ' '].includes(event.key)) {
            event.preventDefault();
            showSlide(current + 1);
          } else if (['ArrowLeft', 'PageUp'].includes(event.key)) {
            event.preventDefault();
            showSlide(current - 1);
          } else if (event.key === 'Home') {
            event.preventDefault();
            showSlide(0);
          } else if (event.key === 'End') {
            event.preventDefault();
            showSlide(slides.length - 1);
          }
        });

        scaleStage();
        showSlide(0);
      })();
    </script>
  </body>
</html>`

  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true })
  await fs.writeFile(resolvedOutputPath, html, 'utf8')
  return outputPath
}
