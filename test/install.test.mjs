import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import beyond from '../index.js'

const require = createRequire(import.meta.url)

test('install() 把 26.2 注册进 minecraft-data', () => {
  const report = beyond.install()

  const mcd = require('minecraft-data')
  assert.equal(mcd('26.2').version.version, 776)
  assert.ok(mcd('26.2').blocksArray.length > 1000)
  assert.deepEqual(report.packs.map(pack => pack.minecraftVersion), ['26.2'])
  assert.ok(report.packs.every(pack => pack.native === false))
})

test('install() 放宽 mineflayer 的版本闸门', () => {
  beyond.install()
  const mineflayer = require('mineflayer')

  assert.equal(mineflayer.latestSupportedVersion, '26.2')
  assert.ok(mineflayer.testedVersions.includes('26.2'))
  assert.equal(mineflayer.oldestSupportedVersion, '1.8.8')
})

test('install() 是幂等的', () => {
  const first = beyond.install()
  const second = beyond.install()
  assert.equal(first, second)
})

test('自检项全绿', () => {
  const report = beyond.install()
  assert.ok(report.checks.length >= 4)
  assert.deepEqual(report.checks.filter(check => !check.ok), [])
})

test('prismarine-chunk 能给新版本挑出实现', () => {
  beyond.install()
  const mcd = require('minecraft-data')
  const registry = require('prismarine-registry')('26.2')
  const Chunk = require('prismarine-chunk')(registry)
  assert.equal(typeof Chunk, 'function')
  assert.ok(mcd('26.2').blocksByName.stone)
})

test('prismarine-physics 的特性表补上了新版本', () => {
  beyond.install()
  const features = require('prismarine-physics/lib/features.json')
  const gravity = features.find(feature => feature.name === 'proportionalLiquidGravity')
  assert.ok(gravity.versions.includes('26.2'))
})