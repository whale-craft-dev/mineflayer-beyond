'use strict'

const path = require('path')

/**
 * mineflayer 的版本闸门在 lib/loader.js：
 *
 *   const { testedVersions, latestSupportedVersion, oldestSupportedVersion } = require('./version')
 *   ...
 *   if (versionData['>'](latestSupportedVersion) && (versionData.version !== latestSupportedProtocolVersion)) {
 *     throw new Error(`Server version '...' is not supported. Latest supported version is '...'.`)
 *   }
 *
 * 注意两点：
 *  1. loader.js 在**模块加载时**把 latestSupportedVersion 解构成了闭包常量，
 *     所以事后改 version.js 的导出对已加载的 loader 无效；
 *  2. mineflayer/index.js 只是 `module.exports = require('./lib/loader.js')`，
 *     拿到的是 loader 的导出对象本身。
 *
 * 于是做法是：先改 version.js 的导出（数组和 latestSupportedVersion），
 * 再丢掉 loader 的模块缓存重新 require 一份，最后把新 loader 的能力写回 index.js 的导出对象。
 * 全程只动内存里的模块对象，不碰 node_modules 里的文件。
 */
function widenGate (ctx, packs) {
  const mineflayerDir = ctx.stack.mineflayer.dir
  const versionPath = path.join(mineflayerDir, 'lib', 'version.js')
  const loaderPath = path.join(mineflayerDir, 'lib', 'loader.js')
  const indexEntry = ctx.stack.mineflayer.entry

  const versionModule = ctx.require(versionPath)
  if (!Array.isArray(versionModule.testedVersions)) {
    throw new Error('[mineflayer-beyond] mineflayer/lib/version.js 的结构不认识（testedVersions 不是数组）—— 依赖版本可能不匹配')
  }

  for (const pack of packs) {
    if (!versionModule.testedVersions.includes(pack.minecraftVersion)) {
      versionModule.testedVersions.push(pack.minecraftVersion)
    }
  }

  const newest = packs.reduce((a, b) => (a.dataVersion >= b.dataVersion ? a : b))
  versionModule.latestSupportedVersion = newest.minecraftVersion

  const indexWasLoaded = Boolean(require.cache[indexEntry])
  delete require.cache[loaderPath]
  const fresh = ctx.require(loaderPath)

  if (fresh.latestSupportedVersion !== newest.minecraftVersion) {
    throw new Error(`[mineflayer-beyond] 放宽版本闸门失败：loader 仍认为最新版本是 ${fresh.latestSupportedVersion}`)
  }

  let mineflayer
  let patchedIndex = false
  if (indexWasLoaded) {
    mineflayer = require.cache[indexEntry].exports
    patchedIndex = mineflayer !== fresh
    if (patchedIndex) {
      for (const key of ['createBot', 'supportFeature', 'latestSupportedVersion', 'oldestSupportedVersion', 'testedVersions']) {
        if (key in fresh) mineflayer[key] = fresh[key]
      }
    }
  } else {
    mineflayer = ctx.require(indexEntry)
  }

  return {
    mineflayer,
    loaderReloaded: true,
    patchedIndex,
    latestSupportedVersion: fresh.latestSupportedVersion,
    oldestSupportedVersion: fresh.oldestSupportedVersion,
    testedVersions: fresh.testedVersions.slice()
  }
}

module.exports = { widenGate }