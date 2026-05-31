import { describe, expect, it } from 'vitest'
import { createSlide } from '../src/index'

describe('@ppht/core', () => {
  it('exports document factories', () => {
    expect(createSlide('slide-001').id).toBe('slide-001')
  })
})
