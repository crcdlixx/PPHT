import { describe, expect, it } from 'vitest'
import { createServerStatus, serverReady } from '../src/index'

describe('@ppht/server scaffold', () => {
  it('exports a server status helper', () => {
    expect(serverReady).toBe(true)
    expect(createServerStatus()).toEqual({ status: 'ready' })
  })
})
