import type { SlideDocument } from './model.js'
import { parseSlideHtml } from './serializer.js'

export type CompatibilityImportReport =
  | {
      status: 'imported'
      source: 'ppht-slide-html'
      importedElementCount: number
      skippedElementCount: number
    }
  | {
      status: 'rejected'
      source: 'ppht-slide-html' | 'unknown-html'
      importedElementCount: 0
      skippedElementCount: number
      rejectedReason: string
    }

export type CompatibilityImportResult = {
  slide?: SlideDocument
  report: CompatibilityImportReport
}

export function importSlideHtmlForCompatibility(html: string): CompatibilityImportResult {
  const source = html.includes('data-ppht-slide-model') ? 'ppht-slide-html' : 'unknown-html'

  try {
    const slide = parseSlideHtml(html)
    return {
      slide,
      report: {
        status: 'imported',
        source: 'ppht-slide-html',
        importedElementCount: slide.elements.length,
        skippedElementCount: 0
      }
    }
  } catch (error) {
    return {
      report: {
        status: 'rejected',
        source,
        importedElementCount: 0,
        skippedElementCount: 0,
        rejectedReason: error instanceof Error ? error.message : 'Unable to import slide HTML'
      }
    }
  }
}
