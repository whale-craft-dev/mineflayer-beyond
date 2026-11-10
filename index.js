'use strict'

/**
 * @whale-craft/mineflayer-beyond
 *
 * 用法：
 *   const beyond = require('@whale-craft/mineflayer-beyond')
 *   beyond.install()                       // 必须在 createBot 之前
 *   const bot = require('mineflayer').createBot({ host, port, username, version: false })
 *
 * 或者直接用封装：
 *   const bot = require('@whale-craft/mineflayer-beyond').createBot({ ... })
 *
 * 它也可以当普通插件传进去（会自动挂上 beyond:ready / beyond:error 事件）：
 *   createBot({ plugins: { beyond } })
 */
const installModule = require('./lib/install')
const plugin = require('./lib/plugin')
const data = require('./lib/data')
const pins = require('./lib/pins')
const { normalizeVersion } = require('./lib/version-alias')

function beyond (bot, options) {
  return plugin(bot, options)
}

beyond.install = installModule.install
beyond.plugin = plugin
beyond.createBot = createBot
beyond.versions = () => data.packs().map(pack => pack.minecraftVersion)
beyond.supportedMineflayerVersions = pins.mineflayerVersions
beyond.normalizeVersion = normalizeVersion

function createBot (options = {}) {
  beyond.install()
  const mineflayer = installModule.mineflayer()
  const plugins = { ...(options.plugins || {}) }
  if (!Object.prototype.hasOwnProperty.call(plugins, 'beyond')) plugins.beyond = plugin
  return mineflayer.createBot({
    ...options,
    version: normalizeVersion(options.version),
    plugins
  })
}

module.exports = beyond