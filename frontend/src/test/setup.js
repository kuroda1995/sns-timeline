// 全テスト共通の準備(vite.config.js の test.setupFiles)
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom に無いブラウザの機能を用意する
class MockIntersectionObserver {
  /** テストから「画面に入った」ことにするため、作られた監視を覚えておく */
  static instances = []

  constructor(callback) {
    this.callback = callback
    this.elements = []
    MockIntersectionObserver.instances.push(this)
  }

  observe(element) {
    this.elements.push(element)
  }

  disconnect() {
    this.elements = []
  }

  unobserve() {}
}
globalThis.IntersectionObserver = MockIntersectionObserver

// 呼ばれたかを確かめたいテストでは vi.spyOn で監視する
let objectUrlId = 0
URL.createObjectURL = () => `blob:preview-${++objectUrlId}`
URL.revokeObjectURL = () => {}

afterEach(() => {
  cleanup()
  MockIntersectionObserver.instances = []
  localStorage.clear()
})
