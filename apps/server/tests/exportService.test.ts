import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
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

  it('exports self-contained and clean playback html', async () => {
    const { root, projectPath } = await createTempProjectPath()
    await createProject(projectPath, 'Demo Deck')

    const selfContained = await exportDeck(projectPath, path.join(root, 'demo-full.html'), 'self-contained')
    const clean = await exportDeck(projectPath, path.join(root, 'demo-clean.html'), 'clean')

    expect(await fs.readFile(selfContained, 'utf8')).toContain('data-ppht-project-model')
    expect(await fs.readFile(clean, 'utf8')).not.toContain('data-ppht-project-model')
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
    await fs.writeFile(
      path.join(projectPath, 'project.json'),
      `${JSON.stringify(
        {
          ...project.manifest,
          assets: [{ id: 'private-model-marker', type: 'image', path: 'assets/images/private.png' }]
        },
        null,
        2
      )}\n`,
      'utf8'
    )

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
})
