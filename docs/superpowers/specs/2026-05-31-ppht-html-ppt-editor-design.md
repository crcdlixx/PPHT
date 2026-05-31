# PPHT HTML PPT Editor Design

Date: 2026-05-31

## Goal

Build PPHT as a PowerPoint-style presentation editor where the editor runs as a web application and the authored work remains pure web content. The first phase focuses on a stable editing loop. Playback polish, compatibility features, and AI-assisted HTML editing are planned but do not block phase 1.

## Decisions

- The editor is a React/Vite web app backed by a local Node service.
- The authored presentation is pure web content.
- During editing, one PPT page is stored as one HTML file.
- During export, multiple slide HTML files can be merged into one self-contained HTML presentation.
- MarkPoint is separate from this editor. It may become an optional import/export integration later.
- Phase 1 uses a hybrid canvas: DOM for text/images/layout, SVG for shapes and lines, and optional Canvas later for specialized rendering.
- The internal structured model is the editing source of truth. HTML is the preview/playback representation.

## Phase 1 Scope

Phase 1 delivers the core editing loop:

- Create, open, and save PPHT projects.
- Manage slides: add, duplicate, delete, reorder, and select.
- Show slide thumbnails.
- Edit a main canvas.
- Insert and edit text, images, basic shapes, and lines.
- Select, move, resize, rotate, align, lock, hide, and reorder elements.
- Edit common properties in a right-side property panel.
- Undo and redo core edits.
- Save each slide as an independent HTML file.
- Export a self-contained HTML presentation.
- Export a clean playback-only HTML presentation.

## Roadmap TODO

### Phase 2: Playback

- Playback mode.
- Fullscreen presentation.
- Keyboard navigation.
- Slide transitions.
- Object animations.
- Mobile viewing.

### Phase 3: Compatibility

- PPTX import and export.
- Enhanced copy and paste.
- Fonts, themes, and master slides.
- Charts.
- Media.
- Optional MarkPoint import/export integration.

### Phase 4: AI HTML Editing

- AI can read current slide context, deck context, user instructions, slide HTML, and structured slide data.
- AI can manually or automatically modify a slide.
- AI changes are applied through previewable diffs and the command system.
- Users can accept, reject, partially apply, or roll back AI changes.
- The first AI target should be one slide at a time, because one-slide-one-HTML limits blast radius.

## Architecture

PPHT has four layers.

### Editor Frontend

The frontend is a React/Vite single-page app.

Main areas:

- Top toolbar: new, open, save, undo, redo, insert tools, export.
- Left slide rail: thumbnails, ordering, add, duplicate, delete.
- Center canvas: DOM/SVG editing surface.
- Right property panel: position, size, rotation, color, font, layer, alignment.
- Bottom status bar: zoom, current slide, selection state, save state.

### Document Core

The document core keeps structured state and editing rules.

Core concepts:

- `ProjectManifest`: project metadata, slide order, canvas size, theme, asset index.
- `SlideDocument`: structured data for a single slide.
- `ElementNode`: text, image, shape, or line.
- `Command`: an executable and undoable edit operation.
- `Renderer`: converts `SlideDocument` to editable DOM/SVG and playback HTML.

The editor does not treat the rendered DOM as the only source of truth. It renders from structured data, then serializes back into HTML when saving.

### Local Node Service

The Node service manages local files and project operations.

Responsibilities:

- Create project directories.
- Read and write `project.json`.
- Read and write slide HTML files.
- Import and manage assets.
- Generate or refresh thumbnails.
- Run export operations.
- Provide extension points for future PPTX, MarkPoint, and AI integrations.

The Node service does not own editing logic. Editing logic lives in the frontend document core.

### Exporter

The exporter reads a PPHT project and produces web deliverables:

- Self-contained HTML with all slides, resources, and embedded editing data.
- Clean playback-only HTML without editor state.
- Future optional multi-HTML package export.

Exports should prioritize offline playback. Assets can be embedded as base64 or packed with stable relative paths depending on export mode.

## Project File Structure

A PPHT project is a directory:

```text
my-deck.ppht/
  project.json
  slides/
    slide-001.html
    slide-002.html
    slide-003.html
  assets/
    images/
    fonts/
    media/
  thumbs/
    slide-001.png
    slide-002.png
```

## Project Manifest

`project.json` stores project-level state:

```json
{
  "version": "0.1.0",
  "title": "Untitled",
  "canvas": {
    "width": 1920,
    "height": 1080,
    "ratio": "16:9"
  },
  "slides": [
    {
      "id": "slide-001",
      "title": "Title",
      "html": "slides/slide-001.html",
      "thumbnail": "thumbs/slide-001.png"
    }
  ],
  "theme": {
    "fonts": [],
    "colors": []
  },
  "assets": []
}
```

## Slide HTML

Each slide is a complete HTML file that can be independently previewed.

```html
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style data-ppht-slide-style>
    /* Slide-local style */
  </style>
</head>
<body>
  <main data-ppht-slide-root>
    <!-- Preview and playback HTML -->
  </main>

  <script type="application/json" data-ppht-slide-model>
    {
      "id": "slide-001",
      "elements": []
    }
  </script>
</body>
</html>
```

Rules:

- The embedded JSON model is the editable truth.
- The rendered HTML is the preview/playback output.
- On save, PPHT updates both the slide DOM and `data-ppht-slide-model`.
- On open, PPHT first reads `data-ppht-slide-model`.
- If the model is missing, phase 1 can preview the slide but should not promise full editing.
- HTML-to-model reverse parsing is a future compatibility feature.

## Slide Model

Initial TypeScript shape:

```ts
type SlideDocument = {
  id: string
  title?: string
  background: Background
  elements: ElementNode[]
}

type ElementNode = {
  id: string
  type: 'text' | 'image' | 'shape' | 'line'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
  locked?: boolean
  visible?: boolean
  style: Record<string, unknown>
  content: unknown
}
```

## Core Modules

### Project Service

Node API:

- `createProject`
- `openProject`
- `saveProject`
- `saveSlide`
- `importAsset`
- `exportDeck`

### Editor Store

Frontend state:

- Current project.
- Current slide.
- Slide list.
- Selected element IDs.
- Zoom.
- Clipboard.
- Save status.
- Undo and redo stacks.

Zustand is the recommended phase 1 store because it is lightweight and works well with an explicit command system.

### Command System

All edits should flow through commands:

- `AddElementCommand`
- `UpdateElementCommand`
- `DeleteElementCommand`
- `MoveElementCommand`
- `ResizeElementCommand`
- `ReorderSlideCommand`
- `DuplicateSlideCommand`

Each command exposes:

```ts
execute()
undo()
description
```

This supports undo/redo now and provides a future path for AI edits, collaboration logs, and macro-style actions.

### Canvas Renderer

The renderer converts `SlideDocument` into the editable canvas.

- Text and images are DOM elements.
- Shapes and lines are SVG.
- Selection boxes, handles, guides, and snapping UI live in an editor overlay.
- The canvas uses a fixed logical size, such as 1920 by 1080, and the viewport zoom scales it visually.

### Property Panel

The property panel changes based on selection.

Common properties:

- x, y, width, height.
- rotation.
- zIndex.
- visible.
- locked.

Text properties:

- font family.
- font size.
- color.
- bold.
- italic.
- alignment.
- line height.

Image properties:

- crop.
- opacity.
- replace image.

Shape properties:

- fill.
- stroke.
- corner radius.

Line properties:

- color.
- width.
- endpoint style.

### HTML Serializer

Responsibilities:

- `SlideDocument -> slide HTML`.
- `Slide HTML -> SlideDocument` when embedded model exists.
- `Project -> merged HTML`.
- `Project -> clean playback HTML`.

Phase 1 only guarantees round-trip editing for PPHT-authored slide HTML that contains embedded JSON.

## Key Interaction Flow

Insert text:

1. User selects the text tool.
2. User clicks or drags on the canvas.
3. The frontend creates `AddElementCommand`.
4. Store updates `SlideDocument`.
5. Renderer refreshes the canvas.
6. Autosave marks the slide dirty and calls `saveSlide`.
7. Node writes `slides/slide-xxx.html`.

Save project:

1. Frontend collects `project.json` state and dirty slides.
2. Frontend calls the Node service.
3. Node writes manifest and slide HTML files.
4. Frontend updates save status.

Export:

1. User chooses self-contained or clean playback export.
2. Frontend calls `exportDeck`.
3. Node reads manifest, slide HTML, and assets.
4. Exporter emits a pure web HTML deliverable.

## Error Handling

Phase 1 should handle:

- Missing `project.json`: show that the directory is not a valid PPHT project.
- Missing slide model JSON: allow preview, but warn that full editing is unavailable.
- Missing assets: show placeholders on canvas and report missing paths.
- Save failure: keep dirty state and allow retry.
- Export failure: show the failing slide and specific reason.
- Version mismatch: use `version` for future migrations; phase 1 can show an incompatibility message.

## Testing Strategy

Required coverage:

- Document model tests for adding, updating, deleting, and ordering slides/elements.
- Command tests for execute, undo, and redo.
- Serializer tests for `SlideDocument -> HTML -> SlideDocument`.
- Project service tests for create, open, and save.
- Export tests proving merged HTML can open offline.
- Critical UI tests for inserting text, moving an element, saving, reopening, and preserving state.

## Phase 1 Acceptance Criteria

Phase 1 is complete when:

- A new PPHT project can be created.
- Slides can be added, duplicated, deleted, reordered, and selected.
- Each slide is saved as an independent HTML file.
- Text, images, basic shapes, and lines can be inserted and edited.
- Elements can be selected, moved, resized, rotated, and reordered.
- Common properties can be edited in the property panel.
- Core edit operations support undo and redo.
- A saved project can be reopened with content and layout preserved.
- A single-file self-contained HTML presentation can be exported.
- A clean playback-only HTML presentation can be exported.
- Exported work is pure web content and can open offline.
- Phase 2 playback, phase 3 compatibility, and phase 4 AI features are recorded as TODO and do not block phase 1.
