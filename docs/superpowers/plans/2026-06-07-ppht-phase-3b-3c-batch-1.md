# PPHT Phase 3B 3C Batch 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first practical slice of PowerPoint-style editing: multi-selection, batch editing commands, alignment/distribution, layer ordering, and basic element styling.

**Architecture:** Core gets a reusable multi-element update command so every batch operation stays undoable. The editor store exposes selection and batch edit actions; Canvas and SlideView render multi-selection and drag selected groups; PropertyPanel adds compact controls for alignment, layer order, and basic text/shape styles.

**Tech Stack:** TypeScript, React, Zustand, Vitest, existing PPHT command history and serializer.

---

## Task 1: Core Batch Update Command

**Files:**
- Modify: `packages/core/src/commands.ts`
- Modify: `packages/core/tests/commands.test.ts`

- [x] Write a failing test that runs `UpdateElementsCommand` against two elements and verifies undo/redo restores both.
- [x] Implement `UpdateElementsCommand` with cloned patch data and cloned previous elements.
- [x] Run `pnpm --filter @ppht/core test -- commands.test.ts`.

## Task 2: Store Selection and Batch Editing Actions

**Files:**
- Modify: `apps/editor/src/store/editorStore.ts`
- Modify: `apps/editor/src/store/editorStore.test.ts`

- [x] Write failing tests for additive/toggle multi-select.
- [x] Write failing tests for `alignSelection`, `distributeSelection`, `arrangeSelection`, and `updateSelectedElementStyles`.
- [x] Add selection options to `selectElement`.
- [x] Add store actions for alignment, distribution, layer order, and style patching.
- [x] Run `pnpm --filter @ppht/editor test -- src/store/editorStore.test.ts`.

## Task 3: Canvas and SlideView Multi-Selection

**Files:**
- Modify: `apps/editor/src/components/Canvas.tsx`
- Modify: `apps/editor/src/components/SlideView.tsx`
- Modify: `apps/editor/src/components/SlideView.test.tsx`

- [x] Write a failing SlideView test that renders two selected elements.
- [x] Change SlideView to accept `selectedElementIds`.
- [x] Change Canvas shift/control/meta click to toggle selection.
- [x] Drag selected unlocked elements as a group through `UpdateElementsCommand`.
- [x] Run `pnpm --filter @ppht/editor test -- src/components/SlideView.test.tsx`.

## Task 4: Property Panel Batch Controls

**Files:**
- Modify: `apps/editor/src/components/PropertyPanel.tsx`
- Create: `apps/editor/src/components/PropertyPanel.test.tsx`
- Modify: `apps/editor/src/styles.css`

- [x] Write a failing component test for Align Left and text color controls.
- [x] Add compact alignment, distribution, layer, and style controls to the property panel.
- [x] Keep controls dense and functional inside the right sidebar.
- [x] Run `pnpm --filter @ppht/editor test -- src/components/PropertyPanel.test.tsx`.

## Task 5: Verification and Roadmap Update

**Files:**
- Modify: `docs/superpowers/plans/2026-06-07-ppht-powerpoint-parity-roadmap.md`

- [x] Mark the completed Phase 3B and 3C batch items.
- [x] Run `pnpm test`.
- [x] Run `pnpm typecheck`.
- [x] Run `pnpm build`.
- [x] Run `git diff --check`.
- [x] Commit with `feat(editor): add batch selection and style controls`.
