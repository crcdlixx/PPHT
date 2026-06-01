import fs from 'node:fs/promises'
import path from 'node:path'
import { serializeSlideToHtml } from '@ppht/core'
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

function extractSlideRoot(slideHtml: string): string {
  const match = slideHtml.match(/<main\b(?=[^>]*\bdata-ppht-slide-root\b)[\s\S]*?<\/main>/i)
  if (!match) {
    throw new Error('Serialized slide is missing a slide root')
  }

  return match[0]
}

async function assertHtmlOutputPath(outputPath: string): Promise<void> {
  try {
    const stats = await fs.stat(outputPath)
    if (stats.isDirectory()) {
      throw new Error('Export output path cannot be a directory')
    }
  } catch (error) {
    if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) {
      throw error
    }
  }

  if (path.extname(outputPath).toLowerCase() !== '.html') {
    throw new Error('Export output path must be an .html file')
  }
}

export async function exportDeck(projectPath: string, outputPath: string, mode: ExportMode): Promise<string> {
  await assertHtmlOutputPath(outputPath)

  const project = await openProject(projectPath)
  const width = project.manifest.canvas.width
  const height = project.manifest.canvas.height
  const slidesHtml = project.slides
    .map((slide, index) => {
      const slideRoot = extractSlideRoot(serializeSlideToHtml(slide))
      return `<section class="ppht-slide" aria-label="${escapeAttribute(slide.title)}" data-slide-index="${index}"${
        index === 0 ? '' : ' hidden'
      }>
        ${slideRoot}
      </section>`
    })
    .join('\n')
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

      [data-ppht-slide-root] {
        box-sizing: border-box;
      }

      [data-ppht-slide-root],
      [data-ppht-slide-root] *,
      [data-ppht-slide-root] *::before,
      [data-ppht-slide-root] *::after {
        box-sizing: border-box;
      }
    </style>
  </head>
  <body>
    <main class="ppht-stage" data-ppht-stage>
      ${slidesHtml}
    </main>${projectModel}
    <script>
      (() => {
        const stage = document.querySelector('[data-ppht-stage]');
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

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, html, 'utf8')
  return outputPath
}
