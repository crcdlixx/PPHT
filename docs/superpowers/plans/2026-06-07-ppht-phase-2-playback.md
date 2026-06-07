# PPHT Phase 2 Playback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pure-web presentation playback for the editor and exported HTML while preserving the phase 1 one-slide-one-HTML editing model.

**Architecture:** Playback state lives in the editor store and renders through a reusable slide view shared by the editing canvas and presentation overlay. Exported HTML gets a standalone playback shell with keyboard, touch, fullscreen, responsive scaling, and transition behavior, without requiring any server or browser extension.

**Tech Stack:** TypeScript, React, Zustand, Express service tests, Vitest, existing PPHT serializer/exporter.

---

## Task 1: Editor Playback State

**Files:**
- Modify: `apps/editor/src/store/editorStore.ts`
- Modify: `apps/editor/src/store/editorStore.test.ts`

- [ ] Add failing store tests for starting playback from the selected slide, clamped next/previous navigation, direct slide jumps, and stopping playback.
- [ ] Implement minimal playback state and actions in the Zustand store.
- [ ] Verify with `pnpm --filter @ppht/editor test -- src/store/editorStore.test.ts`.

## Task 2: Editor Playback UI

**Files:**
- Create: `apps/editor/src/components/SlideView.tsx`
- Create: `apps/editor/src/components/PlaybackView.tsx`
- Modify: `apps/editor/src/components/Canvas.tsx`
- Modify: `apps/editor/src/components/Toolbar.tsx`
- Modify: `apps/editor/src/App.tsx`
- Modify: `apps/editor/src/styles.css`

- [ ] Extract common slide rendering into `SlideView`.
- [ ] Add an editor playback overlay with icon controls, slide counter, transitions, keyboard navigation, pointer/touch navigation, and fullscreen request support.
- [ ] Add toolbar play entry.
- [ ] Verify with `pnpm --filter @ppht/editor typecheck`.

## Task 3: Exported Pure-Web Playback

**Files:**
- Modify: `apps/server/src/exportService.ts`
- Modify: `apps/server/tests/exportService.test.ts`
- Modify: `apps/server/tests/phase1Flow.test.ts`

- [ ] Add failing export tests for playback controls, fullscreen API usage, touch navigation, slide transitions, mobile viewport scaling, and object animation CSS.
- [ ] Enhance exported HTML shell while keeping clean exports free of PPHT editor metadata.
- [ ] Verify with `pnpm --filter @ppht/server test`.

## Task 4: Final Verification

**Files:**
- Read: `docs/superpowers/specs/2026-05-31-ppht-html-ppt-editor-design.md`

- [ ] Run `pnpm test`.
- [ ] Run `pnpm typecheck`.
- [ ] Run `pnpm build`.
- [ ] Run `git status --short --branch`.
- [ ] Commit the phase 2 implementation.

## Acceptance

- Editor has playback mode.
- Playback can request fullscreen.
- Keyboard navigation supports next, previous, first, last, and escape.
- Exported HTML has the same pure-web playback behavior.
- Exported HTML supports touch/pointer navigation and responsive mobile viewing.
- Slide transitions and object entrance animation CSS exist in editor playback and exports.
- No browser E2E is required for this phase because the user explicitly asked not to run browser testing.
