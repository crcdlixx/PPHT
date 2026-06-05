import { describe, expect, it } from 'vitest'
import { createApi } from '../src/api.js'

describe('@ppht/server', () => {
  it('creates an express api app', () => {
    expect(createApi()).toHaveProperty('listen')
  })
})
