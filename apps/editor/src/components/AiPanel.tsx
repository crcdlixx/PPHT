import { RotateCcw, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useEditorStore } from '../store/editorStore'

function changedElementsText(elementIds: string[]): string {
  return elementIds.length > 0 ? `Changed ${elementIds.join(', ')}` : 'Changed slide metadata'
}

export function AiPanel() {
  const [instruction, setInstruction] = useState('')
  const currentSlideId = useEditorStore((state) => state.currentSlideId)
  const pendingAiSuggestion = useEditorStore((state) => state.pendingAiSuggestion)
  const lastAiSuggestion = useEditorStore((state) => state.lastAiSuggestion)
  const aiPending = useEditorStore((state) => state.aiPending)
  const aiError = useEditorStore((state) => state.aiError)
  const requestAiSuggestion = useEditorStore((state) => state.requestAiSuggestion)
  const acceptAiSuggestion = useEditorStore((state) => state.acceptAiSuggestion)
  const rejectAiSuggestion = useEditorStore((state) => state.rejectAiSuggestion)
  const rollbackLastAiSuggestion = useEditorStore((state) => state.rollbackLastAiSuggestion)
  const canSuggest = currentSlideId !== undefined && instruction.trim().length > 0 && !aiPending
  const hasPendingSuggestion = pendingAiSuggestion !== undefined

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canSuggest) {
      return
    }

    void requestAiSuggestion(instruction)
  }

  return (
    <section className="ai-panel" aria-label="AI">
      <h2 className="property-panel-title">AI</h2>
      <form className="ai-form" onSubmit={handleSubmit}>
        <label className="ai-field">
          <span>Instruction</span>
          <textarea
            aria-label="AI instruction"
            value={instruction}
            rows={3}
            onChange={(event) => setInstruction(event.target.value)}
          />
        </label>
        <button className="ai-primary-button" type="submit" disabled={!canSuggest}>
          <Sparkles aria-hidden="true" size={16} />
          <span>{aiPending ? 'Suggesting' : 'Suggest'}</span>
        </button>
      </form>
      {pendingAiSuggestion !== undefined ? (
        <>
          <div className="ai-summary" role="status">
            {pendingAiSuggestion.summary}
          </div>
          <div className="ai-preview" aria-label="AI suggestion preview">
            <div className="ai-preview-column">
              <strong>Before</strong>
              <span>{pendingAiSuggestion.beforeSlide.title}</span>
              <small>{pendingAiSuggestion.beforeSlide.elements.length} elements</small>
            </div>
            <div className="ai-preview-column">
              <strong>After</strong>
              <span>{pendingAiSuggestion.afterSlide.title}</span>
              <small>
                Elements {pendingAiSuggestion.beforeSlide.elements.length} -&gt; {pendingAiSuggestion.afterSlide.elements.length}
              </small>
            </div>
            <div className="ai-preview-changes">{changedElementsText(pendingAiSuggestion.changedElementIds)}</div>
          </div>
        </>
      ) : null}
      {aiError !== undefined ? (
        <div className="ai-error" role="alert">
          {aiError}
        </div>
      ) : null}
      <div className="ai-actions" aria-label="AI suggestion actions">
        <button type="button" onClick={acceptAiSuggestion} disabled={!hasPendingSuggestion}>
          <ThumbsUp aria-hidden="true" size={15} />
          <span>Accept</span>
        </button>
        <button type="button" onClick={rejectAiSuggestion} disabled={!hasPendingSuggestion}>
          <ThumbsDown aria-hidden="true" size={15} />
          <span>Reject</span>
        </button>
        <button type="button" onClick={rollbackLastAiSuggestion} disabled={lastAiSuggestion === undefined}>
          <RotateCcw aria-hidden="true" size={15} />
          <span>Rollback</span>
        </button>
      </div>
    </section>
  )
}
