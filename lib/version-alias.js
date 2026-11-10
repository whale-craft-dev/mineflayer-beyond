'use strict'

/**
 * 「小版本」归一化：26.3.1 这种补丁版本通常沿用 26.3 的协议号，
 * minecraft-data 里没有它的条目，但行为和数据与 26.3 完全一致。
 *
 * 如果调用方显式传了 version: '26.3.1'，在 createBot 之前把它折成 '26.3'；
 * 自动探测（version: false）本来就走协议号，不受影响。
 */
const data = require('./data')

function normalizeVersion (version) {
  if (typeof version !== 'string') return version
  const match = /^(\d+)\.(\d+)(?:\.(\d+))/.exec(version)
  if (!match || !match[3]) return version
  const major = `${match[1]}.${match[2]}`
  const pack = data.byMajorVersion(major)
  return pack ? pack.minecraftVersion : version
}

module.exports = { normalizeVersion }