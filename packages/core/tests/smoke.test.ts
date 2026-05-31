import { describe, expect, it } from 'vitest'
import { coreReady } from '../src/index'

describe('@ppht/core scaffold', () => {
  it('exports a ready marker', () => {
    expect(coreReady).toBe(true)
  })
})
