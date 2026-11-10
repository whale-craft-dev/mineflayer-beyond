'use strict'

const path = require('path')

/**
 * 把版本数据注册进 minecraft-data。
 *
 * minecraft-data 的加载链路（3.119.0）：
 *   index.js  -->  const data = require('./data.js')                    ← 静态表，决定 mcData(ver) 能不能拿到东西
 *              -->  versionsByMinecraftVersion / postNetty...          ← autoVersion 反查协议号
 *              -->  protocolVersions 数组（module.exports.versions）     ← supportFeature / Version 比较
 *
 * data.js 的版本条目是「一堆 getter + proto 路径」。index.js 和我们 require 到的是同一个模块实例，
 * 所以往它的导出对象里加一个条目就是往 minecraft-data 里加数据 —— 不写文件、不 fork。
 */
function installPackData (ctx, packs) {
  const req = ctx.require
  const dataFile = path.join(ctx.stack['minecraft-data'].dir, 'data.js')
  let table
  try {
    table = req(dataFile)
  } catch (err) {
    throw new Error(`[mineflayer-beyond] 读不到 minecraft-data/data.js：${err.message}`)
  }
  if (!table || !table.pc) {
    throw new Error('[mineflayer-beyond] minecraft-data/data.js 结构不认识（期望有 .pc 表）—— 依赖版本可能不匹配')
  }

  const mcd = req(ctx.stack['minecraft-data'].entry)
  const native = []
  const registered = []

  for (const pack of packs) {
    const existing = mcd(pack.minecraftVersion)
    if (existing && existing.version && existing.version.version === pack.protocolVersion) {
      // 上游已经自带这个版本：不要再塞一份，避免和官方数据打架。
      native.push(pack.minecraftVersion)
      continue
    }

    const baseEntry = table.pc[pack.baseVersion]
    if (!baseEntry) {
      throw new Error(`[mineflayer-beyond] minecraft-data 里没有基线版本 ${pack.baseVersion}，无法为 ${pack.minecraftVersion} 复用静态数据`)
    }
    const baseVersionEntry = mcd.versionsByMinecraftVersion.pc[pack.baseVersion]
    if (!baseVersionEntry) {
      throw new Error(`[mineflayer-beyond] minecraft-data 的版本索引里没有 ${pack.baseVersion}`)
    }
    if (!(pack.dataVersion > baseVersionEntry.dataVersion)) {
      throw new Error(`[mineflayer-beyond] ${pack.minecraftVersion} 的 dataVersion(${pack.dataVersion}) 必须大于基线 ${pack.baseVersion}(${baseVersionEntry.dataVersion})，否则版本比较会错`)
    }

    registerDataEntry(table, baseEntry, pack)
    registerIndexes(mcd, pack)

    const loaded = mcd(pack.minecraftVersion)
    if (!loaded || !loaded.blocks || !loaded.protocol) {
      throw new Error(`[mineflayer-beyond] 注册 ${pack.minecraftVersion} 后 minecraft-data 仍然加载不出来（data.js 结构可能变了）`)
    }
    registered.push(pack.minecraftVersion)
  }

  return { native, registered, dataFile }
}

function registerDataEntry (table, baseEntry, pack) {
  if (table.pc[pack.minecraftVersion]) return
  const entry = {}
  for (const key of Object.keys(baseEntry)) {
    if (key === 'protocol') {
      entry.protocol = pack.protocol
    } else if (key === 'version') {
      entry.version = pack.versionJson
    } else {
      // 其余数据（blocks/items/entities/...）一律复用基线版本，保持惰性。
      Object.defineProperty(entry, key, {
        enumerable: true,
        configurable: true,
        get: () => baseEntry[key]
      })
    }
  }
  table.pc[pack.minecraftVersion] = entry
}

function registerIndexes (mcd, pack) {
  const versionEntry = {
    minecraftVersion: pack.minecraftVersion,
    version: pack.protocolVersion,
    dataVersion: pack.dataVersion,
    usesNetty: true,
    majorVersion: pack.majorVersion,
    releaseType: pack.releaseType
  }

  mcd.versionsByMinecraftVersion.pc[pack.minecraftVersion] = versionEntry
  if (!mcd.versionsByMinecraftVersion.pc[pack.majorVersion]) {
    mcd.versionsByMinecraftVersion.pc[pack.majorVersion] = versionEntry
  }

  const byProtocol = mcd.postNettyVersionsByProtocolVersion.pc[pack.protocolVersion] || []
  if (!byProtocol.some(v => v.minecraftVersion === pack.minecraftVersion)) byProtocol.unshift(versionEntry)
  mcd.postNettyVersionsByProtocolVersion.pc[pack.protocolVersion] = byProtocol

  if (!mcd.versions.pc.some(v => v.minecraftVersion === pack.minecraftVersion && v.version === pack.protocolVersion)) {
    mcd.versions.pc.push(versionEntry)
  }
  if (Array.isArray(mcd.supportedVersions.pc) && !mcd.supportedVersions.pc.includes(pack.minecraftVersion)) {
    mcd.supportedVersions.pc.push(pack.minecraftVersion)
  }
}

module.exports = { installPackData }