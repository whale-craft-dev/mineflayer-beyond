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
    if ((pack.nativeTypes || []).includes('entityDelta')) patchEntityMove(bot._client)
    bot.emit('beyond:ready', {
      minecraftVersion: pack.minecraftVersion,
      protocolVersion: pack.protocolVersion,
      dataVersion: pack.dataVersion,
      baseVersion: pack.baseVersion,
      nativeTypes: pack.nativeTypes || []
    })
  }

  if (bot.version) init()
  else bot.once('inject_allowed', init)
}

module.exports = plugin

const ENTITY_MOVE_PATCHED = Symbol.for('mineflayer-beyond.entityMovePatched')

/**
 * 26.3 的 rel_entity_move / entity_move_look 把一个实体移动包成了 `move: { dX, dY, dZ, onGround, steps }`，
 * 而 mineflayer 的 entities 插件读的是 `packet.dX/dY/dZ`。这里在 client 的 emit 之前把字段摊平，
 * 让 mineflayer 原样工作；顺带保留 steps 给需要分段信息的使用方。
 */
function patchEntityMove (client) {
  if (!client || client[ENTITY_MOVE_PATCHED]) return
  client[ENTITY_MOVE_PATCHED] = true
  const emit = client.emit
  client.emit = function (event, ...args) {
    if ((event === 'rel_entity_move' || event === 'entity_move_look') && args[0] && args[0].move) {
      const move = args[0].move
      args[0] = {
        ...args[0],
        dX: move.dX,
        dY: move.dY,
        dZ: move.dZ,
        onGround: move.onGround,
        steps: move.steps
      }
    }
    return emit.apply(this, [event, ...args])
  }
}