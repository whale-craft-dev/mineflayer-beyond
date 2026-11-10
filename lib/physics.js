'use strict'

const path = require('path')

/**
 * prismarine-physics 判定特性用的是**精确版本名**：
 *   features.some(({ versions }) => versions.includes(mcData.version.majorVersion))
 * （prismarine-physics/index.js 的 makeSupportFeature）
 *
 * 所以新版本（26.2）只要不在 "proportionalLiquidGravity"/"climbUsingJump" 的列表里，
 * 物理插件构造时就会抛 "No liquid gravity settings"。
 * 这里把新版本名追加到它声明的行为基线版本所在的所有列表里 —— physicsBase 就是「行为等同于谁」。
 */
function aliasPhysics (ctx, packs) {
  const file = path.join(ctx.stack['prismarine-physics'].dir, 'lib', 'features.json')
  let features
  try {
    features = ctx.require(file)
  } catch (err) {
    throw new Error(`[mineflayer-beyond] 读不到 prismarine-physics/lib/features.json：${err.message}`)
  }
  if (!Array.isArray(features)) {
    throw new Error('[mineflayer-beyond] prismarine-physics 的 features.json 不是数组，结构可能变了')
  }
  const touched = []
  for (const pack of packs) {
    for (const feature of features) {
      if (!Array.isArray(feature.versions)) continue
      if (!feature.versions.includes(pack.physicsBase)) continue
      if (feature.versions.includes(pack.minecraftVersion)) continue
      feature.versions.push(pack.minecraftVersion)
      touched.push(`${feature.name}:${pack.minecraftVersion}`)
    }
  }
  return { file, touched }
}

module.exports = { aliasPhysics }