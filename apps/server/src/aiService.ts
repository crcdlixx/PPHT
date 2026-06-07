import { createTextElement, type ProjectManifest, type SlideDocument, type TextElement } from '@ppht/core'

export type SuggestSlideEditInput = {
  manifest: ProjectManifest
  slide: SlideDocument
  slideHtml: string
  instruction: string
}

export type SlideEditSuggestion = {
  summary: string
  beforeSlide: SlideDocument
  afterSlide: SlideDocument
  changedElementIds: string[]
}

const titleTerms = ['title', 'headline', '标题']
const textTerms = ['text', 'copy', 'body', '文本', '文字']

function instructionIncludes(instruction: string, terms: string[]): boolean {
  const normalized = instruction.toLowerCase()
  return terms.some((term) => normalized.includes(term.toLowerCase()))
}

function summarizeInstruction(instruction: string): string {
  const normalized = instruction.trim().replace(/\s+/g, ' ')
  if (normalized.length <= 80) {
    return normalized
  }

  return `${normalized.slice(0, 77).trimEnd()}...`
}

function valueAfterDirective(instruction: string): string | undefined {
  const match = instruction.match(/^\s*(?:title|headline|text|copy|body|标题|文本|文字)\s*[:：]\s*(.+)$/iu)
  const value = match?.[1]?.trim()
  return value && value.length > 0 ? value : undefined
}

function textFromInstruction(instruction: string): string {
  return valueAfterDirective(instruction) ?? summarizeInstruction(instruction)
}

function findFirstTextElement(slide: SlideDocument): TextElement | undefined {
  return slide.elements.find((element): element is TextElement => element.type === 'text')
}

function nextAiTextId(slide: SlideDocument): string {
  const usedIds = new Set(slide.elements.map((element) => element.id))

  for (let index = 1; index < 10_000; index += 1) {
    const candidate = `ai-text-${String(index).padStart(3, '0')}`
    if (!usedIds.has(candidate)) {
      return candidate
    }
  }

  return `ai-text-${Date.now()}`
}

function addTextBox(slide: SlideDocument, content: string): { slide: SlideDocument; elementId: string } {
  const elementId = nextAiTextId(slide)
  const maxZIndex = slide.elements.reduce((max, element) => Math.max(max, element.zIndex), 0)
  const element = {
    ...createTextElement(elementId, { x: 120, y: 120, width: 420, height: 120 }, content),
    zIndex: maxZIndex + 1
  }

  return {
    elementId,
    slide: {
      ...structuredClone(slide),
      elements: [...structuredClone(slide.elements), element]
    }
  }
}

export function suggestSlideEdit(input: SuggestSlideEditInput): SlideEditSuggestion {
  const beforeSlide = structuredClone(input.slide)
  const instructionText = textFromInstruction(input.instruction)

  if (instructionIncludes(input.instruction, titleTerms)) {
    return {
      summary: `Updated title to "${instructionText}"`,
      beforeSlide,
      afterSlide: {
        ...structuredClone(input.slide),
        title: instructionText
      },
      changedElementIds: []
    }
  }

  if (instructionIncludes(input.instruction, textTerms)) {
    const textElement = findFirstTextElement(input.slide)
    if (textElement) {
      const afterSlide: SlideDocument = {
        ...structuredClone(input.slide),
        elements: input.slide.elements.map((element) =>
          element.id === textElement.id
            ? {
                ...structuredClone(textElement),
                content: {
                  ...textElement.content,
                  text: instructionText
                }
              }
            : structuredClone(element)
        )
      }

      return {
        summary: `Updated text "${textElement.id}"`,
        beforeSlide,
        afterSlide,
        changedElementIds: [textElement.id]
      }
    }

    const added = addTextBox(input.slide, instructionText)
    return {
      summary: `Added text "${added.elementId}"`,
      beforeSlide,
      afterSlide: added.slide,
      changedElementIds: [added.elementId]
    }
  }

  const added = addTextBox(input.slide, instructionText)
  return {
    summary: `Added text box for "${instructionText}"`,
    beforeSlide,
    afterSlide: added.slide,
    changedElementIds: [added.elementId]
  }
}
