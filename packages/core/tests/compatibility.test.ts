import { describe, expect, it } from 'vitest'
import {
  addElement,
  createMediaElement,
  createSlide,
  importSlideHtmlForCompatibility,
  serializeSlideToHtml
} from '../src/index'

describe('compatibility import', () => {
  it('imports PPHT-authored slide HTML with a compatibility report', () => {
    const slide = addElement(
      createSlide('slide-001', 'Import me'),
      createMediaElement('media-001', { x: 30, y: 40, width: 300, height: 120 }, {
        mediaType: 'audio',
        src: '/voice.mp3',
        title: 'Voiceover'
      })
    )

    const result = importSlideHtmlForCompatibility(serializeSlideToHtml(slide))

    expect(result.slide).toEqual(slide)
    expect(result.report).toEqual({
      status: 'imported',
      source: 'ppht-slide-html',
      importedElementCount: 1,
      skippedElementCount: 0
    })
  })

  it('rejects HTML without an embedded PPHT slide model', () => {
    const result = importSlideHtmlForCompatibility('<!doctype html><html><body><main>External</main></body></html>')

    expect(result.slide).toBeUndefined()
    expect(result.report.status).toBe('rejected')
    expect(result.report.source).toBe('unknown-html')
    expect(result.report.importedElementCount).toBe(0)
    if (result.report.status !== 'rejected') {
      throw new Error('Expected compatibility import to reject missing model HTML')
    }
    expect(result.report.rejectedReason).toBe('Missing PPHT slide model')
  })
})
