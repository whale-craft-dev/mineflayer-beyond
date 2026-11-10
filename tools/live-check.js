#!/usr/bin/env node
'use strict'

/**
 * 真连一个服务器，看能不能进。
 * 用法：node tools/live-check.mjs <host> <port> [username] [offline|microsoft|mojang]
 */
const beyond = require('../index.js')

const [host, portArg, username = 'BeyondCheck', auth = 'offline'] = process.argv.slice(2)
const port = Number(portArg)

if (!host || !Number.isInteger(port)) {
  console.error('用法：node tools/live-check.mjs <host> <port> [username] [offline|microsoft|mojang]')
  process.exit(2)
}

const report = beyond.install()
console.log(`[live] mineflayer ${report.mineflayer}，支持到 ${report.latestSupportedVersion}`)

const bot = beyond.createBot({ host, port, username, auth, version: false })

const done = (code) => {
  try { bot.quit() } catch {}
  setTimeout(() => process.exit(code), 200)
}

const timer = setTimeout(() => {
  console.error('[live] 超时：15 秒内没有 spawn')
  done(1)
}, 15000)

bot.on('beyond:ready', (info) => console.log('[live] beyond:ready', info))

bot.once('spawn', () => {
  clearTimeout(timer)
  const position = bot.entity && bot.entity.position
  console.log('[live] spawn ok')
  console.log(JSON.stringify({
    version: bot.version,
    protocolVersion: bot.protocolVersion,
    username: bot.username,
    position: position && { x: position.x, y: position.y, z: position.z },
    dimension: bot.game && bot.game.dimension,
    blocksInView: bot.blockAt ? Boolean(bot.blockAt(position)) : null
  }, null, 2))
  done(0)
})

bot.on('beyond:error', (err) => {
  console.error('[live] beyond:error', err.message)
  done(1)
})

bot.on('error', (err) => {
  console.error('[live] error', err.message)
})