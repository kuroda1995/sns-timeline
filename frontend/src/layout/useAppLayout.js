import { useContext } from 'react'
import { AppLayoutContext } from './AppLayoutContext.js'

export function useAppLayout() {
  const context = useContext(AppLayoutContext)
  if (!context) throw new Error('useAppLayout は AppLayout の中で使ってください')
  return context
}
