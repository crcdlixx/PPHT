# PPHT Phase 3A Compatibility and AI 4A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PPHT compatibility foundations and a first deterministic AI-assisted HTML editing flow while preserving pure-web output and one-slide-one-HTML editing.

**Architecture:** Core owns model extensions, clipboard helpers, and compatibility import helpers. Server owns local file import and deterministic AI suggestion APIs. Editor owns command-backed clipboard and AI suggestion UI.

**Tech Stack:** TypeScript, React, Zustand, Express, Vitest, existing PPHT serializer/exporter.

---

## Task 1: Core Compatibility Model

**Files:**
- Modify: `packages/core/src/model.ts`
- Modify: `packages/core/src/factories.ts`
- Modify: `packages/core/src/serializer.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/core/src/clipboard.ts`
- Create: `packages/core/src/compatibility.ts`
- Create: `packages/core/tests/compatibility.test.ts`
- Create: `packages/core/tests/clipboard.test.ts`
- Modify: `packages/core/tests/serializer.test.ts`

Steps:

- [x] Write failing tests for chart/media serialization and model round-trip.
- [x] Write failing tests for clipboard copy/paste with fresh IDs and offsets.
- [x] Write failing tests for importing PPHT-authored HTML and rejecting missing model HTML.
- [x] Extend model/factories/serializer.
- [x] Add clipboard and compatibility helpers.
- [x] Run `pnpm --filter @ppht/core test`.
- [x] Run `pnpm --filter @ppht/core typecheck`.

## Task 2: Server Import and AI APIs

**Files:**
- Modify: `apps/server/src/api.ts`
- Modify: `apps/server/src/projectService.ts`
- Create: `apps/server/src/aiService.ts`
- Create: `apps/server/tests/importHtml.test.ts`
- Create: `apps/server/tests/aiService.test.ts`
- Modify: `apps/server/tests/api.test.ts`

Steps:

- [x] Write failing tests for importing a PPHT slide HTML file into an existing project.
- [x] Write failing tests for AI suggestion response shape and non-mutating behavior.
- [x] Implement `importSlideHtml` in project service.
- [x] Implement deterministic `suggestSlideEdit` in AI service.
- [x] Add API routes with zod validation.
- [x] Run `pnpm --filter @ppht/server test`.
- [x] Run `pnpm --filter @ppht/server typecheck`.

## Task 3: Editor Compatibility and AI UI

**Files:**
- Modify: `apps/editor/src/api/projectClient.ts`
- Modify: `apps/editor/src/store/editorStore.ts`
- Modify: `apps/editor/src/store/editorStore.test.ts`
- Modify: `apps/editor/src/components/Toolbar.tsx`
- Modify: `apps/editor/src/components/PropertyPanel.tsx`
- Create: `apps/editor/src/components/AiPanel.tsx`
- Create: `apps/editor/src/components/AiPanel.test.tsx`
- Modify: `apps/editor/src/styles.css`

Steps:

- [x] Write failing store tests for copy/paste and AI request/accept/reject/undo.
- [x] Write failing component tests for AI panel instruction submission and accept/reject controls.
- [x] Add client methods for import and AI suggestion.
- [x] Add store actions for clipboard, import HTML, AI suggestion, accept, reject, rollback.
- [x] Add toolbar copy/paste/import buttons.
- [x] Add AI panel in the property sidebar.
- [x] Run `pnpm --filter @ppht/editor test`.
- [x] Run `pnpm --filter @ppht/editor typecheck`.

## Task 4: Integration Verification

**Files:**
- Read all changed files.

Steps:

- [x] Run `pnpm test`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm build`.
- [x] Run `git diff --check`.
- [x] Commit with `feat(editor): add compatibility and ai editing foundations`.

## Acceptance

- Chart and media placeholders serialize to pure web HTML.
- PPHT element clipboard copy/paste works in the editor model.
- Existing PPHT slide HTML can be imported into a project as a new slide.
- AI suggestion API returns deterministic before/after slide data from context.
- Editor can preview, accept, reject, and undo AI suggestions.
- No browser/Playwright testing is required for this stage unless the user changes preference.
