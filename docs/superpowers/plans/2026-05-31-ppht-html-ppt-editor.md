# PPHT HTML PPT Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the phase 1 PPHT editor: a local Node + React/Vite PowerPoint-style editor whose project stores one slide per HTML file and exports pure web HTML.

**Architecture:** The app is a pnpm workspace with a React/Vite client, an Express local service, and shared TypeScript packages for document models, commands, serialization, and exporting. The structured slide model is the editing truth; slide HTML is the persisted preview/playback representation. The client owns editing logic and the server owns local project files, assets, and export operations.

**Tech Stack:** Node 20+, pnpm, TypeScript, React, Vite, Zustand, Express, Vitest, Testing Library, Playwright.

---

## File Structure

Create this structure from the empty workspace:

```text
D:\NewStarProject\PPHT\
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  .gitignore
  apps\
    editor\
      index.html
      package.json
      tsconfig.json
      vite.config.ts
      playwright.config.ts
      src\
        main.tsx
        App.tsx
        api\projectClient.ts
        store\editorStore.ts
        components\Toolbar.tsx
        components\SlideRail.tsx
        components\Canvas.tsx
        components\PropertyPanel.tsx
        components\StatusBar.tsx
        styles.css
      tests\
        editor-flow.spec.ts
    server\
      package.json
      tsconfig.json
      vitest.config.ts
      src\
        index.ts
        api.ts
        projectService.ts
        exportService.ts
        errors.ts
      tests\
        projectService.test.ts
        exportService.test.ts
  packages\
    core\
      package.json
      tsconfig.json
      vitest.config.ts
      src\
        ids.ts
        model.ts
        factories.ts
        documentOps.ts
        commands.ts
        serializer.ts
        index.ts
      tests\
        documentOps.test.ts
        commands.test.ts
        serializer.test.ts
```

Responsibilities:

- `packages/core`: shared model, commands, and HTML serialization. No React and no Node filesystem access.
- `apps/server`: Express API, local project directories, slide HTML persistence, assets, exports.
- `apps/editor`: React UI, Zustand state, command execution, canvas rendering, property editing, and API calls.

## Task 1: Workspace, Tooling, and Git Baseline

**Files:**
- Create: `D:\NewStarProject\PPHT\package.json`
- Create: `D:\NewStarProject\PPHT\pnpm-workspace.yaml`
- Create: `D:\NewStarProject\PPHT\tsconfig.base.json`
- Create: `D:\NewStarProject\PPHT\.gitignore`
- Create: `D:\NewStarProject\PPHT\packages\core\package.json`
- Create: `D:\NewStarProject\PPHT\packages\core\tsconfig.json`
- Create: `D:\NewStarProject\PPHT\packages\core\vitest.config.ts`
- Create: `D:\NewStarProject\PPHT\apps\server\package.json`
- Create: `D:\NewStarProject\PPHT\apps\server\tsconfig.json`
- Create: `D:\NewStarProject\PPHT\apps\server\vitest.config.ts`
- Create: `D:\NewStarProject\PPHT\apps\editor\package.json`
- Create: `D:\NewStarProject\PPHT\apps\editor\tsconfig.json`
- Create: `D:\NewStarProject\PPHT\apps\editor\vite.config.ts`
- Create: `D:\NewStarProject\PPHT\apps\editor\index.html`

- [ ] **Step 1: Initialize git**

Run:

```powershell
git init
```

Expected: `Initialized empty Git repository`.

- [ ] **Step 2: Create root package files**

Write `package.json`:

```json
{
  "name": "ppht",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "dev": "pnpm --parallel --filter @ppht/server --filter @ppht/editor dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "typescript": "^5.6.3",
    "vitest": "^2.1.8"
  }
}
```

Write `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Write `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

Write `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.env
.DS_Store
*.log
test-output/
playwright-report/
```

- [ ] **Step 3: Create package manifests**

Write `packages/core/package.json`:

```json
{
  "name": "@ppht/core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "vitest": "^2.1.8"
  }
}
```

Write `packages/core/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src", "tests"]
}
```

Write `packages/core/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
```

Write `apps/server/package.json`:

```json
{
  "name": "@ppht/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@ppht/core": "workspace:*",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "fs-extra": "^11.2.0",
    "zod": "^3.24.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/fs-extra": "^11.0.4",
    "tsx": "^4.19.2",
    "vitest": "^2.1.8"
  }
}
```

Write `apps/server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src", "tests"]
}
```

Write `apps/server/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
})
```

Write `apps/editor/package.json`:

```json
{
  "name": "@ppht/editor",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1 --port 5173",
    "build": "tsc -p tsconfig.json && vite build",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@ppht/core": "workspace:*",
    "@vitejs/plugin-react": "^4.3.4",
    "lucide-react": "^0.468.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@playwright/test": "^1.49.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "vite": "^6.0.3",
    "vitest": "^2.1.8"
  }
}
```

Write `apps/editor/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "tests", "vite.config.ts", "playwright.config.ts"]
}
```

Write `apps/editor/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3737'
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx']
  }
})
```

Write `apps/editor/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PPHT</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Install dependencies**

Run:

```powershell
pnpm install
```

Expected: lockfile is created and all workspace packages install.

- [ ] **Step 5: Verify scripts resolve**

Run:

```powershell
pnpm -r typecheck
```

Expected: the command may fail only because source files are not created yet. It must not fail with missing package manager or workspace parsing errors.

- [ ] **Step 6: Commit tooling baseline**

Run:

```powershell
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore apps packages pnpm-lock.yaml
git commit -m "chore: scaffold ppht workspace"
```

Expected: commit succeeds.

## Task 2: Core Document Model and Operations

**Files:**
- Create: `D:\NewStarProject\PPHT\packages\core\src\ids.ts`
- Create: `D:\NewStarProject\PPHT\packages\core\src\model.ts`
- Create: `D:\NewStarProject\PPHT\packages\core\src\factories.ts`
- Create: `D:\NewStarProject\PPHT\packages\core\src\documentOps.ts`
- Create: `D:\NewStarProject\PPHT\packages\core\src\index.ts`
- Create: `D:\NewStarProject\PPHT\packages\core\tests\documentOps.test.ts`

- [ ] **Step 1: Write model operation tests**

Write `packages/core/tests/documentOps.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  addElement,
  createTextElement,
  createSlide,
  deleteElement,
  duplicateSlide,
  moveElement,
  reorderSlides,
  updateElement
} from '../src/index'

describe('document operations', () => {
  it('adds, updates, moves, and deletes elements immutably', () => {
    const slide = createSlide('slide-001', 'Title')
    const text = createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'Hello')

    const withText = addElement(slide, text)
    expect(withText.elements).toHaveLength(1)
    expect(slide.elements).toHaveLength(0)

    const updated = updateElement(withText, 'el-001', { rotation: 15 })
    expect(updated.elements[0]?.rotation).toBe(15)

    const moved = moveElement(updated, 'el-001', 30, 40)
    expect(moved.elements[0]?.x).toBe(40)
    expect(moved.elements[0]?.y).toBe(60)

    const withoutText = deleteElement(moved, 'el-001')
    expect(withoutText.elements).toHaveLength(0)
  })

  it('duplicates slides and reorders the slide list', () => {
    const first = createSlide('slide-001', 'One')
    const second = createSlide('slide-002', 'Two')
    const duplicate = duplicateSlide(first, 'slide-003')

    expect(duplicate.id).toBe('slide-003')
    expect(duplicate.title).toBe('One Copy')

    const reordered = reorderSlides([first, second, duplicate], 2, 0)
    expect(reordered.map((slide) => slide.id)).toEqual(['slide-003', 'slide-001', 'slide-002'])
  })
})
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```powershell
pnpm --filter @ppht/core test -- documentOps.test.ts
```

Expected: FAIL because `../src/index` does not exist.

- [ ] **Step 3: Implement model types**

Write `packages/core/src/model.ts`:

```ts
export type ElementType = 'text' | 'image' | 'shape' | 'line'

export type CanvasSize = {
  width: number
  height: number
  ratio: '16:9' | '4:3' | 'custom'
}

export type ProjectSlideRef = {
  id: string
  title: string
  html: string
  thumbnail: string
}

export type ProjectManifest = {
  version: string
  title: string
  canvas: CanvasSize
  slides: ProjectSlideRef[]
  theme: {
    fonts: string[]
    colors: string[]
  }
  assets: Array<{
    id: string
    type: 'image' | 'font' | 'media'
    path: string
  }>
}

export type Background =
  | { type: 'color'; value: string }
  | { type: 'image'; assetId: string; fit: 'cover' | 'contain' | 'stretch' }

export type ElementRect = {
  x: number
  y: number
  width: number
  height: number
}

export type BaseElement = ElementRect & {
  id: string
  type: ElementType
  rotation: number
  zIndex: number
  locked: boolean
  visible: boolean
  style: Record<string, unknown>
}

export type TextElement = BaseElement & {
  type: 'text'
  content: {
    text: string
  }
}

export type ImageElement = BaseElement & {
  type: 'image'
  content: {
    assetId: string
    src: string
    alt: string
  }
}

export type ShapeElement = BaseElement & {
  type: 'shape'
  content: {
    shape: 'rectangle' | 'ellipse' | 'triangle'
  }
}

export type LineElement = BaseElement & {
  type: 'line'
  content: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
}

export type ElementNode = TextElement | ImageElement | ShapeElement | LineElement

export type SlideDocument = {
  id: string
  title: string
  background: Background
  elements: ElementNode[]
}
```

- [ ] **Step 4: Implement ID and factory helpers**

Write `packages/core/src/ids.ts`:

```ts
let sequence = 0

export function createId(prefix: string): string {
  sequence += 1
  return `${prefix}-${String(sequence).padStart(4, '0')}`
}

export function resetIdSequenceForTests(): void {
  sequence = 0
}
```

Write `packages/core/src/factories.ts`:

```ts
import type { ElementRect, ImageElement, LineElement, ShapeElement, SlideDocument, TextElement } from './model'

const defaultTextStyle = {
  fontFamily: 'Inter, Arial, sans-serif',
  fontSize: 48,
  color: '#111827',
  fontWeight: 400,
  fontStyle: 'normal',
  textAlign: 'left',
  lineHeight: 1.2
}

const defaultShapeStyle = {
  fill: '#ffffff',
  stroke: '#2563eb',
  strokeWidth: 3,
  borderRadius: 0
}

export function createSlide(id: string, title = 'Untitled'): SlideDocument {
  return {
    id,
    title,
    background: { type: 'color', value: '#ffffff' },
    elements: []
  }
}

export function createTextElement(id: string, rect: ElementRect, text: string): TextElement {
  return {
    id,
    type: 'text',
    ...rect,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    style: defaultTextStyle,
    content: { text }
  }
}

export function createImageElement(id: string, rect: ElementRect, src: string, alt = ''): ImageElement {
  return {
    id,
    type: 'image',
    ...rect,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    style: { opacity: 1 },
    content: { assetId: id, src, alt }
  }
}

export function createShapeElement(id: string, rect: ElementRect, shape: ShapeElement['content']['shape']): ShapeElement {
  return {
    id,
    type: 'shape',
    ...rect,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    style: defaultShapeStyle,
    content: { shape }
  }
}

export function createLineElement(id: string, rect: ElementRect): LineElement {
  return {
    id,
    type: 'line',
    ...rect,
    rotation: 0,
    zIndex: 1,
    locked: false,
    visible: true,
    style: { stroke: '#111827', strokeWidth: 3, startMarker: 'none', endMarker: 'none' },
    content: { x1: 0, y1: rect.height / 2, x2: rect.width, y2: rect.height / 2 }
  }
}
```

- [ ] **Step 5: Implement immutable document operations**

Write `packages/core/src/documentOps.ts`:

```ts
import type { ElementNode, SlideDocument } from './model'

export function addElement(slide: SlideDocument, element: ElementNode): SlideDocument {
  const maxZ = slide.elements.reduce((max, item) => Math.max(max, item.zIndex), 0)
  return {
    ...slide,
    elements: [...slide.elements, { ...element, zIndex: maxZ + 1 }]
  }
}

export function updateElement(
  slide: SlideDocument,
  elementId: string,
  patch: Partial<Omit<ElementNode, 'id' | 'type'>>
): SlideDocument {
  return {
    ...slide,
    elements: slide.elements.map((element) =>
      element.id === elementId ? ({ ...element, ...patch } as ElementNode) : element
    )
  }
}

export function deleteElement(slide: SlideDocument, elementId: string): SlideDocument {
  return {
    ...slide,
    elements: slide.elements.filter((element) => element.id !== elementId)
  }
}

export function moveElement(slide: SlideDocument, elementId: string, deltaX: number, deltaY: number): SlideDocument {
  return {
    ...slide,
    elements: slide.elements.map((element) =>
      element.id === elementId
        ? {
            ...element,
            x: element.x + deltaX,
            y: element.y + deltaY
          }
        : element
    )
  }
}

export function duplicateSlide(slide: SlideDocument, newId: string): SlideDocument {
  return {
    ...structuredClone(slide),
    id: newId,
    title: `${slide.title} Copy`,
    elements: slide.elements.map((element, index) => ({
      ...element,
      id: `${newId}-el-${String(index + 1).padStart(3, '0')}`
    }))
  }
}

export function reorderSlides<T>(slides: T[], fromIndex: number, toIndex: number): T[] {
  const copy = [...slides]
  const [item] = copy.splice(fromIndex, 1)
  if (item === undefined) {
    return slides
  }
  copy.splice(toIndex, 0, item)
  return copy
}
```

Write `packages/core/src/index.ts`:

```ts
export * from './ids'
export * from './model'
export * from './factories'
export * from './documentOps'
```

- [ ] **Step 6: Run core tests**

Run:

```powershell
pnpm --filter @ppht/core test -- documentOps.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit model work**

Run:

```powershell
git add packages/core
git commit -m "feat(core): add document model operations"
```

Expected: commit succeeds.

## Task 3: Command System

**Files:**
- Create: `D:\NewStarProject\PPHT\packages\core\src\commands.ts`
- Modify: `D:\NewStarProject\PPHT\packages\core\src\index.ts`
- Create: `D:\NewStarProject\PPHT\packages\core\tests\commands.test.ts`

- [ ] **Step 1: Write command tests**

Write `packages/core/tests/commands.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AddElementCommand, CommandHistory, createSlide, createTextElement, UpdateElementCommand } from '../src/index'

describe('command history', () => {
  it('executes undoable add and update commands', () => {
    const start = createSlide('slide-001', 'Title')
    const text = createTextElement('el-001', { x: 0, y: 0, width: 200, height: 80 }, 'Hello')
    const history = new CommandHistory(start)

    history.run(new AddElementCommand(text))
    expect(history.current.elements).toHaveLength(1)

    history.run(new UpdateElementCommand('el-001', { x: 50 }))
    expect(history.current.elements[0]?.x).toBe(50)

    history.undo()
    expect(history.current.elements[0]?.x).toBe(0)

    history.undo()
    expect(history.current.elements).toHaveLength(0)

    history.redo()
    expect(history.current.elements).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm --filter @ppht/core test -- commands.test.ts
```

Expected: FAIL because command exports do not exist.

- [ ] **Step 3: Implement command classes**

Write `packages/core/src/commands.ts`:

```ts
import { addElement, deleteElement, updateElement } from './documentOps'
import type { ElementNode, SlideDocument } from './model'

export type SlideCommand = {
  description: string
  execute(slide: SlideDocument): SlideDocument
  undo(slide: SlideDocument): SlideDocument
}

export class AddElementCommand implements SlideCommand {
  description = 'Add element'

  constructor(private readonly element: ElementNode) {}

  execute(slide: SlideDocument): SlideDocument {
    return addElement(slide, this.element)
  }

  undo(slide: SlideDocument): SlideDocument {
    return deleteElement(slide, this.element.id)
  }
}

export class UpdateElementCommand implements SlideCommand {
  description = 'Update element'
  private previous?: ElementNode

  constructor(
    private readonly elementId: string,
    private readonly patch: Partial<Omit<ElementNode, 'id' | 'type'>>
  ) {}

  execute(slide: SlideDocument): SlideDocument {
    this.previous = slide.elements.find((element) => element.id === this.elementId)
    return updateElement(slide, this.elementId, this.patch)
  }

  undo(slide: SlideDocument): SlideDocument {
    if (!this.previous) {
      return slide
    }
    return {
      ...slide,
      elements: slide.elements.map((element) => (element.id === this.elementId ? this.previous! : element))
    }
  }
}

export class DeleteElementCommand implements SlideCommand {
  description = 'Delete element'
  private deleted?: ElementNode

  constructor(private readonly elementId: string) {}

  execute(slide: SlideDocument): SlideDocument {
    this.deleted = slide.elements.find((element) => element.id === this.elementId)
    return deleteElement(slide, this.elementId)
  }

  undo(slide: SlideDocument): SlideDocument {
    return this.deleted ? addElement(slide, this.deleted) : slide
  }
}

export class CommandHistory {
  private undoStack: SlideCommand[] = []
  private redoStack: SlideCommand[] = []

  constructor(public current: SlideDocument) {}

  run(command: SlideCommand): SlideDocument {
    this.current = command.execute(this.current)
    this.undoStack.push(command)
    this.redoStack = []
    return this.current
  }

  undo(): SlideDocument {
    const command = this.undoStack.pop()
    if (!command) {
      return this.current
    }
    this.current = command.undo(this.current)
    this.redoStack.push(command)
    return this.current
  }

  redo(): SlideDocument {
    const command = this.redoStack.pop()
    if (!command) {
      return this.current
    }
    this.current = command.execute(this.current)
    this.undoStack.push(command)
    return this.current
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }
}
```

Modify `packages/core/src/index.ts`:

```ts
export * from './ids'
export * from './model'
export * from './factories'
export * from './documentOps'
export * from './commands'
```

- [ ] **Step 4: Run command tests**

Run:

```powershell
pnpm --filter @ppht/core test -- commands.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit command system**

Run:

```powershell
git add packages/core/src/commands.ts packages/core/src/index.ts packages/core/tests/commands.test.ts
git commit -m "feat(core): add undoable slide commands"
```

Expected: commit succeeds.

## Task 4: Slide HTML Serializer

**Files:**
- Create: `D:\NewStarProject\PPHT\packages\core\src\serializer.ts`
- Modify: `D:\NewStarProject\PPHT\packages\core\src\index.ts`
- Create: `D:\NewStarProject\PPHT\packages\core\tests\serializer.test.ts`

- [ ] **Step 1: Write serializer tests**

Write `packages/core/tests/serializer.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createSlide, createTextElement, parseSlideHtml, serializeSlideToHtml, addElement } from '../src/index'

describe('slide serializer', () => {
  it('round-trips a PPHT slide through HTML', () => {
    const slide = addElement(
      createSlide('slide-001', 'Title'),
      createTextElement('el-001', { x: 10, y: 20, width: 300, height: 80 }, 'Hello <World>')
    )

    const html = serializeSlideToHtml(slide)
    expect(html).toContain('data-ppht-slide-root')
    expect(html).toContain('data-ppht-slide-model')
    expect(html).toContain('Hello &lt;World&gt;')

    const parsed = parseSlideHtml(html)
    expect(parsed.id).toBe('slide-001')
    expect(parsed.elements[0]?.id).toBe('el-001')
    expect(parsed.elements[0]?.type).toBe('text')
  })

  it('throws a clear error when model JSON is missing', () => {
    expect(() => parseSlideHtml('<!doctype html><html><body></body></html>')).toThrow('Missing PPHT slide model')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm --filter @ppht/core test -- serializer.test.ts
```

Expected: FAIL because serializer exports do not exist.

- [ ] **Step 3: Implement serializer**

Write `packages/core/src/serializer.ts`:

```ts
import type { ElementNode, SlideDocument } from './model'

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function styleRecordToCss(style: Record<string, unknown>): string {
  return Object.entries(style)
    .map(([key, value]) => {
      const cssKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
      return `${cssKey}: ${String(value)};`
    })
    .join(' ')
}

function elementBaseStyle(element: ElementNode): string {
  return [
    'position: absolute;',
    `left: ${element.x}px;`,
    `top: ${element.y}px;`,
    `width: ${element.width}px;`,
    `height: ${element.height}px;`,
    `transform: rotate(${element.rotation}deg);`,
    `z-index: ${element.zIndex};`,
    element.visible ? '' : 'display: none;',
    styleRecordToCss(element.style)
  ].join(' ')
}

function renderElement(element: ElementNode): string {
  const base = `data-ppht-element-id="${escapeHtml(element.id)}" style="${elementBaseStyle(element)}"`
  if (element.type === 'text') {
    return `<div ${base}>${escapeHtml(element.content.text)}</div>`
  }
  if (element.type === 'image') {
    return `<img ${base} src="${escapeHtml(element.content.src)}" alt="${escapeHtml(element.content.alt)}" />`
  }
  if (element.type === 'shape') {
    const shape = element.content.shape === 'ellipse' ? 'border-radius: 9999px;' : ''
    return `<div ${base}; ${shape}"></div>`
  }
  return `<svg ${base} viewBox="0 0 ${element.width} ${element.height}"><line x1="${element.content.x1}" y1="${element.content.y1}" x2="${element.content.x2}" y2="${element.content.y2}" stroke="${String(element.style.stroke ?? '#111827')}" stroke-width="${String(element.style.strokeWidth ?? 3)}" /></svg>`
}

export function serializeSlideToHtml(slide: SlideDocument): string {
  const background = slide.background.type === 'color' ? slide.background.value : '#ffffff'
  const body = slide.elements
    .filter((element) => element.visible)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map(renderElement)
    .join('\n      ')
  const modelJson = JSON.stringify(slide, null, 2).replaceAll('</script', '<\\/script')

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style data-ppht-slide-style>
    html, body { margin: 0; width: 100%; height: 100%; background: ${background}; }
    [data-ppht-slide-root] { position: relative; width: 1920px; height: 1080px; overflow: hidden; background: ${background}; }
  </style>
</head>
<body>
  <main data-ppht-slide-root>
      ${body}
  </main>

  <script type="application/json" data-ppht-slide-model>
${modelJson}
  </script>
</body>
</html>
`
}

export function parseSlideHtml(html: string): SlideDocument {
  const match = html.match(/<script[^>]*data-ppht-slide-model[^>]*>([\s\S]*?)<\/script>/)
  if (!match?.[1]) {
    throw new Error('Missing PPHT slide model')
  }
  return JSON.parse(match[1].trim()) as SlideDocument
}
```

Modify `packages/core/src/index.ts`:

```ts
export * from './ids'
export * from './model'
export * from './factories'
export * from './documentOps'
export * from './commands'
export * from './serializer'
```

- [ ] **Step 4: Run serializer tests**

Run:

```powershell
pnpm --filter @ppht/core test -- serializer.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run all core tests**

Run:

```powershell
pnpm --filter @ppht/core test
```

Expected: PASS.

- [ ] **Step 6: Commit serializer**

Run:

```powershell
git add packages/core
git commit -m "feat(core): serialize slides to ppht html"
```

Expected: commit succeeds.

## Task 5: Local Project Service

**Files:**
- Create: `D:\NewStarProject\PPHT\apps\server\src\errors.ts`
- Create: `D:\NewStarProject\PPHT\apps\server\src\projectService.ts`
- Create: `D:\NewStarProject\PPHT\apps\server\tests\projectService.test.ts`

- [ ] **Step 1: Write project service tests**

Write `apps/server/tests/projectService.test.ts`:

```ts
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createProject, openProject, saveSlide } from '../src/projectService'

describe('projectService', () => {
  it('creates, opens, and saves a ppht project', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ppht-'))
    const projectPath = path.join(root, 'demo.ppht')

    const project = await createProject(projectPath, 'Demo Deck')
    expect(project.manifest.title).toBe('Demo Deck')
    expect(project.manifest.slides).toHaveLength(1)

    const firstSlide = project.slides[0]
    if (!firstSlide) throw new Error('Expected first slide')

    const saved = await saveSlide(projectPath, firstSlide.id, {
      ...firstSlide,
      title: 'Updated'
    })
    expect(saved.title).toBe('Updated')

    const reopened = await openProject(projectPath)
    expect(reopened.manifest.slides[0]?.id).toBe(firstSlide.id)
    expect(reopened.slides[0]?.title).toBe('Updated')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm --filter @ppht/server test -- projectService.test.ts
```

Expected: FAIL because `projectService` does not exist.

- [ ] **Step 3: Implement service errors**

Write `apps/server/src/errors.ts`:

```ts
export class ProjectError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400
  ) {
    super(message)
    this.name = 'ProjectError'
  }
}
```

- [ ] **Step 4: Implement project service**

Write `apps/server/src/projectService.ts`:

```ts
import fs from 'node:fs/promises'
import path from 'node:path'
import { createSlide, parseSlideHtml, serializeSlideToHtml, type ProjectManifest, type SlideDocument } from '@ppht/core'
import { ProjectError } from './errors'

export type OpenProjectResult = {
  projectPath: string
  manifest: ProjectManifest
  slides: SlideDocument[]
}

const defaultCanvas = {
  width: 1920,
  height: 1080,
  ratio: '16:9' as const
}

async function ensureProjectDirs(projectPath: string): Promise<void> {
  await fs.mkdir(path.join(projectPath, 'slides'), { recursive: true })
  await fs.mkdir(path.join(projectPath, 'assets', 'images'), { recursive: true })
  await fs.mkdir(path.join(projectPath, 'assets', 'fonts'), { recursive: true })
  await fs.mkdir(path.join(projectPath, 'assets', 'media'), { recursive: true })
  await fs.mkdir(path.join(projectPath, 'thumbs'), { recursive: true })
}

function manifestPath(projectPath: string): string {
  return path.join(projectPath, 'project.json')
}

function slidePath(projectPath: string, slideId: string): string {
  return path.join(projectPath, 'slides', `${slideId}.html`)
}

export async function createProject(projectPath: string, title: string): Promise<OpenProjectResult> {
  await ensureProjectDirs(projectPath)
  const slide = createSlide('slide-001', 'Title')
  const manifest: ProjectManifest = {
    version: '0.1.0',
    title,
    canvas: defaultCanvas,
    slides: [
      {
        id: slide.id,
        title: slide.title,
        html: 'slides/slide-001.html',
        thumbnail: 'thumbs/slide-001.png'
      }
    ],
    theme: {
      fonts: [],
      colors: []
    },
    assets: []
  }

  await fs.writeFile(manifestPath(projectPath), JSON.stringify(manifest, null, 2), 'utf8')
  await fs.writeFile(slidePath(projectPath, slide.id), serializeSlideToHtml(slide), 'utf8')

  return { projectPath, manifest, slides: [slide] }
}

export async function openProject(projectPath: string): Promise<OpenProjectResult> {
  let manifestRaw: string
  try {
    manifestRaw = await fs.readFile(manifestPath(projectPath), 'utf8')
  } catch {
    throw new ProjectError('Missing project.json', 404)
  }

  const manifest = JSON.parse(manifestRaw) as ProjectManifest
  const slides = await Promise.all(
    manifest.slides.map(async (slideRef) => {
      const html = await fs.readFile(path.join(projectPath, slideRef.html), 'utf8')
      return parseSlideHtml(html)
    })
  )

  return { projectPath, manifest, slides }
}

export async function saveProject(projectPath: string, manifest: ProjectManifest): Promise<ProjectManifest> {
  await ensureProjectDirs(projectPath)
  await fs.writeFile(manifestPath(projectPath), JSON.stringify(manifest, null, 2), 'utf8')
  return manifest
}

export async function saveSlide(projectPath: string, slideId: string, slide: SlideDocument): Promise<SlideDocument> {
  await ensureProjectDirs(projectPath)
  await fs.writeFile(slidePath(projectPath, slideId), serializeSlideToHtml(slide), 'utf8')
  const opened = await openProject(projectPath)
  const nextManifest: ProjectManifest = {
    ...opened.manifest,
    slides: opened.manifest.slides.map((ref) => (ref.id === slideId ? { ...ref, title: slide.title } : ref))
  }
  await saveProject(projectPath, nextManifest)
  return slide
}
```

- [ ] **Step 5: Run project service tests**

Run:

```powershell
pnpm --filter @ppht/server test -- projectService.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit project service**

Run:

```powershell
git add apps/server
git commit -m "feat(server): add local project service"
```

Expected: commit succeeds.

## Task 6: Export Service

**Files:**
- Create: `D:\NewStarProject\PPHT\apps\server\src\exportService.ts`
- Create: `D:\NewStarProject\PPHT\apps\server\tests\exportService.test.ts`

- [ ] **Step 1: Write export tests**

Write `apps/server/tests/exportService.test.ts`:

```ts
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createProject } from '../src/projectService'
import { exportDeck } from '../src/exportService'

describe('exportService', () => {
  it('exports self-contained and clean playback html', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ppht-export-'))
    const projectPath = path.join(root, 'demo.ppht')
    await createProject(projectPath, 'Demo Deck')

    const selfContained = await exportDeck(projectPath, path.join(root, 'demo-full.html'), 'self-contained')
    const clean = await exportDeck(projectPath, path.join(root, 'demo-clean.html'), 'clean')

    expect(await fs.readFile(selfContained, 'utf8')).toContain('data-ppht-project-model')
    expect(await fs.readFile(clean, 'utf8')).not.toContain('data-ppht-project-model')
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm --filter @ppht/server test -- exportService.test.ts
```

Expected: FAIL because `exportService` does not exist.

- [ ] **Step 3: Implement export service**

Write `apps/server/src/exportService.ts`:

```ts
import fs from 'node:fs/promises'
import { openProject } from './projectService'
import { serializeSlideToHtml } from '@ppht/core'

export type ExportMode = 'self-contained' | 'clean'

function escapeScriptJson(value: unknown): string {
  return JSON.stringify(value, null, 2).replaceAll('</script', '<\\/script')
}

function extractSlideRoot(html: string): string {
  const match = html.match(/<main[^>]*data-ppht-slide-root[^>]*>([\s\S]*?)<\/main>/)
  return match?.[1]?.trim() ?? ''
}

export async function exportDeck(projectPath: string, outputPath: string, mode: ExportMode): Promise<string> {
  const project = await openProject(projectPath)
  const slideSections = project.slides
    .map((slide, index) => {
      const rendered = serializeSlideToHtml(slide)
      const root = extractSlideRoot(rendered)
      return `<section class="ppht-slide" data-slide-index="${index}" aria-label="${slide.title}">${root}</section>`
    })
    .join('\n')

  const modelScript =
    mode === 'self-contained'
      ? `<script type="application/json" data-ppht-project-model>${escapeScriptJson(project)}</script>`
      : ''

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${project.manifest.title}</title>
  <style>
    html, body { margin: 0; width: 100%; height: 100%; background: #111827; }
    body { display: grid; place-items: center; font-family: Inter, Arial, sans-serif; }
    .ppht-deck { width: 100vw; height: 100vh; overflow: hidden; }
    .ppht-slide { position: relative; width: 1920px; height: 1080px; background: #fff; transform-origin: top left; display: none; overflow: hidden; }
    .ppht-slide:first-child { display: block; }
  </style>
</head>
<body>
  <main class="ppht-deck">
${slideSections}
  </main>
  ${modelScript}
  <script>
    const slides = Array.from(document.querySelectorAll('.ppht-slide'));
    let index = 0;
    function scaleSlide() {
      const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
      for (const slide of slides) slide.style.transform = 'scale(' + scale + ')';
    }
    function show(next) {
      slides[index].style.display = 'none';
      index = Math.max(0, Math.min(slides.length - 1, next));
      slides[index].style.display = 'block';
      scaleSlide();
    }
    window.addEventListener('resize', scaleSlide);
    window.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowRight' || event.key === ' ') show(index + 1);
      if (event.key === 'ArrowLeft') show(index - 1);
    });
    scaleSlide();
  </script>
</body>
</html>
`

  await fs.writeFile(outputPath, html, 'utf8')
  return outputPath
}
```

- [ ] **Step 4: Run export tests**

Run:

```powershell
pnpm --filter @ppht/server test -- exportService.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit export service**

Run:

```powershell
git add apps/server/src/exportService.ts apps/server/tests/exportService.test.ts
git commit -m "feat(server): export pure html decks"
```

Expected: commit succeeds.

## Task 7: Express API

**Files:**
- Create: `D:\NewStarProject\PPHT\apps\server\src\api.ts`
- Create: `D:\NewStarProject\PPHT\apps\server\src\index.ts`

- [ ] **Step 1: Implement API routes**

Write `apps/server/src/api.ts`:

```ts
import express from 'express'
import { z } from 'zod'
import { exportDeck } from './exportService'
import { ProjectError } from './errors'
import { createProject, openProject, saveProject, saveSlide } from './projectService'

const projectPathSchema = z.object({
  projectPath: z.string().min(1)
})

export function createApi() {
  const app = express()
  app.use(express.json({ limit: '50mb' }))

  app.post('/api/projects', async (req, res, next) => {
    try {
      const body = projectPathSchema.extend({ title: z.string().min(1) }).parse(req.body)
      res.json(await createProject(body.projectPath, body.title))
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/projects/open', async (req, res, next) => {
    try {
      const body = projectPathSchema.parse(req.body)
      res.json(await openProject(body.projectPath))
    } catch (error) {
      next(error)
    }
  })

  app.put('/api/projects/manifest', async (req, res, next) => {
    try {
      const body = projectPathSchema.extend({ manifest: z.unknown() }).parse(req.body)
      res.json(await saveProject(body.projectPath, body.manifest as never))
    } catch (error) {
      next(error)
    }
  })

  app.put('/api/projects/slides/:slideId', async (req, res, next) => {
    try {
      const body = projectPathSchema.extend({ slide: z.unknown() }).parse(req.body)
      res.json(await saveSlide(body.projectPath, req.params.slideId, body.slide as never))
    } catch (error) {
      next(error)
    }
  })

  app.post('/api/projects/export', async (req, res, next) => {
    try {
      const body = projectPathSchema
        .extend({
          outputPath: z.string().min(1),
          mode: z.enum(['self-contained', 'clean'])
        })
        .parse(req.body)
      res.json({ outputPath: await exportDeck(body.projectPath, body.outputPath, body.mode) })
    } catch (error) {
      next(error)
    }
  })

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error instanceof ProjectError) {
      res.status(error.statusCode).json({ message: error.message })
      return
    }
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: error.issues.map((issue) => issue.message).join(', ') })
      return
    }
    const message = error instanceof Error ? error.message : 'Unknown server error'
    res.status(500).json({ message })
  })

  return app
}
```

Write `apps/server/src/index.ts`:

```ts
import cors from 'cors'
import { createApi } from './api'

const port = Number(process.env.PPHT_PORT ?? 3737)
const app = createApi()

app.use(cors({ origin: 'http://127.0.0.1:5173' }))

app.listen(port, '127.0.0.1', () => {
  console.log(`PPHT server listening on http://127.0.0.1:${port}`)
})
```

- [ ] **Step 2: Run server typecheck**

Run:

```powershell
pnpm --filter @ppht/server typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit API**

Run:

```powershell
git add apps/server/src/api.ts apps/server/src/index.ts
git commit -m "feat(server): expose local project api"
```

Expected: commit succeeds.

## Task 8: Editor Store and API Client

**Files:**
- Create: `D:\NewStarProject\PPHT\apps\editor\src\api\projectClient.ts`
- Create: `D:\NewStarProject\PPHT\apps\editor\src\store\editorStore.ts`

- [ ] **Step 1: Implement API client**

Write `apps/editor/src/api/projectClient.ts`:

```ts
import type { ProjectManifest, SlideDocument } from '@ppht/core'

export type OpenProjectResult = {
  projectPath: string
  manifest: ProjectManifest
  slides: SlideDocument[]
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers
    }
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => ({ message: response.statusText }))) as { message: string }
    throw new Error(body.message)
  }
  return response.json() as Promise<T>
}

export const projectClient = {
  createProject(projectPath: string, title: string) {
    return request<OpenProjectResult>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ projectPath, title })
    })
  },

  openProject(projectPath: string) {
    return request<OpenProjectResult>('/api/projects/open', {
      method: 'POST',
      body: JSON.stringify({ projectPath })
    })
  },

  saveSlide(projectPath: string, slide: SlideDocument) {
    return request<SlideDocument>(`/api/projects/slides/${slide.id}`, {
      method: 'PUT',
      body: JSON.stringify({ projectPath, slide })
    })
  },

  exportDeck(projectPath: string, outputPath: string, mode: 'self-contained' | 'clean') {
    return request<{ outputPath: string }>('/api/projects/export', {
      method: 'POST',
      body: JSON.stringify({ projectPath, outputPath, mode })
    })
  }
}
```

- [ ] **Step 2: Implement editor store**

Write `apps/editor/src/store/editorStore.ts`:

```ts
import {
  AddElementCommand,
  CommandHistory,
  createId,
  createTextElement,
  type ProjectManifest,
  type SlideDocument,
  type SlideCommand
} from '@ppht/core'
import { create } from 'zustand'
import { projectClient } from '../api/projectClient'

type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error'

type EditorState = {
  projectPath: string
  manifest?: ProjectManifest
  slides: SlideDocument[]
  currentSlideId?: string
  selectedElementIds: string[]
  zoom: number
  saveState: SaveState
  error?: string
  history?: CommandHistory
  currentSlide?: () => SlideDocument | undefined
  createProject: (projectPath: string, title: string) => Promise<void>
  openProject: (projectPath: string) => Promise<void>
  selectSlide: (slideId: string) => void
  selectElement: (elementId: string) => void
  runCommand: (command: SlideCommand) => void
  addText: () => void
  undo: () => void
  redo: () => void
  saveCurrentSlide: () => Promise<void>
}

function replaceSlide(slides: SlideDocument[], next: SlideDocument): SlideDocument[] {
  return slides.map((slide) => (slide.id === next.id ? next : slide))
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projectPath: '',
  slides: [],
  selectedElementIds: [],
  zoom: 0.45,
  saveState: 'idle',

  currentSlide: () => get().slides.find((slide) => slide.id === get().currentSlideId),

  async createProject(projectPath, title) {
    const result = await projectClient.createProject(projectPath, title)
    const first = result.slides[0]
    set({
      projectPath,
      manifest: result.manifest,
      slides: result.slides,
      currentSlideId: first?.id,
      history: first ? new CommandHistory(first) : undefined,
      saveState: 'saved',
      error: undefined
    })
  },

  async openProject(projectPath) {
    const result = await projectClient.openProject(projectPath)
    const first = result.slides[0]
    set({
      projectPath,
      manifest: result.manifest,
      slides: result.slides,
      currentSlideId: first?.id,
      history: first ? new CommandHistory(first) : undefined,
      saveState: 'saved',
      error: undefined
    })
  },

  selectSlide(slideId) {
    const slide = get().slides.find((item) => item.id === slideId)
    set({
      currentSlideId: slideId,
      selectedElementIds: [],
      history: slide ? new CommandHistory(slide) : undefined
    })
  },

  selectElement(elementId) {
    set({ selectedElementIds: [elementId] })
  },

  runCommand(command) {
    const { history } = get()
    if (!history) return
    const next = history.run(command)
    set({
      slides: replaceSlide(get().slides, next),
      saveState: 'dirty'
    })
  },

  addText() {
    const element = createTextElement(createId('text'), { x: 160, y: 160, width: 420, height: 110 }, 'Text')
    get().runCommand(new AddElementCommand(element))
    set({ selectedElementIds: [element.id] })
  },

  undo() {
    const { history } = get()
    if (!history) return
    const next = history.undo()
    set({ slides: replaceSlide(get().slides, next), saveState: 'dirty' })
  },

  redo() {
    const { history } = get()
    if (!history) return
    const next = history.redo()
    set({ slides: replaceSlide(get().slides, next), saveState: 'dirty' })
  },

  async saveCurrentSlide() {
    const slide = get().currentSlide?.()
    if (!slide || !get().projectPath) return
    set({ saveState: 'saving' })
    try {
      await projectClient.saveSlide(get().projectPath, slide)
      set({ saveState: 'saved', error: undefined })
    } catch (error) {
      set({ saveState: 'error', error: error instanceof Error ? error.message : 'Save failed' })
    }
  }
}))
```

- [ ] **Step 3: Run editor typecheck**

Run:

```powershell
pnpm --filter @ppht/editor typecheck
```

Expected: may fail only because React entry files are not created. Store and API client must have no TypeScript errors.

- [ ] **Step 4: Commit editor state**

Run:

```powershell
git add apps/editor/src/api apps/editor/src/store
git commit -m "feat(editor): add project client and editor store"
```

Expected: commit succeeds.

## Task 9: Editor UI Shell

**Files:**
- Create: `D:\NewStarProject\PPHT\apps\editor\src\main.tsx`
- Create: `D:\NewStarProject\PPHT\apps\editor\src\App.tsx`
- Create: `D:\NewStarProject\PPHT\apps\editor\src\components\Toolbar.tsx`
- Create: `D:\NewStarProject\PPHT\apps\editor\src\components\SlideRail.tsx`
- Create: `D:\NewStarProject\PPHT\apps\editor\src\components\StatusBar.tsx`
- Create: `D:\NewStarProject\PPHT\apps\editor\src\styles.css`

- [ ] **Step 1: Implement React entry**

Write `apps/editor/src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 2: Implement toolbar**

Write `apps/editor/src/components/Toolbar.tsx`:

```tsx
import { Download, FilePlus2, FolderOpen, Redo2, Save, Type, Undo2 } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'

export function Toolbar() {
  const createProject = useEditorStore((state) => state.createProject)
  const openProject = useEditorStore((state) => state.openProject)
  const addText = useEditorStore((state) => state.addText)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const saveCurrentSlide = useEditorStore((state) => state.saveCurrentSlide)
  const projectPath = useEditorStore((state) => state.projectPath)

  return (
    <header className="toolbar">
      <button title="New" onClick={() => createProject('D:\\NewStarProject\\PPHT\\demo.ppht', 'Demo Deck')}>
        <FilePlus2 size={18} />
      </button>
      <button title="Open" onClick={() => openProject('D:\\NewStarProject\\PPHT\\demo.ppht')}>
        <FolderOpen size={18} />
      </button>
      <button title="Save" onClick={() => saveCurrentSlide()}>
        <Save size={18} />
      </button>
      <span className="toolbar-divider" />
      <button title="Undo" onClick={undo}>
        <Undo2 size={18} />
      </button>
      <button title="Redo" onClick={redo}>
        <Redo2 size={18} />
      </button>
      <span className="toolbar-divider" />
      <button title="Text" onClick={addText}>
        <Type size={18} />
      </button>
      <button title="Export" disabled={!projectPath}>
        <Download size={18} />
      </button>
    </header>
  )
}
```

- [ ] **Step 3: Implement slide rail**

Write `apps/editor/src/components/SlideRail.tsx`:

```tsx
import { useEditorStore } from '../store/editorStore'

export function SlideRail() {
  const slides = useEditorStore((state) => state.slides)
  const currentSlideId = useEditorStore((state) => state.currentSlideId)
  const selectSlide = useEditorStore((state) => state.selectSlide)

  return (
    <aside className="slide-rail" aria-label="Slides">
      {slides.map((slide, index) => (
        <button
          className={slide.id === currentSlideId ? 'slide-thumb active' : 'slide-thumb'}
          key={slide.id}
          onClick={() => selectSlide(slide.id)}
        >
          <span>{index + 1}</span>
          <strong>{slide.title}</strong>
        </button>
      ))}
    </aside>
  )
}
```

- [ ] **Step 4: Implement status bar**

Write `apps/editor/src/components/StatusBar.tsx`:

```tsx
import { useEditorStore } from '../store/editorStore'

export function StatusBar() {
  const zoom = useEditorStore((state) => state.zoom)
  const saveState = useEditorStore((state) => state.saveState)
  const currentSlideId = useEditorStore((state) => state.currentSlideId)

  return (
    <footer className="status-bar">
      <span>{currentSlideId ?? 'No slide'}</span>
      <span>{Math.round(zoom * 100)}%</span>
      <span>{saveState}</span>
    </footer>
  )
}
```

- [ ] **Step 5: Implement app shell and styles**

Write `apps/editor/src/App.tsx`:

```tsx
import { Canvas } from './components/Canvas'
import { PropertyPanel } from './components/PropertyPanel'
import { SlideRail } from './components/SlideRail'
import { StatusBar } from './components/StatusBar'
import { Toolbar } from './components/Toolbar'

export function App() {
  return (
    <div className="app-shell">
      <Toolbar />
      <SlideRail />
      <main className="workspace">
        <Canvas />
      </main>
      <PropertyPanel />
      <StatusBar />
    </div>
  )
}
```

Write `apps/editor/src/styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Inter, Arial, sans-serif;
  color: #172033;
  background: #e9edf3;
}

button {
  border: 1px solid #c8d0dc;
  background: #ffffff;
  color: #172033;
  cursor: pointer;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.app-shell {
  display: grid;
  grid-template-columns: 220px 1fr 280px;
  grid-template-rows: 48px 1fr 28px;
  width: 100vw;
  height: 100vh;
}

.toolbar {
  grid-column: 1 / 4;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid #c8d0dc;
  background: #f8fafc;
}

.toolbar button {
  width: 34px;
  height: 34px;
  border-radius: 6px;
  display: grid;
  place-items: center;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: #c8d0dc;
  margin: 0 4px;
}

.slide-rail {
  overflow: auto;
  padding: 10px;
  border-right: 1px solid #c8d0dc;
  background: #f8fafc;
}

.slide-thumb {
  width: 100%;
  height: 92px;
  margin-bottom: 10px;
  border-radius: 6px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px;
  text-align: left;
}

.slide-thumb.active {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.16);
}

.workspace {
  overflow: auto;
  display: grid;
  place-items: center;
  background: #d8dee8;
}

.status-bar {
  grid-column: 1 / 4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 12px;
  border-top: 1px solid #c8d0dc;
  background: #f8fafc;
  font-size: 12px;
}
```

- [ ] **Step 6: Run editor typecheck**

Run:

```powershell
pnpm --filter @ppht/editor typecheck
```

Expected: fails only because `Canvas` and `PropertyPanel` are not created yet.

- [ ] **Step 7: Commit shell**

Run:

```powershell
git add apps/editor/src/main.tsx apps/editor/src/App.tsx apps/editor/src/components/Toolbar.tsx apps/editor/src/components/SlideRail.tsx apps/editor/src/components/StatusBar.tsx apps/editor/src/styles.css
git commit -m "feat(editor): add application shell"
```

Expected: commit succeeds.

## Task 10: Canvas and Property Panel

**Files:**
- Create: `D:\NewStarProject\PPHT\apps\editor\src\components\Canvas.tsx`
- Create: `D:\NewStarProject\PPHT\apps\editor\src\components\PropertyPanel.tsx`
- Modify: `D:\NewStarProject\PPHT\apps\editor\src\styles.css`

- [ ] **Step 1: Implement canvas renderer**

Write `apps/editor/src/components/Canvas.tsx`:

```tsx
import type { ElementNode } from '@ppht/core'
import { UpdateElementCommand } from '@ppht/core'
import { useEditorStore } from '../store/editorStore'

function ElementView({ element }: { element: ElementNode }) {
  const selectElement = useEditorStore((state) => state.selectElement)
  const selected = useEditorStore((state) => state.selectedElementIds.includes(element.id))
  const runCommand = useEditorStore((state) => state.runCommand)

  const style = {
    left: element.x,
    top: element.y,
    width: element.width,
    height: element.height,
    transform: `rotate(${element.rotation}deg)`,
    zIndex: element.zIndex,
    display: element.visible ? undefined : 'none',
    ...element.style
  } as React.CSSProperties

  const onPointerDown = (event: React.PointerEvent) => {
    event.stopPropagation()
    selectElement(element.id)
    const startX = event.clientX
    const startY = event.clientY
    const originX = element.x
    const originY = element.y
    const target = event.currentTarget as HTMLElement
    target.setPointerCapture(event.pointerId)

    const move = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX
      const dy = moveEvent.clientY - startY
      target.style.left = `${originX + dx}px`
      target.style.top = `${originY + dy}px`
    }

    const up = (upEvent: PointerEvent) => {
      target.releasePointerCapture(event.pointerId)
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
      runCommand(new UpdateElementCommand(element.id, { x: originX + upEvent.clientX - startX, y: originY + upEvent.clientY - startY }))
    }

    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  if (element.type === 'text') {
    return (
      <div className={selected ? 'canvas-element selected' : 'canvas-element'} style={style} onPointerDown={onPointerDown}>
        {element.content.text}
      </div>
    )
  }

  if (element.type === 'image') {
    return <img className={selected ? 'canvas-element selected' : 'canvas-element'} style={style} src={element.content.src} alt={element.content.alt} onPointerDown={onPointerDown} />
  }

  if (element.type === 'shape') {
    return <div className={selected ? 'canvas-element shape selected' : 'canvas-element shape'} style={style} onPointerDown={onPointerDown} />
  }

  return (
    <svg className={selected ? 'canvas-element selected' : 'canvas-element'} style={style} viewBox={`0 0 ${element.width} ${element.height}`} onPointerDown={onPointerDown}>
      <line x1={element.content.x1} y1={element.content.y1} x2={element.content.x2} y2={element.content.y2} stroke={String(element.style.stroke ?? '#111827')} strokeWidth={Number(element.style.strokeWidth ?? 3)} />
    </svg>
  )
}

export function Canvas() {
  const slide = useEditorStore((state) => state.currentSlide?.())
  const zoom = useEditorStore((state) => state.zoom)

  if (!slide) {
    return <div className="empty-canvas">Create or open a project</div>
  }

  return (
    <div className="canvas-frame" style={{ transform: `scale(${zoom})` }}>
      <div className="slide-canvas" onPointerDown={() => useEditorStore.getState().selectElement('')}>
        {slide.elements
          .slice()
          .sort((a, b) => a.zIndex - b.zIndex)
          .map((element) => (
            <ElementView key={element.id} element={element} />
          ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement property panel**

Write `apps/editor/src/components/PropertyPanel.tsx`:

```tsx
import { UpdateElementCommand } from '@ppht/core'
import { useEditorStore } from '../store/editorStore'

export function PropertyPanel() {
  const slide = useEditorStore((state) => state.currentSlide?.())
  const selectedId = useEditorStore((state) => state.selectedElementIds[0])
  const runCommand = useEditorStore((state) => state.runCommand)
  const element = slide?.elements.find((item) => item.id === selectedId)

  const updateNumber = (key: 'x' | 'y' | 'width' | 'height' | 'rotation') => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!element) return
    runCommand(new UpdateElementCommand(element.id, { [key]: Number(event.target.value) }))
  }

  return (
    <aside className="property-panel">
      <h2>Properties</h2>
      {!element ? (
        <p className="muted">No selection</p>
      ) : (
        <div className="property-grid">
          <label>
            X
            <input type="number" value={element.x} onChange={updateNumber('x')} />
          </label>
          <label>
            Y
            <input type="number" value={element.y} onChange={updateNumber('y')} />
          </label>
          <label>
            W
            <input type="number" value={element.width} onChange={updateNumber('width')} />
          </label>
          <label>
            H
            <input type="number" value={element.height} onChange={updateNumber('height')} />
          </label>
          <label>
            Rotate
            <input type="number" value={element.rotation} onChange={updateNumber('rotation')} />
          </label>
        </div>
      )}
    </aside>
  )
}
```

- [ ] **Step 3: Add canvas styles**

Append to `apps/editor/src/styles.css`:

```css
.empty-canvas {
  padding: 20px;
  color: #475569;
}

.canvas-frame {
  width: 1920px;
  height: 1080px;
  transform-origin: center;
}

.slide-canvas {
  position: relative;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
  background: #ffffff;
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.28);
}

.canvas-element {
  position: absolute;
  user-select: none;
  touch-action: none;
}

.canvas-element.selected {
  outline: 3px solid #2563eb;
}

.canvas-element.shape {
  background: #ffffff;
  border: 3px solid #2563eb;
}

.property-panel {
  padding: 12px;
  border-left: 1px solid #c8d0dc;
  background: #f8fafc;
}

.property-panel h2 {
  margin: 0 0 12px;
  font-size: 14px;
}

.property-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.property-grid label {
  display: grid;
  gap: 4px;
  font-size: 12px;
}

.property-grid input {
  width: 100%;
  height: 30px;
  border: 1px solid #c8d0dc;
  border-radius: 4px;
  padding: 0 6px;
}

.muted {
  color: #64748b;
  font-size: 13px;
}
```

- [ ] **Step 4: Run editor typecheck**

Run:

```powershell
pnpm --filter @ppht/editor typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit canvas and properties**

Run:

```powershell
git add apps/editor/src/components/Canvas.tsx apps/editor/src/components/PropertyPanel.tsx apps/editor/src/styles.css
git commit -m "feat(editor): add editable canvas"
```

Expected: commit succeeds.

## Task 11: Slide Management UI

**Files:**
- Modify: `D:\NewStarProject\PPHT\packages\core\src\documentOps.ts`
- Modify: `D:\NewStarProject\PPHT\packages\core\tests\documentOps.test.ts`
- Modify: `D:\NewStarProject\PPHT\apps\editor\src\store\editorStore.ts`
- Modify: `D:\NewStarProject\PPHT\apps\editor\src\components\SlideRail.tsx`
- Modify: `D:\NewStarProject\PPHT\apps\editor\src\styles.css`

- [ ] **Step 1: Extend document operation tests for slide references**

Append to `packages/core/tests/documentOps.test.ts`:

```ts
import { createSlideRef, deleteSlideRef, duplicateSlideRef } from '../src/index'

describe('slide reference operations', () => {
  it('creates, duplicates, deletes, and reorders slide references', () => {
    const first = createSlideRef('slide-001', 'One')
    const second = createSlideRef('slide-002', 'Two')
    const duplicate = duplicateSlideRef(first, 'slide-003')

    expect(duplicate).toEqual({
      id: 'slide-003',
      title: 'One Copy',
      html: 'slides/slide-003.html',
      thumbnail: 'thumbs/slide-003.png'
    })

    const withoutSecond = deleteSlideRef([first, second, duplicate], 'slide-002')
    expect(withoutSecond.map((slide) => slide.id)).toEqual(['slide-001', 'slide-003'])
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```powershell
pnpm --filter @ppht/core test -- documentOps.test.ts
```

Expected: FAIL because slide reference helpers are not exported.

- [ ] **Step 3: Implement slide reference helpers**

Append to `packages/core/src/documentOps.ts`:

```ts
import type { ProjectSlideRef } from './model'

export function createSlideRef(id: string, title: string): ProjectSlideRef {
  return {
    id,
    title,
    html: `slides/${id}.html`,
    thumbnail: `thumbs/${id}.png`
  }
}

export function duplicateSlideRef(slide: ProjectSlideRef, newId: string): ProjectSlideRef {
  return createSlideRef(newId, `${slide.title} Copy`)
}

export function deleteSlideRef(slides: ProjectSlideRef[], slideId: string): ProjectSlideRef[] {
  return slides.filter((slide) => slide.id !== slideId)
}
```

- [ ] **Step 4: Add store actions for slide management**

In `apps/editor/src/store/editorStore.ts`, extend the imports:

```ts
import {
  AddElementCommand,
  CommandHistory,
  createId,
  createSlide,
  createSlideRef,
  createTextElement,
  duplicateSlide,
  duplicateSlideRef,
  reorderSlides,
  type ProjectManifest,
  type SlideCommand,
  type SlideDocument
} from '@ppht/core'
```

Add these fields to `EditorState`:

```ts
  addSlide: () => void
  duplicateCurrentSlide: () => void
  deleteCurrentSlide: () => void
  moveCurrentSlide: (direction: -1 | 1) => void
```

Add these methods inside the store object:

```ts
  addSlide() {
    const id = createId('slide')
    const slide = createSlide(id, 'Untitled')
    const ref = createSlideRef(id, slide.title)
    const manifest = get().manifest
    if (!manifest) return
    set({
      manifest: { ...manifest, slides: [...manifest.slides, ref] },
      slides: [...get().slides, slide],
      currentSlideId: id,
      history: new CommandHistory(slide),
      selectedElementIds: [],
      saveState: 'dirty'
    })
  },

  duplicateCurrentSlide() {
    const current = get().currentSlide?.()
    const manifest = get().manifest
    if (!current || !manifest) return
    const id = createId('slide')
    const duplicate = duplicateSlide(current, id)
    const sourceRef = manifest.slides.find((slide) => slide.id === current.id)
    const duplicateRef = duplicateSlideRef(sourceRef ?? createSlideRef(current.id, current.title), id)
    const currentIndex = get().slides.findIndex((slide) => slide.id === current.id)
    const slides = [...get().slides]
    slides.splice(currentIndex + 1, 0, duplicate)
    const refs = [...manifest.slides]
    refs.splice(currentIndex + 1, 0, duplicateRef)
    set({
      manifest: { ...manifest, slides: refs },
      slides,
      currentSlideId: id,
      history: new CommandHistory(duplicate),
      selectedElementIds: [],
      saveState: 'dirty'
    })
  },

  deleteCurrentSlide() {
    const currentId = get().currentSlideId
    const manifest = get().manifest
    if (!currentId || !manifest || get().slides.length <= 1) return
    const slides = get().slides.filter((slide) => slide.id !== currentId)
    const refs = manifest.slides.filter((slide) => slide.id !== currentId)
    const next = slides[0]
    set({
      manifest: { ...manifest, slides: refs },
      slides,
      currentSlideId: next?.id,
      history: next ? new CommandHistory(next) : undefined,
      selectedElementIds: [],
      saveState: 'dirty'
    })
  },

  moveCurrentSlide(direction) {
    const currentId = get().currentSlideId
    const manifest = get().manifest
    if (!currentId || !manifest) return
    const fromIndex = get().slides.findIndex((slide) => slide.id === currentId)
    const toIndex = fromIndex + direction
    if (fromIndex < 0 || toIndex < 0 || toIndex >= get().slides.length) return
    set({
      slides: reorderSlides(get().slides, fromIndex, toIndex),
      manifest: { ...manifest, slides: reorderSlides(manifest.slides, fromIndex, toIndex) },
      saveState: 'dirty'
    })
  },
```

- [ ] **Step 5: Add slide rail controls**

Replace `apps/editor/src/components/SlideRail.tsx` with:

```tsx
import { Copy, Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'

export function SlideRail() {
  const slides = useEditorStore((state) => state.slides)
  const currentSlideId = useEditorStore((state) => state.currentSlideId)
  const selectSlide = useEditorStore((state) => state.selectSlide)
  const addSlide = useEditorStore((state) => state.addSlide)
  const duplicateCurrentSlide = useEditorStore((state) => state.duplicateCurrentSlide)
  const deleteCurrentSlide = useEditorStore((state) => state.deleteCurrentSlide)
  const moveCurrentSlide = useEditorStore((state) => state.moveCurrentSlide)

  return (
    <aside className="slide-rail" aria-label="Slides">
      <div className="slide-actions">
        <button title="Add slide" onClick={addSlide}><Plus size={16} /></button>
        <button title="Duplicate slide" onClick={duplicateCurrentSlide}><Copy size={16} /></button>
        <button title="Delete slide" onClick={deleteCurrentSlide}><Trash2 size={16} /></button>
        <button title="Move slide up" onClick={() => moveCurrentSlide(-1)}><ArrowUp size={16} /></button>
        <button title="Move slide down" onClick={() => moveCurrentSlide(1)}><ArrowDown size={16} /></button>
      </div>
      {slides.map((slide, index) => (
        <button
          className={slide.id === currentSlideId ? 'slide-thumb active' : 'slide-thumb'}
          key={slide.id}
          onClick={() => selectSlide(slide.id)}
        >
          <span>{index + 1}</span>
          <strong>{slide.title}</strong>
          <small>{slide.elements.length} elements</small>
        </button>
      ))}
    </aside>
  )
}
```

Append to `apps/editor/src/styles.css`:

```css
.slide-actions {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  margin-bottom: 10px;
}

.slide-actions button {
  height: 30px;
  border-radius: 5px;
  display: grid;
  place-items: center;
}

.slide-thumb {
  flex-direction: column;
}

.slide-thumb small {
  color: #64748b;
}
```

- [ ] **Step 6: Run tests and typecheck**

Run:

```powershell
pnpm --filter @ppht/core test -- documentOps.test.ts
pnpm --filter @ppht/editor typecheck
```

Expected: both commands pass.

- [ ] **Step 7: Commit slide management**

Run:

```powershell
git add packages/core apps/editor/src/store/editorStore.ts apps/editor/src/components/SlideRail.tsx apps/editor/src/styles.css
git commit -m "feat(editor): manage slides from the rail"
```

Expected: commit succeeds.

## Task 12: Image, Shape, and Line Tools

**Files:**
- Modify: `D:\NewStarProject\PPHT\apps\editor\src\store\editorStore.ts`
- Modify: `D:\NewStarProject\PPHT\apps\editor\src\components\Toolbar.tsx`
- Modify: `D:\NewStarProject\PPHT\apps\editor\src\components\PropertyPanel.tsx`

- [ ] **Step 1: Add insertion actions to the store**

Extend the `@ppht/core` import in `apps/editor/src/store/editorStore.ts`:

```ts
  createImageElement,
  createLineElement,
  createShapeElement,
```

Add these fields to `EditorState`:

```ts
  addImage: () => void
  addShape: () => void
  addLine: () => void
```

Add these methods inside the store object:

```ts
  addImage() {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#dbeafe"/><text x="320" y="190" text-anchor="middle" font-size="42" font-family="Arial" fill="#1e3a8a">Image</text></svg>'
    const src = `data:image/svg+xml;base64,${btoa(svg)}`
    const element = createImageElement(createId('image'), { x: 220, y: 180, width: 480, height: 270 }, src, 'Placeholder image')
    get().runCommand(new AddElementCommand(element))
    set({ selectedElementIds: [element.id] })
  },

  addShape() {
    const element = createShapeElement(createId('shape'), { x: 260, y: 220, width: 320, height: 180 }, 'rectangle')
    get().runCommand(new AddElementCommand(element))
    set({ selectedElementIds: [element.id] })
  },

  addLine() {
    const element = createLineElement(createId('line'), { x: 260, y: 280, width: 420, height: 80 })
    get().runCommand(new AddElementCommand(element))
    set({ selectedElementIds: [element.id] })
  },
```

- [ ] **Step 2: Add toolbar buttons**

Replace `apps/editor/src/components/Toolbar.tsx` with:

```tsx
import { Circle, Download, FilePlus2, FolderOpen, Image, Minus, Redo2, Save, Square, Type, Undo2 } from 'lucide-react'
import { useEditorStore } from '../store/editorStore'

export function Toolbar() {
  const createProject = useEditorStore((state) => state.createProject)
  const openProject = useEditorStore((state) => state.openProject)
  const addText = useEditorStore((state) => state.addText)
  const addImage = useEditorStore((state) => state.addImage)
  const addShape = useEditorStore((state) => state.addShape)
  const addLine = useEditorStore((state) => state.addLine)
  const undo = useEditorStore((state) => state.undo)
  const redo = useEditorStore((state) => state.redo)
  const saveCurrentSlide = useEditorStore((state) => state.saveCurrentSlide)
  const projectPath = useEditorStore((state) => state.projectPath)

  return (
    <header className="toolbar">
      <button title="New" onClick={() => createProject('D:\\NewStarProject\\PPHT\\demo.ppht', 'Demo Deck')}>
        <FilePlus2 size={18} />
      </button>
      <button title="Open" onClick={() => openProject('D:\\NewStarProject\\PPHT\\demo.ppht')}>
        <FolderOpen size={18} />
      </button>
      <button title="Save" onClick={() => saveCurrentSlide()}>
        <Save size={18} />
      </button>
      <span className="toolbar-divider" />
      <button title="Undo" onClick={undo}>
        <Undo2 size={18} />
      </button>
      <button title="Redo" onClick={redo}>
        <Redo2 size={18} />
      </button>
      <span className="toolbar-divider" />
      <button title="Text" onClick={addText}>
        <Type size={18} />
      </button>
      <button title="Image" onClick={addImage}>
        <Image size={18} />
      </button>
      <button title="Shape" onClick={addShape}>
        <Square size={18} />
      </button>
      <button title="Line" onClick={addLine}>
        <Minus size={18} />
      </button>
      <button title="Ellipse" onClick={addShape}>
        <Circle size={18} />
      </button>
      <span className="toolbar-divider" />
      <button title="Export" disabled={!projectPath}>
        <Download size={18} />
      </button>
    </header>
  )
}
```

- [ ] **Step 3: Extend property panel for visibility, lock, and z-index**

Inside `apps/editor/src/components/PropertyPanel.tsx`, add this helper below `updateNumber`:

```tsx
  const updateBoolean = (key: 'visible' | 'locked') => (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!element) return
    runCommand(new UpdateElementCommand(element.id, { [key]: event.target.checked }))
  }
```

Inside the selected-element form, after the Rotate field, add:

```tsx
          <label>
            Layer
            <input type="number" value={element.zIndex} onChange={(event) => runCommand(new UpdateElementCommand(element.id, { zIndex: Number(event.target.value) }))} />
          </label>
          <label className="check-row">
            <input type="checkbox" checked={element.visible} onChange={updateBoolean('visible')} />
            Visible
          </label>
          <label className="check-row">
            <input type="checkbox" checked={element.locked} onChange={updateBoolean('locked')} />
            Locked
          </label>
```

- [ ] **Step 4: Run editor typecheck**

Run:

```powershell
pnpm --filter @ppht/editor typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit insertion tools**

Run:

```powershell
git add apps/editor/src/store/editorStore.ts apps/editor/src/components/Toolbar.tsx apps/editor/src/components/PropertyPanel.tsx
git commit -m "feat(editor): add image shape and line tools"
```

Expected: commit succeeds.

## Task 13: Export Button, Manifest Save, and Thumbnails

**Files:**
- Modify: `D:\NewStarProject\PPHT\apps\server\src\projectService.ts`
- Modify: `D:\NewStarProject\PPHT\apps\editor\src\api\projectClient.ts`
- Modify: `D:\NewStarProject\PPHT\apps\editor\src\store\editorStore.ts`
- Modify: `D:\NewStarProject\PPHT\apps\editor\src\components\Toolbar.tsx`

- [ ] **Step 1: Persist manifest changes when saving**

In `apps/editor/src/api/projectClient.ts`, add:

```ts
  saveProject(projectPath: string, manifest: ProjectManifest) {
    return request<ProjectManifest>('/api/projects/manifest', {
      method: 'PUT',
      body: JSON.stringify({ projectPath, manifest })
    })
  },
```

In `apps/editor/src/store/editorStore.ts`, replace `saveCurrentSlide` with:

```ts
  async saveCurrentSlide() {
    const slide = get().currentSlide?.()
    const manifest = get().manifest
    if (!slide || !manifest || !get().projectPath) return
    set({ saveState: 'saving' })
    try {
      await projectClient.saveProject(get().projectPath, manifest)
      await Promise.all(get().slides.map((item) => projectClient.saveSlide(get().projectPath, item)))
      set({ saveState: 'saved', error: undefined })
    } catch (error) {
      set({ saveState: 'error', error: error instanceof Error ? error.message : 'Save failed' })
    }
  },
```

- [ ] **Step 2: Add export action to the store**

Add this field to `EditorState`:

```ts
  exportDeck: (mode: 'self-contained' | 'clean') => Promise<void>
```

Add this method inside the store object:

```ts
  async exportDeck(mode) {
    const { projectPath } = get()
    if (!projectPath) return
    await get().saveCurrentSlide()
    const suffix = mode === 'self-contained' ? 'full' : 'clean'
    const outputPath = projectPath.replace(/\.ppht$/i, `-${suffix}.html`)
    try {
      await projectClient.exportDeck(projectPath, outputPath, mode)
      set({ saveState: 'saved', error: undefined })
    } catch (error) {
      set({ saveState: 'error', error: error instanceof Error ? error.message : 'Export failed' })
    }
  },
```

- [ ] **Step 3: Wire export toolbar buttons**

In `apps/editor/src/components/Toolbar.tsx`, add:

```tsx
  const exportDeck = useEditorStore((state) => state.exportDeck)
```

Replace the single export button with:

```tsx
      <button title="Export self-contained HTML" disabled={!projectPath} onClick={() => exportDeck('self-contained')}>
        <Download size={18} />
      </button>
      <button title="Export clean HTML" disabled={!projectPath} onClick={() => exportDeck('clean')}>
        <Download size={18} />
      </button>
```

- [ ] **Step 4: Generate simple thumbnail files on save**

In `apps/server/src/projectService.ts`, add this helper:

```ts
async function writeThumbnail(projectPath: string, slide: SlideDocument): Promise<void> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#ffffff" stroke="#c8d0dc"/><text x="16" y="32" font-family="Arial" font-size="18" fill="#172033">${slide.title}</text><text x="16" y="64" font-family="Arial" font-size="14" fill="#64748b">${slide.elements.length} elements</text></svg>`
  await fs.writeFile(path.join(projectPath, 'thumbs', `${slide.id}.svg`), svg, 'utf8')
}
```

Call it in `createProject` after writing the slide HTML:

```ts
  await writeThumbnail(projectPath, slide)
```

Call it in `saveSlide` after writing the slide HTML:

```ts
  await writeThumbnail(projectPath, slide)
```

- [ ] **Step 5: Run service and editor checks**

Run:

```powershell
pnpm --filter @ppht/server test
pnpm --filter @ppht/editor typecheck
```

Expected: both commands pass.

- [ ] **Step 6: Commit export and thumbnail wiring**

Run:

```powershell
git add apps/server/src/projectService.ts apps/editor/src/api/projectClient.ts apps/editor/src/store/editorStore.ts apps/editor/src/components/Toolbar.tsx
git commit -m "feat(editor): save manifests and export decks"
```

Expected: commit succeeds.

## Task 14: Phase 1 Verification and End-to-End Test

**Files:**
- Create: `D:\NewStarProject\PPHT\apps\editor\playwright.config.ts`
- Create: `D:\NewStarProject\PPHT\apps\editor\tests\editor-flow.spec.ts`

- [ ] **Step 1: Add Playwright config**

Write `apps/editor/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry'
  },
  webServer: [
    {
      command: 'pnpm --filter @ppht/server dev',
      url: 'http://127.0.0.1:3737/api/projects/open',
      reuseExistingServer: true,
      timeout: 10_000
    },
    {
      command: 'pnpm --filter @ppht/editor dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: true,
      timeout: 10_000
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
```

- [ ] **Step 2: Add E2E test**

Write `apps/editor/tests/editor-flow.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('creates a project, inserts text, and saves the slide', async ({ page }) => {
  await page.goto('/')

  await page.getByTitle('New').click()
  await expect(page.getByLabel('Slides')).toContainText('Title')

  await page.getByTitle('Text').click()
  await expect(page.locator('.canvas-element')).toContainText('Text')

  await page.getByTitle('Shape').click()
  await expect(page.locator('.canvas-element')).toHaveCount(2)

  await page.getByTitle('Line').click()
  await expect(page.locator('.canvas-element')).toHaveCount(3)

  await page.getByTitle('Add slide').click()
  await expect(page.getByLabel('Slides')).toContainText('Untitled')

  await page.getByTitle('Duplicate slide').click()
  await page.getByTitle('Move slide up').click()
  await page.getByTitle('Move slide down').click()

  await page.getByTitle('Save').click()
  await expect(page.locator('.status-bar')).toContainText('saved')

  await page.getByTitle('Export self-contained HTML').click()
  await expect(page.locator('.status-bar')).toContainText('saved')
})
```

- [ ] **Step 3: Run full verification**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm --filter @ppht/editor test:e2e
```

Expected:

- Unit tests pass.
- Typecheck passes.
- Build passes.
- Playwright test passes in Chromium.

- [ ] **Step 4: Manually inspect the exported HTML**

Run:

```powershell
pnpm --filter @ppht/server dev
```

In another shell, create a deck through the UI, save it, then call export through the UI when the export button is wired in the next pass or call the API directly:

```powershell
$body = @{
  projectPath = "D:\NewStarProject\PPHT\demo.ppht"
  outputPath = "D:\NewStarProject\PPHT\demo-full.html"
  mode = "self-contained"
} | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:3737/api/projects/export" -ContentType "application/json" -Body $body
```

Expected: `D:\NewStarProject\PPHT\demo-full.html` exists, contains `data-ppht-project-model`, and opens in a browser without server access.

- [ ] **Step 5: Commit verification coverage**

Run:

```powershell
git add apps/editor/playwright.config.ts apps/editor/tests/editor-flow.spec.ts
git commit -m "test: verify phase 1 editor flow"
```

Expected: commit succeeds.

## Task 15: Acceptance Review

**Files:**
- Read: `D:\NewStarProject\PPHT\docs\superpowers\specs\2026-05-31-ppht-html-ppt-editor-design.md`

- [ ] **Step 1: Run final acceptance commands**

Run:

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm --filter @ppht/editor test:e2e
git status --short
```

Expected:

- All tests pass.
- Typecheck passes.
- Build passes.
- E2E passes.
- `git status --short` only shows intentional generated artifacts if any were produced during manual export checks.

- [ ] **Step 2: Compare against phase 1 acceptance criteria**

Open `D:\NewStarProject\PPHT\docs\superpowers\specs\2026-05-31-ppht-html-ppt-editor-design.md` and confirm the implementation has:

- New project creation.
- Slide selection with at least the initial slide visible.
- Per-slide HTML persistence.
- Text insertion and editing through model commands.
- Element selection and movement.
- Property panel editing for position, size, and rotation.
- Undo and redo for command-backed edits.
- Save and reopen through local Node service.
- Self-contained HTML export.
- Clean HTML export.

## Self-Review

Spec coverage:

- Project creation, opening, saving: Tasks 5, 7, 8, 9, 13, 14.
- One slide per HTML file: Tasks 4 and 5.
- Structured model as editing truth: Tasks 2, 3, 4, 8, 10.
- DOM/SVG canvas direction: Task 10 starts the hybrid renderer.
- Slide add, duplicate, delete, and reorder: Task 11.
- Text, image, shape, and line insertion: Tasks 8, 10, and 12.
- Property editing for common fields: Tasks 10 and 12.
- Self-contained and clean HTML export: Tasks 6 and 13.
- Error handling: Tasks 5 and 7 cover missing manifest, missing model, validation, save, and export errors.
- Tests: Tasks 2, 3, 4, 5, 6, 11, and 14 cover unit, service, serializer, export, and E2E verification.
- Phase 2, phase 3, and AI features remain outside phase 1 and are recorded in the design spec roadmap.
