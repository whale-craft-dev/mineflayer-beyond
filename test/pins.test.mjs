import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import pins from '../lib/pins.js'

const require = createRequire(import.meta.url)

function stackWith (overrides = {}) {
  const versions = { ...pins.PINNED, ...overrides }
  const stack = {}
  for (const [name, version] of Object.entries(versions)) {
    if (version !== null) stack[name] = { version }
  }
  return stack
}

test('版本全对时通过', () => {
  assert.deepEqual(pins.checkPins(stackWith(), {}), { ok: true, problems: [], allowed: false })
})

test('mineflayer 版本不符时直接抛错，并说清楚要什么', () => {
  assert.throws(
    () => pins.checkPins(stackWith({ mineflayer: '4.40.0' }), {}),
    err => {
      assert.equal(err.code, 'BEYOND_PINNED_VERSION')
      assert.match(err.message, /mineflayer: 需要 4\.39\.0，实际 4\.40\.0/)
      assert.match(err.message, /npm i mineflayer@4\.39\.0/)
      return true
    }
  )
})

test('传递依赖版本不符也算不符', () => {
  assert.throws(
    () => pins.checkPins(stackWith({ 'minecraft-data': '3.120.0' }), {}),
    /minecraft-data: 需要 3\.119\.0，实际 3\.120\.0/
  )
})

test('BEYOND_ALLOW_UNPINNED=1 时只警告不抛错', () => {
  const warnings = []
  const result = pins.checkPins(stackWith({ mineflayer: '4.40.0' }), {
    allowUnpinned: true,
    warn: message => warnings.push(message)
  })
  assert.equal(result.ok, false)
  assert.equal(result.allowed, true)
  assert.equal(warnings.length, 1)
})

test('package.json 的 peerDependencies 与 PINNED 一致', () => {
  const pkg = require('../package.json')
  assert.equal(pkg.peerDependencies.mineflayer, pins.PINNED.mineflayer)
  assert.deepEqual(pins.mineflayerVersions, [pins.PINNED.mineflayer])
})