import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

import beyond from '../index.js'

const require = createRequire(import.meta.url)

test('install() 把 26.2 / 26.3 注册进 minecraft-data', () => {
  const report = beyond.install()

  const mcd = require('minecraft-data')
  assert.equal(mcd('26.2').version.version, 776)
  assert.equal(mcd('26.3').version.version, 777)
  assert.ok(mcd('26.3').blocksArray.length > 1000)
  assert.deepEqual(report.packs.map(pack => pack.minecraftVersion), ['26.2', '26.3'])
  assert.ok(report.packs.every(pack => pack.native === false))
})

test('install() 放宽 mineflayer 的版本闸门', () => {
  beyond.install()
  const mineflayer = require('mineflayer')

  assert.equal(mineflayer.latestSupportedVersion, '26.3')
  assert.ok(mineflayer.testedVersions.includes('26.2'))
  assert.ok(mineflayer.testedVersions.includes('26.3'))
  assert.equal(mineflayer.oldestSupportedVersion, '1.8.8')
})

test('install() 是幂等的', () => {
  const first = beyond.install()
  const second = beyond.install()
  assert.equal(first, second)
})

test('自检项全绿', () => {
  const report = beyond.install()
  assert.ok(report.checks.length >= 6)
  assert.deepEqual(report.checks.filter(check => !check.ok), [])
})

test('26.3 需要的新原生类型 entityDelta 被注册进 minecraft-protocol', () => {
  beyond.install()
  const types = require('minecraft-protocol/src/datatypes/minecraft.js')
  assert.equal(typeof types.entityDelta, 'object')
  assert.equal(types.entityDelta.length, 3)
})

test('entityDelta 线性/分段两种编码都能读', () => {
  const [read] = require('minecraft-protocol/src/datatypes/minecraft.js').entityDelta
  // properties=0（onGround=false, stepCount=0）+ 3×i16
  const linear = Buffer.from([0x00, 0x00, 0x10, 0x00, 0x20, 0xff, 0xf0])
  const a = read(linear, 0)
  assert.equal(a.size, 7)
  assert.deepEqual({ dX: a.value.dX, dY: a.value.dY, dZ: a.value.dZ }, { dX: 16, dY: 32, dZ: -16 })
  assert.equal(a.value.steps.length, 1)

  // properties=0b101（onGround, stepCount=2），两组 {ticks, dX, dY, dZ}
  const stepped = Buffer.from([
    0x05,
    0x01, 0x00, 0x01, 0x00, 0x02, 0x00, 0x03,
    0x01, 0x00, 0x04, 0x00, 0x05, 0x00, 0x06
  ])
  const b = read(stepped, 0)
  assert.equal(b.size, 15)
  assert.deepEqual({ dX: b.value.dX, dY: b.value.dY, dZ: b.value.dZ }, { dX: 5, dY: 7, dZ: 9 })
  assert.equal(b.value.onGround, true)
})

test('prismarine-chunk 能给新版本挑出实现', () => {
  beyond.install()
  const mcd = require('minecraft-data')
  const registry = require('prismarine-registry')('26.3')
  const Chunk = require('prismarine-chunk')(registry)
  assert.equal(typeof Chunk, 'function')
  assert.ok(mcd('26.3').blocksByName.stone)
})

test('prismarine-physics 的特性表补上了新版本', () => {
  beyond.install()
  const features = require('prismarine-physics/lib/features.json')
  const gravity = features.find(feature => feature.name === 'proportionalLiquidGravity')
  assert.ok(gravity.versions.includes('26.2'))
  assert.ok(gravity.versions.includes('26.3'))
})