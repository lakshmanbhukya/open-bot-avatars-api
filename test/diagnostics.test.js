import test from 'node:test'
import assert from 'node:assert/strict'
import { createDiagnostics } from '../app/lib/diagnostics.js'

test('outage diagnostics are bounded per subsystem and resume after a minute', () => {
  let time = 0
  const messages = []
  const report = createDiagnostics({ now: () => time, log: message => messages.push(message) })
  report('redis', 'configuration')
  report('redis', 'connection')
  report('image-asset', 'missing-file')
  assert.deepEqual(messages, ['[avatar-api] redis: configuration', '[avatar-api] image-asset: missing-file'])
  time = 60_000
  report('redis', 'connection')
  assert.equal(messages.at(-1), '[avatar-api] redis: connection')
})
