import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { addElement, createImageElement, createShapeElement, type ProjectManifest } from '@ppht/core'
import { createProject, saveSlide } from '../src/projectService.js'
import { exportDeck } from '../src/exportService.js'

describe('exportService', () => {
  async function createTempProjectPath() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ppht-export-'))
    return {
      root,
      projectPath: path.join(root, 'demo.ppht')
    }
  }

  async function writeManifest(projectPath: string, manifest: ProjectManifest) {
    await fs.writeFile(path.join(projectPath, 'project.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  }

  it('exports self-contained and clean playback html', async () => {
    const { root, projectPath } = await createTempProjectPath()
    await createProject(projectPath, 'Demo Deck')

    const selfContained = await exportDeck(projectPath, path.join(root, 'demo-full.html'), 'self-contained')
    const clean = await exportDeck(projectPath, path.join(root, 'demo-clean.html'), 'clean')

    expect(await fs.readFile(selfContained, 'utf8')).toContain('data-ppht-project-model')
    expect(await fs.readFile(clean, 'utf8')).not.toContain('data-ppht-project-model')
  })

  it('exports a pure-web playback shell with controls, fullscreen, touch, transitions, and mobile scaling', async () => {
    const { root, projectPath } = await createTempProjectPath()
    await createProject(projectPath, 'Playback Deck')

    const outputPath = await exportDeck(projectPath, path.join(root, 'playback.html'), 'clean')
    const html = await fs.readFile(outputPath, 'utf8')

    expect(html).toContain('class="ppht-player"')
    expect(html).toContain('class="ppht-player-controls"')
    expect(html).toContain('aria-label="Previous slide"')
    expect(html).toContain('aria-label="Next slide"')
    expect(html).toContain('aria-label="Fullscreen"')
    expect(html).toContain('requestFullscreen')
    expect(html).toContain("event.key === 'f'")
    expect(html).toContain("event.key === 'Escape'")
    expect(html).toContain('pointerdown')
    expect(html).toContain('pointerup')
    expect(html).toContain('ppht-slide-enter')
    expect(html).toContain('ppht-element-enter')
    expect(html).toContain('@media (max-width: 760px)')
    expect(html).toContain('visualViewport')
    expect(html).not.toContain('data-ppht-project-model')
  })

  it('escapes deck titles, slide aria labels, and embedded project json', async () => {
    const { root, projectPath } = await createTempProjectPath()
    const project = await createProject(projectPath, 'Deck </script><img src=x onerror=alert(1)> "quoted"')
    const firstSlide = project.slides[0]
    if (!firstSlide) throw new Error('Expected first slide')

    await saveSlide(projectPath, firstSlide.id, {
      ...firstSlide,
      title: 'Slide <One> & "quoted"'
    })

    const outputPath = await exportDeck(projectPath, path.join(root, 'nested', 'escaped.html'), 'self-contained')
    const html = await fs.readFile(outputPath, 'utf8')

    expect(html).toContain('<title>Deck &lt;/script&gt;&lt;img src=x onerror=alert(1)&gt; &quot;quoted&quot;</title>')
    expect(html).toContain('aria-label="Slide &lt;One&gt; &amp; &quot;quoted&quot;"')
    expect(html).toContain('<\\/script>')
    expect(html).not.toContain('</script><img')
  })

  it('does not include project model json in clean exports', async () => {
    const { root, projectPath } = await createTempProjectPath()
    const project = await createProject(projectPath, 'Private Deck Marker')
    await writeManifest(projectPath, {
      ...project.manifest,
      assets: [{ id: 'private-model-marker', type: 'image', path: 'assets/images/private.png' }]
    })

    const outputPath = await exportDeck(projectPath, path.join(root, 'clean.html'), 'clean')
    const html = await fs.readFile(outputPath, 'utf8')

    expect(html).not.toContain('data-ppht-project-model')
    expect(html).not.toContain('private-model-marker')
  })

  it('rejects non-html export paths and directory paths', async () => {
    const { root, projectPath } = await createTempProjectPath()
    await createProject(projectPath, 'Demo Deck')
    const directoryPath = path.join(root, 'exports')
    await fs.mkdir(directoryPath)

    await expect(exportDeck(projectPath, path.join(root, 'demo.txt'), 'clean')).rejects.toThrow(/\.html/i)
    await expect(exportDeck(projectPath, directoryPath, 'clean')).rejects.toThrow(/directory/i)
  })

  it('inlines project image resources in self-contained exports', async () => {
    const { root, projectPath } = await createTempProjectPath()
    const project = await createProject(projectPath, 'Asset Deck')
    const firstSlide = project.slides[0]
    if (!firstSlide) throw new Error('Expected first slide')

    await fs.mkdir(path.join(projectPath, 'assets', 'images'), { recursive: true })
    await fs.writeFile(path.join(projectPath, 'assets', 'images', 'pixel.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    await writeManifest(projectPath, {
      ...project.manifest,
      assets: [{ id: 'hero-image', type: 'image', path: 'assets/images/pixel.png' }]
    })
    await saveSlide(
      projectPath,
      firstSlide.id,
      addElement(
        firstSlide,
        createImageElement('hero-image', { x: 10, y: 20, width: 100, height: 80 }, 'hero-image', 'Hero')
      )
    )

    const outputPath = await exportDeck(projectPath, path.join(root, 'asset.html'), 'self-contained')
    const html = await fs.readFile(outputPath, 'utf8')
    const renderedHtml = html.slice(0, html.indexOf('<script type="application/json" data-ppht-project-model>'))

    expect(renderedHtml).toContain('src="data:image/png;base64,iVBORw=="')
    expect(renderedHtml).not.toContain('pixel.png')
    expect(renderedHtml).toContain('data-ppht-element-id="hero-image"')
  })

  it('inlines css url resources and skips external resources in self-contained exports', async () => {
    const { root, projectPath } = await createTempProjectPath()
    const project = await createProject(projectPath, 'CSS Asset Deck')
    const firstSlide = project.slides[0]
    if (!firstSlide) throw new Error('Expected first slide')

    await fs.mkdir(path.join(projectPath, 'assets', 'images'), { recursive: true })
    await fs.writeFile(path.join(projectPath, 'assets', 'images', 'background.webp'), Buffer.from([0x52, 0x49, 0x46, 0x46]))
    await writeManifest(projectPath, {
      ...project.manifest,
      assets: [{ id: 'background-asset', type: 'image', path: 'assets/images/background.webp' }]
    })
    await saveSlide(projectPath, firstSlide.id, {
      ...firstSlide,
      background: { type: 'image', assetId: 'background-asset', fit: 'cover' },
      elements: [
        createImageElement(
          'external-image',
          { x: 10, y: 20, width: 100, height: 80 },
          'https://example.test/external.png',
          'External'
        )
      ]
    })

    const outputPath = await exportDeck(projectPath, path.join(root, 'css-asset.html'), 'self-contained')
    const html = await fs.readFile(outputPath, 'utf8')
    const renderedHtml = html.slice(0, html.indexOf('<script type="application/json" data-ppht-project-model>'))

    expect(renderedHtml).toContain('background-image: url(&quot;data:image/webp;base64,UklGRg==&quot;)')
    expect(renderedHtml).toContain('src="https://example.test/external.png"')
    expect(renderedHtml).not.toContain('url(&quot;background-asset&quot;)')
  })

  it('strips editor metadata from clean exports', async () => {
    const { root, projectPath } = await createTempProjectPath()
    const project = await createProject(projectPath, 'Clean Deck')
    const firstSlide = project.slides[0]
    if (!firstSlide) throw new Error('Expected first slide')

    await saveSlide(
      projectPath,
      firstSlide.id,
      addElement(
        firstSlide,
        createShapeElement('shape-001', { x: 10, y: 20, width: 120, height: 80 }, 'rectangle')
      )
    )

    const outputPath = await exportDeck(projectPath, path.join(root, 'clean.html'), 'clean')
    const html = await fs.readFile(outputPath, 'utf8')

    expect(html).not.toContain('data-ppht-element-id')
    expect(html).not.toContain('data-ppht-element-type')
    expect(html).not.toContain('data-ppht-shape')
    expect(html).not.toContain('data-ppht-slide-root')
  })

  it('rejects invalid manifest canvas dimensions', async () => {
    const { root, projectPath } = await createTempProjectPath()
    const project = await createProject(projectPath, 'Bad Canvas')
    await writeManifest(projectPath, {
      ...project.manifest,
      canvas: { ...project.manifest.canvas, width: Number.NaN, height: -1 }
    })

    await expect(exportDeck(projectPath, path.join(root, 'bad.html'), 'clean')).rejects.toThrow(/canvas/i)
  })

  it('rejects html export paths outside the project parent directory', async () => {
    const { projectPath } = await createTempProjectPath()
    await createProject(projectPath, 'Demo Deck')
    const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ppht-outside-'))

    await expect(exportDeck(projectPath, path.join(outsideRoot, 'outside.html'), 'clean')).rejects.toThrow(
      /outside/i
    )
  })

  it('converts serialized slide roots away from nested main elements', async () => {
    const { root, projectPath } = await createTempProjectPath()
    await createProject(projectPath, 'Demo Deck')

    const outputPath = await exportDeck(projectPath, path.join(root, 'demo.html'), 'self-contained')
    const html = await fs.readFile(outputPath, 'utf8')

    expect(html).not.toContain('<main data-ppht-slide-root')
    expect(html).toContain('<div class="ppht-slide-root"')
  })
})
