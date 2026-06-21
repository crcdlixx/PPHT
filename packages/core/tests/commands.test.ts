import { describe, expect, it } from 'vitest'
import {
  AddElementCommand,
  CommandHistory,
  createSlide,
  createTextElement,
  DeleteElementCommand,
  DeleteElementsCommand,
  GroupElementsCommand,
  type SlideCommand,
  type SlideDocument,
  UngroupElementCommand,
  UpdateElementCommand,
  UpdateElementsCommand
} from '../src/index'

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

  it('tracks undo and redo availability around delete commands', () => {
    const text = createTextElement('el-001', { x: 0, y: 0, width: 200, height: 80 }, 'Hello')
    const history = new CommandHistory(createSlide('slide-001', 'Title'))

    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)

    history.run(new AddElementCommand(text))
    history.run(new DeleteElementCommand('el-001'))

    expect(history.current.elements).toHaveLength(0)
    expect(history.canUndo).toBe(true)
    expect(history.canRedo).toBe(false)

    history.undo()
    expect(history.current.elements[0]?.id).toBe('el-001')
    expect(history.canRedo).toBe(true)

    history.redo()
    expect(history.current.elements).toHaveLength(0)
    expect(history.canUndo).toBe(true)
  })

  it('does not keep caller-owned command data by reference', () => {
    const text = createTextElement('el-001', { x: 0, y: 0, width: 200, height: 80 }, 'Hello')
    const patchStyle = { color: '#ff0000' }
    const history = new CommandHistory(createSlide('slide-001', 'Title'))

    history.run(new AddElementCommand(text))
    history.run(new UpdateElementCommand('el-001', { style: patchStyle }))

    text.style.color = '#000000'
    patchStyle.color = '#00ff00'

    history.undo()
    expect(history.current.elements[0]?.style.color).toBe('#111827')

    history.redo()
    expect(history.current.elements[0]?.style.color).toBe('#ff0000')
  })

  it('returns a snapshot from current', () => {
    const text = createTextElement('el-001', { x: 0, y: 0, width: 200, height: 80 }, 'Hello')
    const history = new CommandHistory(createSlide('slide-001', 'Title'))

    history.run(new AddElementCommand(text))

    const current = history.current
    current.elements[0]!.x = 99
    current.elements[0]!.style.color = '#ff0000'

    expect(history.current.elements[0]?.x).toBe(0)
    expect(history.current.elements[0]?.style.color).toBe('#111827')
  })

  it('returns snapshots from run, undo, and redo', () => {
    const text = createTextElement('el-001', { x: 0, y: 0, width: 200, height: 80 }, 'Hello')
    const history = new CommandHistory(createSlide('slide-001', 'Title'))

    const runResult = history.run(new AddElementCommand(text))
    runResult.elements[0]!.x = 99
    expect(history.current.elements[0]?.x).toBe(0)

    const undoResult = history.undo()
    undoResult.elements.push(createTextElement('el-002', { x: 0, y: 0, width: 200, height: 80 }, 'Undo leak'))
    expect(history.current.elements).toHaveLength(0)

    const redoResult = history.redo()
    redoResult.elements[0]!.style.color = '#ff0000'
    expect(history.current.elements[0]?.style.color).toBe('#111827')
  })

  it('executes commands against cloned history state', () => {
    let commandInput: SlideDocument | undefined
    const mutatingCommand: SlideCommand = {
      description: 'Mutate command input',
      execute(slide) {
        commandInput = slide
        slide.elements.push(createTextElement('el-001', { x: 0, y: 0, width: 200, height: 80 }, 'Leaked'))
        return slide
      },
      undo(slide) {
        slide.title = 'Leaked undo'
        return createSlide('slide-003', 'Restored')
      }
    }
    const history = new CommandHistory(createSlide('slide-001', 'Title'))

    history.run(mutatingCommand)
    commandInput!.elements[0]!.x = 99
    expect(history.current.elements[0]?.x).toBe(0)

    history.undo()

    expect(history.current.id).toBe('slide-003')
    expect(history.current.title).toBe('Restored')
    expect(history.current.elements).toHaveLength(0)
  })

  it('supports repeated update undo and redo cycles', () => {
    const text = createTextElement('el-001', { x: 0, y: 0, width: 200, height: 80 }, 'Hello')
    const history = new CommandHistory(createSlide('slide-001', 'Title'))

    history.run(new AddElementCommand(text))
    history.run(new UpdateElementCommand('el-001', { x: 50 }))

    history.undo()
    history.redo()
    history.undo()
    history.redo()

    expect(history.current.elements[0]?.x).toBe(50)
  })

  it('preserves element order when undoing and redoing deletes', () => {
    const first = createTextElement('el-001', { x: 0, y: 0, width: 200, height: 80 }, 'One')
    const second = createTextElement('el-002', { x: 0, y: 90, width: 200, height: 80 }, 'Two')
    const third = createTextElement('el-003', { x: 0, y: 180, width: 200, height: 80 }, 'Three')
    const history = new CommandHistory(createSlide('slide-001', 'Title'))

    history.run(new AddElementCommand(first))
    history.run(new AddElementCommand(second))
    history.run(new AddElementCommand(third))
    history.run(new DeleteElementCommand('el-002'))

    expect(history.current.elements.map((element) => element.id)).toEqual(['el-001', 'el-003'])

    history.undo()
    expect(history.current.elements.map((element) => element.id)).toEqual(['el-001', 'el-002', 'el-003'])

    history.redo()
    expect(history.current.elements.map((element) => element.id)).toEqual(['el-001', 'el-003'])
  })

  it('updates multiple elements in one undoable command', () => {
    const first = createTextElement('el-001', { x: 10, y: 20, width: 200, height: 80 }, 'One')
    const second = createTextElement('el-002', { x: 110, y: 140, width: 200, height: 80 }, 'Two')
    const history = new CommandHistory({
      ...createSlide('slide-001', 'Title'),
      elements: [first, second]
    })

    history.run(new UpdateElementsCommand([
      { elementId: 'el-001', patch: { x: 30, style: { ...first.style, color: '#ff0000' } } },
      { elementId: 'el-002', patch: { y: 180, zIndex: 9 } }
    ]))

    expect(history.current.elements.map((element) => ({ id: element.id, x: element.x, y: element.y, zIndex: element.zIndex }))).toEqual([
      { id: 'el-001', x: 30, y: 20, zIndex: 1 },
      { id: 'el-002', x: 110, y: 180, zIndex: 9 }
    ])
    expect(history.current.elements[0]?.style.color).toBe('#ff0000')

    history.undo()

    expect(history.current.elements.map((element) => ({ id: element.id, x: element.x, y: element.y, zIndex: element.zIndex }))).toEqual([
      { id: 'el-001', x: 10, y: 20, zIndex: 1 },
      { id: 'el-002', x: 110, y: 140, zIndex: 1 }
    ])
    expect(history.current.elements[0]?.style.color).toBe('#111827')

    history.redo()

    expect(history.current.elements[0]?.x).toBe(30)
    expect(history.current.elements[1]?.y).toBe(180)
  })

  it('deletes multiple elements in one undoable command', () => {
    const first = createTextElement('el-001', { x: 0, y: 0, width: 200, height: 80 }, 'One')
    const second = createTextElement('el-002', { x: 0, y: 90, width: 200, height: 80 }, 'Two')
    const third = createTextElement('el-003', { x: 0, y: 180, width: 200, height: 80 }, 'Three')
    const history = new CommandHistory({
      ...createSlide('slide-001', 'Title'),
      elements: [first, second, third]
    })

    history.run(new DeleteElementsCommand(['el-001', 'el-003']))

    expect(history.current.elements.map((element) => element.id)).toEqual(['el-002'])

    history.undo()
    expect(history.current.elements.map((element) => element.id)).toEqual(['el-001', 'el-002', 'el-003'])

    history.redo()
    expect(history.current.elements.map((element) => element.id)).toEqual(['el-002'])
  })

  it('groups selected elements into an undoable group element', () => {
    const first = { ...createTextElement('el-001', { x: 20, y: 40, width: 120, height: 60 }, 'One'), zIndex: 1 }
    const second = { ...createTextElement('el-002', { x: 200, y: 140, width: 160, height: 80 }, 'Two'), zIndex: 2 }
    const third = { ...createTextElement('el-003', { x: 420, y: 240, width: 120, height: 60 }, 'Three'), zIndex: 3 }
    const slide: SlideDocument = {
      ...createSlide('slide-001', 'Groups'),
      elements: [first, second, third]
    }
    const history = new CommandHistory(slide)

    history.run(new GroupElementsCommand(['el-001', 'el-002'], 'group-001'))

    const current = history.current
    expect(current.elements.map((element) => element.id)).toEqual(['group-001', 'el-003'])
    const group = current.elements[0]
    expect(group).toMatchObject({
      id: 'group-001',
      type: 'group',
      x: 20,
      y: 40,
      width: 340,
      height: 180,
      zIndex: 2
    })
    expect(group?.type === 'group' ? group.content.elements.map((element) => ({ id: element.id, x: element.x, y: element.y })) : []).toEqual([
      { id: 'el-001', x: 0, y: 0 },
      { id: 'el-002', x: 180, y: 100 }
    ])

    history.undo()
    expect(history.current.elements).toEqual(slide.elements)

    history.redo()
    expect(history.current.elements.map((element) => element.id)).toEqual(['group-001', 'el-003'])
  })

  it('ungroups a group element into absolute child elements', () => {
    const first = { ...createTextElement('el-001', { x: 20, y: 40, width: 120, height: 60 }, 'One'), zIndex: 1 }
    const second = { ...createTextElement('el-002', { x: 200, y: 140, width: 160, height: 80 }, 'Two'), zIndex: 2 }
    const slide: SlideDocument = {
      ...createSlide('slide-001', 'Groups'),
      elements: [first, second]
    }
    const history = new CommandHistory(slide)

    history.run(new GroupElementsCommand(['el-001', 'el-002'], 'group-001'))
    history.run(new UngroupElementCommand('group-001'))

    expect(history.current.elements.map((element) => ({ id: element.id, x: element.x, y: element.y, zIndex: element.zIndex }))).toEqual([
      { id: 'el-001', x: 20, y: 40, zIndex: 1 },
      { id: 'el-002', x: 200, y: 140, zIndex: 2 }
    ])

    history.undo()
    expect(history.current.elements.map((element) => element.id)).toEqual(['group-001'])
  })

  it('preserves interleaved child layers when grouping and ungrouping without moving the group layer', () => {
    const first = { ...createTextElement('el-001', { x: 20, y: 40, width: 120, height: 60 }, 'One'), zIndex: 1 }
    const middle = { ...createTextElement('el-003', { x: 80, y: 100, width: 120, height: 60 }, 'Middle'), zIndex: 5 }
    const second = { ...createTextElement('el-002', { x: 200, y: 140, width: 160, height: 80 }, 'Two'), zIndex: 10 }
    const history = new CommandHistory({
      ...createSlide('slide-001', 'Groups'),
      elements: [first, middle, second]
    })

    history.run(new GroupElementsCommand(['el-001', 'el-002'], 'group-001'))
    history.run(new UngroupElementCommand('group-001'))

    expect(history.current.elements.map((element) => ({ id: element.id, zIndex: element.zIndex }))).toEqual([
      { id: 'el-001', zIndex: 1 },
      { id: 'el-002', zIndex: 10 },
      { id: 'el-003', zIndex: 5 }
    ])
  })

  it('ungroups children around the current group layer after the group layer changes', () => {
    const first = { ...createTextElement('el-001', { x: 20, y: 40, width: 120, height: 60 }, 'One'), zIndex: 1 }
    const second = { ...createTextElement('el-002', { x: 200, y: 140, width: 160, height: 80 }, 'Two'), zIndex: 10 }
    const history = new CommandHistory({
      ...createSlide('slide-001', 'Groups'),
      elements: [first, second]
    })

    history.run(new GroupElementsCommand(['el-001', 'el-002'], 'group-001'))
    history.run(new UpdateElementCommand('group-001', { zIndex: 9 }))
    history.run(new UngroupElementCommand('group-001'))

    expect(history.current.elements.map((element) => ({ id: element.id, zIndex: element.zIndex }))).toEqual([
      { id: 'el-001', zIndex: 8 },
      { id: 'el-002', zIndex: 9 }
    ])
  })
})
