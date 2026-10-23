import { createContext } from 'react'

/**
 * ログイン後の共通レイアウト(AppLayout)が持つ状態を各画面で共有する。
 * 値: { timeline: useTimeline() の戻り値, openComposer(editingPost?, onSaved?) }
 */
export const AppLayoutContext = createContext(null)
