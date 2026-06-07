# PPHT Phase 3A Compatibility and AI 4A Design

Date: 2026-06-07

## Goal

Extend PPHT beyond the phase 1 editor and phase 2 player with a compatibility foundation and a first AI-assisted HTML editing loop. This stage keeps PPHT pure web, keeps editing as one slide per HTML file, and treats full PPTX fidelity plus real LLM integration as provider work layered on top of the new interfaces.

## Scope

Phase 3A compatibility includes:

- Theme tokens for fonts and colors in `ProjectManifest`.
- Media and chart placeholder element types that serialize to pure HTML.
- Clipboard snapshots for copying and pasting PPHT-authored elements.
- HTML import for PPHT slide HTML that already contains `data-ppht-slide-model`.
- A compatibility report that records what was imported and what was skipped.

AI 4A includes:

- A deterministic local AI edit provider for tests and offline development.
- Slide and deck context assembly from manifest, slide model, and slide HTML.
- AI suggestions that produce a previewable slide diff.
- Accept, reject, and rollback flow through the existing command/history path.
- Server API boundaries that can later host a real model provider without changing editor UI.

## Non-Goals

- Full PPTX import/export fidelity.
- Reverse parsing arbitrary third-party HTML into structured PPHT models.
- Real network LLM calls or API key management.
- Automatic background edits without explicit preview.
- MarkPoint implementation. It remains optional and separate.

## Architecture

### Core Compatibility Layer

`packages/core` owns additional model types and pure functions:

- `theme` grows from simple arrays into token-friendly fonts and colors while preserving old manifests.
- `ElementNode` gains `chart` and `media` variants.
- `clipboard` helpers serialize selected elements into a PPHT clipboard payload and paste them with fresh IDs and offsets.
- `compatibility` helpers import PPHT-authored slide HTML by reading embedded JSON and return a report.

### Server Layer

The local Node service exposes deterministic, testable endpoints:

- `POST /api/projects/import/html` imports a single PPHT slide HTML file into an existing project.
- `POST /api/ai/suggest` returns a local AI suggestion using the current slide/deck context and instruction.

The AI endpoint does not call the network in this stage. It uses deterministic transformations such as title updates, text replacement, or appending a generated text box. The response shape is provider-ready.

### Editor Layer

The editor adds:

- Clipboard actions in the store and toolbar.
- Import HTML action through the project client.
- An AI panel in the right sidebar that accepts an instruction, requests a suggestion, previews summary information, and supports accept/reject/rollback.

AI acceptance updates the current slide through a command so undo/redo still work. Rejection discards the pending suggestion. Rollback reverts the last accepted AI change when the command remains in history.

## Data Flow

HTML import:

1. User chooses or supplies an HTML path.
2. Editor calls the server import endpoint.
3. Server reads embedded `data-ppht-slide-model`.
4. Server writes a new slide HTML file, updates manifest, creates a thumbnail, and returns the updated project.
5. Editor replaces local manifest/slides with the response.

AI suggestion:

1. Editor saves the current project state if needed.
2. Editor sends manifest, current slide, slide HTML, and instruction to `/api/ai/suggest`.
3. Server builds a deterministic suggestion with `before`, `after`, and summary.
4. Editor stores the pending suggestion and displays the summary.
5. Accept applies `after` with a command. Reject clears the pending suggestion.

## Testing

Required coverage:

- Core clipboard copies only existing selected elements and pastes with fresh IDs and offsets.
- Core chart/media elements serialize to pure HTML and round-trip through embedded model JSON.
- Compatibility import reports PPHT model imports and rejects HTML without an embedded model.
- Server import endpoint updates manifest and writes one HTML file per imported slide.
- AI suggest endpoint returns before/after slide data and does not mutate files.
- Editor store can request, accept, reject, and undo AI suggestions.
- Full `pnpm test`, `pnpm typecheck`, and `pnpm build` pass without browser testing.

## Acceptance

This stage is complete when:

- PPHT can represent theme tokens, media placeholders, and chart placeholders.
- PPHT can copy/paste model-backed elements.
- PPHT can import its own slide HTML into a project as a new editable slide.
- PPHT exposes an AI edit panel that creates a deterministic HTML-backed suggestion from context.
- AI suggestions can be accepted, rejected, and undone.
- Exported content remains pure web.
- Phase 3 full PPTX support, MarkPoint integration, and real AI provider wiring remain clear extension points.
