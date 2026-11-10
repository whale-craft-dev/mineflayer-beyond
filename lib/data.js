'use strict'

let dataPackage = null

/**
 * 版本数据来自 @whale-craft/mc-data-beyond：纯数据包，不带任何补丁逻辑。
 * 单独成包是为了让「MC 出新版本」和「mineflayer 升级」的发版节奏解耦。
 */
function data () {
  if (dataPackage) return dataPackage
  try {
    dataPackage = require('@whale-craft/mc-data-beyond')
  } catch (err) {
    const e = new Error([
      '[mineflayer-beyond] 缺少 @whale-craft/mc-data-beyond。',
      '它是版本数据包（协议定义、版本号、数据基线），本插件不重复携带数据。',
      '安装：npm i @whale-craft/mc-data-beyond',
      `原始错误：${err.message}`
    ].join('\n'))
    e.code = 'BEYOND_MISSING_DATA_PACKAGE'
    throw e
  }
  return dataPackage
}

function packs () {
  return data().packs()
}

function byMajorVersion (majorVersion) {
  return packs().find(pack => pack.majorVersion === majorVersion) || null
}

function newest () {
  const all = packs()
  return all[all.length - 1] || null
}

module.exports = { data, packs, byMajorVersion, newest }