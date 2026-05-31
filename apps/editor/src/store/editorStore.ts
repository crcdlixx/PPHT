import { create } from 'zustand'

type EditorState = {
  projectName: string
}

export const useEditorStore = create<EditorState>(() => ({
  projectName: 'Untitled PPHT project'
}))
