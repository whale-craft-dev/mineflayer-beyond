import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import beyond from '../index.js'
import { normalizeVersion } from '../lib/version-alias.js'

const require = createRequire(import.meta.url)

test('小版本号折算到 major 版本', () => {
  assert.equal(normalizeVersion('26.3.1'), '26.3')
  assert.equal(normalizeVersion('26.2.5'), '26.2')
  assert.equal(normalizeVersion('26.3.0'), '26.3')
})

test('上游原生的小版本、非字符串原样保留', () => {
  assert.equal(normalizeVersion('26.1.2'), '26.1.2')
  assert.equal(normalizeVersion('1.21.11'), '1.21.11')
  assert.equal(normalizeVersion(false), false)
  assert.equal(normalizeVersion(undefined), undefined)
})

test('createBot 会把显式小版本折成 major', () => {
  const installModule = require('../lib/install.js')
  const original = installModule.mineflayer
  let seen = null
  installModule.mineflayer = () => ({
    createBot (options) {
      seen = options
      throw new Error('stop')
    }
  })
  try {
    assert.throws(() => beyond.createBot({ host: '127.0.0.1', port: 1, version: '26.3.1' }), /stop/)
  } finally {
    installModule.mineflayer = original
  }
  assert.equal(seen.version, '26.3')
})