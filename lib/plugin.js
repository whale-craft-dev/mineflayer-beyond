'use strict'

const data = require('./data')

/**
 * 传进 createBot({ plugins: { beyond } }) 或 bot.loadPlugin(beyond) 的那个插件。
 *
 * 它不负责版本闸门（那必须在 createBot 之前做，见 install()），只负责：
 *  - 核对 bot 的协议号和数据包是否对得上；
 *  - 抛出 beyond:ready / beyond:error，方便使用方和自检脚本判断。
 *
 * 时机说明：mineflayer 的 plugin_loader 是**在 inject_allowed 里**才注入插件的，
 * 所以插件被调用时 bot.version 通常已经确定；但如果是用户手写 bot.loadPlugin() 且发生在
 * inject_allowed 之前，则要等一次。
 */
function plugin (bot) {
  const packs = data.packs()
  bot.beyond = {
    versions: packs.map(pack => pack.minecraftVersion),
    pack: null,
    ready: false
  }

  const init = () => {
    if (bot.beyond.ready || bot.beyond.pack) return
    const pack = data.byMajorVersion(bot.version)
    if (!pack) return

    bot.beyond.pack = pack.minecraftVersion

    if (bot.protocolVersion !== pack.protocolVersion) {
      const err = new Error(
        `[mineflayer-beyond] 协议号对不上：bot 是 ${bot.protocolVersion}，数据包 ${pack.minecraftVersion} 是 ${pack.protocolVersion}`
      )
      err.code = 'BEYOND_PROTOCOL_MISMATCH'
      bot.emit('beyond:error', err)
      return
    }

    bot.beyond.ready = true
    bot.emit('beyond:ready', {
      minecraftVersion: pack.minecraftVersion,
      protocolVersion: pack.protocolVersion,
      dataVersion: pack.dataVersion,
      baseVersion: pack.baseVersion
    })
  }

  if (bot.version) init()
  else bot.once('inject_allowed', init)
}

module.exports = plugin