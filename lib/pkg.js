'use strict'

const fs = require('fs')
const path = require('path')

/**
 * 从 mineflayer 自己的解析根出发定位依赖 —— 这一点很关键：
 * 要打的补丁必须落在 mineflayer 真正 require 到的那一份模块上。
 * 如果从本插件的位置 require，pnpm / 多副本场景下可能摸到另一份实例，补丁会「打了但没用」。
 */
function createStack (fromEntry) {
  const { createRequire } = require('module')
  const req = createRequire(fromEntry)
  const names = [
    'mineflayer',
    'minecraft-data',
    'minecraft-protocol',
    'prismarine-chunk',
    'prismarine-physics',
    'prismarine-registry'
  ]
  const stack = {}
  for (const name of names) stack[name] = packageInfo(req, name)
  return { require: req, stack }
}

function packageInfo (req, name) {
  let entry
  try {
    entry = req.resolve(name)
  } catch (err) {
    const e = new Error(`[mineflayer-beyond] 解析不到 ${name}：${err.message}`)
    e.code = 'BEYOND_MISSING_DEP'
    throw e
  }
  const pkgFile = findUp(path.dirname(entry), 'package.json')
  if (!pkgFile) {
    const e = new Error(`[mineflayer-beyond] 找到了 ${name} 的入口 ${entry}，但向上找不到 package.json`)
    e.code = 'BEYOND_NO_PACKAGE_JSON'
    throw e
  }
  const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'))
  return {
    name,
    version: pkg.version,
    dir: path.dirname(pkgFile),
    packageFile: pkgFile,
    entry
  }
}

function findUp (start, filename) {
  let dir = start
  for (;;) {
    const candidate = path.join(dir, filename)
    if (fs.existsSync(candidate)) return candidate
    const parent = path.dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

module.exports = { createStack, packageInfo, findUp }