import { create } from 'zustand'

type EditorState = {
  placeholder: true
}

export const useEditorStore = create<EditorState>(() => ({
  placeholder: true
}))
