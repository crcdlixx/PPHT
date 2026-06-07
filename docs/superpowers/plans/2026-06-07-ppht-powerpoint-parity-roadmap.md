# PPHT PowerPoint Parity Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track the remaining PPHT work needed to approach everyday PowerPoint feature parity while preserving pure-web output and one-slide-one-HTML editing.

**Architecture:** Build the feature set in slices that each leave the product usable: editor interactions first, rich styling second, themes/layouts third, charts/media fourth, playback/presenter tools fifth, PPTX compatibility sixth, and deeper AI last. MarkPoint stays optional and separate from the editor core.

**Tech Stack:** TypeScript, React, Zustand, Express, Vitest, PPHT core serializer/exporter, future PPTX adapter library, future AI provider adapters.

---

## Current Baseline

- Phase 1 core editing exists.
- Phase 2 playback exists.
- Phase 3A compatibility foundation exists: chart/media placeholders, PPHT HTML import, clipboard helpers, compatibility reports.
- AI 4A exists: deterministic local suggestions, before/after preview, accept/reject/rollback through command history.

## Phase 3B: Editor Interaction Completeness

**Files likely touched:**
- `apps/editor/src/store/editorStore.ts`
- `apps/editor/src/components/Canvas.tsx`
- `apps/editor/src/components/SlideView.tsx`
- `apps/editor/src/components/Toolbar.tsx`
- `apps/editor/src/components/PropertyPanel.tsx`
- `apps/editor/src/styles.css`
- `packages/core/src/commands.ts`
- `packages/core/src/documentOps.ts`

- [ ] Add multi-select and shift-select support.
- [ ] Add marquee selection on the canvas.
- [ ] Add group and ungroup commands.
- [ ] Add align left, center, right, top, middle, bottom commands.
- [ ] Add distribute horizontal and vertical commands.
- [ ] Add snap guides and optional grid.
- [ ] Add a layer panel with lock, hide, rename, bring forward, send backward, bring to front, and send to back.
- [ ] Add keyboard shortcuts for copy, paste, delete, undo, redo, save, duplicate, group, ungroup, align, and playback.
- [ ] Add context menus for canvas, element selection, and slides.
- [ ] Add full resize handles and rotation handles.
- [ ] Extend copy/paste to work across slides and PPHT projects.
- [ ] Verify with unit/component tests and no browser testing unless explicitly requested.

## Phase 3C: Text, Object, and Table Styling

**Files likely touched:**
- `packages/core/src/model.ts`
- `packages/core/src/factories.ts`
- `packages/core/src/serializer.ts`
- `packages/core/src/commands.ts`
- `apps/editor/src/components/PropertyPanel.tsx`
- `apps/editor/src/components/SlideView.tsx`
- `apps/editor/src/styles.css`

- [ ] Add rich text model for runs or editable inline marks.
- [ ] Add text controls for font family, size, color, bold, italic, underline, and alignment.
- [ ] Add paragraph controls for bullets, numbering, indentation, line height, and spacing.
- [ ] Add hyperlink support for text and objects.
- [ ] Add shape fill, stroke, opacity, shadow, and corner radius controls.
- [ ] Add image crop, replace, opacity, and fit controls.
- [ ] Add dashed lines and endpoint styles.
- [ ] Add table element model, serializer, renderer, and inspector.
- [ ] Verify pure HTML serialization round-trips for every new style and element.

## Phase 3D: Themes, Layouts, Masters, and Templates

**Files likely touched:**
- `packages/core/src/model.ts`
- `packages/core/src/factories.ts`
- `packages/core/src/serializer.ts`
- `apps/server/src/projectService.ts`
- `apps/editor/src/store/editorStore.ts`
- `apps/editor/src/components/SlideRail.tsx`
- `apps/editor/src/components/PropertyPanel.tsx`

- [ ] Formalize named theme tokens for fonts and colors.
- [ ] Add slide layout definitions.
- [ ] Add master slide model and inheritance rules.
- [ ] Add placeholders for title, body, image, chart, footer, and slide number.
- [ ] Add template gallery for common deck structures.
- [ ] Add global font and color replacement.
- [ ] Verify that inherited layout/master data still exports as standalone pure HTML.

## Phase 3E: Charts, Media, and Asset Management

**Files likely touched:**
- `packages/core/src/model.ts`
- `packages/core/src/serializer.ts`
- `apps/server/src/projectService.ts`
- `apps/server/src/exportService.ts`
- `apps/editor/src/components/PropertyPanel.tsx`
- `apps/editor/src/components/SlideView.tsx`
- `apps/editor/src/components/Toolbar.tsx`

- [ ] Replace chart placeholders with editable chart data and chart inspector.
- [ ] Support bar, line, area, pie, donut, and scatter charts.
- [ ] Add audio and video asset import.
- [ ] Add media playback controls in presentation mode.
- [ ] Add an asset manager for images, fonts, audio, video, and reusable snippets.
- [ ] Detect missing assets and offer repair prompts.
- [ ] Export resources as embedded assets or stable relative paths while keeping output pure web.

## Phase 3F: Advanced Playback and Presenter Tools

**Files likely touched:**
- `packages/core/src/model.ts`
- `packages/core/src/serializer.ts`
- `apps/editor/src/components/PlaybackView.tsx`
- `apps/editor/src/store/editorStore.ts`
- `apps/editor/src/styles.css`

- [ ] Add transition model and transition editor.
- [ ] Add element animation model for enter, exit, emphasis, and motion path.
- [ ] Add animation timeline and order controls.
- [ ] Support click-triggered and automatic animations.
- [ ] Add speaker notes to the slide model.
- [ ] Add presenter view with notes, current slide, next slide, and timer.
- [ ] Improve mobile playback behavior.

## Phase 3G: PPTX Compatibility

**Files likely touched:**
- `packages/core/src/model.ts`
- `packages/core/src/compatibility.ts`
- `apps/server/src/projectService.ts`
- `apps/server/src/api.ts`
- New: `apps/server/src/pptxImportService.ts`
- New: `apps/server/src/pptxExportService.ts`

- [ ] Choose a PPTX parsing/export library after a small spike.
- [ ] Import PPTX text, images, shapes, tables, charts, notes, basic layouts, and media metadata.
- [ ] Export PPHT model to PPTX.
- [ ] Emit a compatibility report with exact, approximated, and skipped features.
- [ ] Preserve PPHT's editing invariant: one slide is one HTML file.
- [ ] Verify imported decks remain editable and exported HTML remains pure web.

## Phase 4B: AI HTML Editing Depth

**Files likely touched:**
- `apps/server/src/aiService.ts`
- `apps/server/src/api.ts`
- `apps/editor/src/store/editorStore.ts`
- `apps/editor/src/components/AiPanel.tsx`
- `packages/core/src/serializer.ts`

- [ ] Expand AI context to include deck summary, current slide model, slide HTML, selected elements, theme, assets, and recent history.
- [ ] Add provider adapter interface for deterministic local provider, OpenAI, and future local models.
- [ ] Add manual AI mode with previewable before/after suggestions.
- [ ] Add automatic AI mode as a queued review flow, not silent mutation.
- [ ] Add partial apply for individual elements and properties.
- [ ] Add conflict detection when slides change after AI request.
- [ ] Add rollback and audit trail for accepted AI edits.
- [ ] Add HTML/code view for one-slide-at-a-time AI-assisted edits.

## Phase 5: Optional MarkPoint Integration

**Files likely touched:**
- New: `apps/server/src/markpointImportService.ts`
- New: `apps/server/src/markpointExportService.ts`
- `apps/server/src/api.ts`
- `apps/editor/src/api/projectClient.ts`
- `apps/editor/src/components/Toolbar.tsx`

- [ ] Keep MarkPoint optional and separate from PPHT editor core.
- [ ] Import MarkPoint Markdown decks into PPHT projects.
- [ ] Export PPHT decks to MarkPoint Markdown when supported.
- [ ] Report unsupported MarkPoint or PPHT features instead of silently dropping them.

## Execution Recommendation

Start with Phase 3B and Phase 3C. They improve daily editing fastest and provide the foundations needed by themes, PPTX compatibility, and deeper AI edits.

## Verification Baseline

Run these after every phase:

```powershell
pnpm test
pnpm typecheck
pnpm build
git diff --check
```

No browser/Playwright testing is required unless explicitly requested.
