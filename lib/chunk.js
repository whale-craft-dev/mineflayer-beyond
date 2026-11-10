'use strict'

const path = require('path')

const WRAPPED = Symbol.for('mineflayer-beyond.chunk')

/**
 * prismarine-chunk 的实例表是模块私有的：
 *   const chunkImplementations = { pc: { '1.21': require('./pc/1.18/chunk'), ... } }
 *   loader(registryOrVersion) { ... chunkImplementations[type][version.majorVersion](registry) }
 * 表里没有 '26.2' 就抛 "No chunk implementation for pc 26.2"。
 *
 * mineflayer 的 blocks 插件是**在 inject 里才 require('prismarine-chunk')**，所以我们可以
 * 在 install() 阶段替换它的 module.exports：新版本走基线实现（1.18 的 chunk 实现完全不读版本号），
 * 其余版本原样交回给官方 loader。
 */
function aliasChunk (ctx, packs) {
  const modulePath = ctx.require.resolve('prismarine-chunk')
  const original = ctx.require(modulePath)
  if (original[WRAPPED]) return { modulePath, wrapped: false }
  if (typeof original !== 'function') {
    throw new Error('[mineflayer-beyond] prismarine-chunk 的导出不是函数，结构可能变了')
  }

  const packByMajor = new Map(packs.map(p => [p.majorVersion, p]))
  const impls = new Map()
  const loadImpl = (base) => {
    const file = path.join(ctx.stack['prismarine-chunk'].dir, 'src', 'pc', base, 'chunk.js')
    try {
      return ctx.require(file)
    } catch (err) {
      throw new Error(`[mineflayer-beyond] 加载 prismarine-chunk 的 ${base} 实现失败：${err.message}`)
    }
  }

  function beyondChunk (registryOrVersion) {
    const registry = typeof registryOrVersion === 'string'
      ? ctx.require(ctx.stack['prismarine-registry'].entry)(registryOrVersion)
      : registryOrVersion
    const major = registry && registry.version && registry.version.majorVersion
    const pack = major && packByMajor.get(major)
    if (!pack) return original(registryOrVersion)
    if (!impls.has(pack.minecraftVersion)) impls.set(pack.minecraftVersion, loadImpl(pack.chunkBase))
    return impls.get(pack.minecraftVersion)(registry)
  }
  beyondChunk[WRAPPED] = true
  beyondChunk.original = original

  require.cache[modulePath].exports = beyondChunk
  return { modulePath, wrapped: true, aliases: packs.map(p => `${p.majorVersion}->${p.chunkBase}`) }
}

module.exports = { aliasChunk }