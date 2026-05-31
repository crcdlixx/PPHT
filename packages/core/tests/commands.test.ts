import { describe, expect, it } from 'vitest'
import {
  AddElementCommand,
  CommandHistory,
  createSlide,
  createTextElement,
  DeleteElementCommand,
  UpdateElementCommand
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
})
