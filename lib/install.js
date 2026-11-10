'use strict'

const path = require('path')
const { createStack } = require('./pkg')
const { checkPins } = require('./pins')
const data = require('./data')
const { installPackData } = require('./minecraft-data')
const { aliasPhysics } = require('./physics')
const { aliasChunk } = require('./chunk')
const { installNativeTypes } = require('./native-types')
const { widenGate } = require('./gate')

let report = null
let mineflayerModule = null

/**
 * 打补丁。幂等：重复调用返回同一份报告。
 * 必须在 createBot 之前调用 —— 版本闸门是 mineflayer 加载期算好的。
 */
function install (options = {}) {
  if (report) return report

  const mineflayerEntry = require.resolve('mineflayer')
  const { require: req, stack } = createStack(mineflayerEntry)
  const pins = checkPins(stack, options)

  const packs = data.packs()
  if (packs.length === 0) throw new Error('[mineflayer-beyond] 数据包里一个版本都没有')

  const ctx = { require: req, stack, mineflayerEntry }
  const dataReport = installPackData(ctx, packs)
  const physics = aliasPhysics(ctx, packs)
  const chunk = aliasChunk(ctx, packs)
  const nativeTypes = installNativeTypes(ctx, packs)
  const gate = widenGate(ctx, packs)

  const checks = verify(ctx, packs, gate)
  const failed = checks.filter(check => !check.ok)
  if (failed.length > 0) {
    throw new Error(`[mineflayer-beyond] 自检失败：${failed.map(c => c.name).join(', ')}`)
  }

  mineflayerModule = gate.mineflayer
  report = {
    mineflayer: stack.mineflayer.version,
    minecraftData: stack['minecraft-data'].version,
    minecraftProtocol: stack['minecraft-protocol'].version,
    prismarineChunk: stack['prismarine-chunk'].version,
    prismarinePhysics: stack['prismarine-physics'].version,
    pins,
    packs: packs.map(pack => ({
      minecraftVersion: pack.minecraftVersion,
      protocolVersion: pack.protocolVersion,
      dataVersion: pack.dataVersion,
      baseVersion: pack.baseVersion,
      nativeTypes: pack.nativeTypes || [],
      native: dataReport.native.includes(pack.minecraftVersion)
    })),
    latestSupportedVersion: gate.latestSupportedVersion,
    oldestSupportedVersion: gate.oldestSupportedVersion,
    testedVersions: gate.testedVersions,
    patchedIndex: gate.patchedIndex,
    physicsFeatures: physics.touched,
    chunkAliases: chunk.aliases || [],
    nativeTypes,
    checks
  }
  return report
}

function mineflayer () {
  if (!mineflayerModule) {
    const err = new Error('[mineflayer-beyond] 还没有 install()，不能直接用 mineflayer')
    err.code = 'BEYOND_NOT_INSTALLED'
    throw err
  }
  return mineflayerModule
}

/**
 * 装完之后立刻验证「数据真的能用」，而不是等连服务器时才炸。
 */
function verify (ctx, packs, gate) {
  const mcd = ctx.require(ctx.stack['minecraft-data'].entry)
  const checks = []

  for (const pack of packs) {
    const loaded = mcd(pack.minecraftVersion)
    checks.push({
      name: `minecraft-data:${pack.minecraftVersion}`,
      ok: Boolean(loaded && loaded.version && loaded.version.version === pack.protocolVersion && loaded.blocksArray && loaded.blocksArray.length > 0)
    })
  }

  const newest = data.newest()
  checks.push({
    name: 'gate:latest-supported',
    ok: gate.latestSupportedVersion === newest.minecraftVersion
  })
  checks.push({
    name: 'gate:accepts-newest',
    ok: mcd(newest.minecraftVersion).version['>'](gate.latestSupportedVersion) === false
  })

  const chunkLoader = ctx.require(ctx.require.resolve('prismarine-chunk'))
  const registry = ctx.require(ctx.stack['prismarine-registry'].entry)(newest.minecraftVersion)
  let Chunk = null
  try {
    Chunk = chunkLoader(registry)
  } catch (err) {
    checks.push({ name: 'chunk:newest', ok: false, error: err.message })
  }
  if (Chunk) checks.push({ name: 'chunk:newest', ok: typeof Chunk === 'function' })

  const datatypes = ctx.require(path.join(ctx.stack['minecraft-protocol'].dir, 'src', 'datatypes', 'minecraft.js'))
  for (const pack of packs) {
    for (const name of pack.nativeTypes || []) {
      checks.push({ name: `native-type:${name}@${pack.minecraftVersion}`, ok: typeof datatypes[name] !== 'undefined' })
    }
  }

  return checks
}

module.exports = { install, mineflayer, _verify: verify }