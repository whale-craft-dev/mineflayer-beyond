import test from 'node:test'
import assert from 'node:assert/strict'

import beyond from '../index.js'
import { startFakeServer, waitFor } from '../test-support/fake-server.mjs'

async function connectAndInspect (minecraftVersion, protocolVersion, { expectReady = true } = {}) {
  const fake = await startFakeServer({ version: minecraftVersion })
  const bot = beyond.createBot({
    host: '127.0.0.1',
    port: fake.port,
    username: `Beyond${minecraftVersion.replace(/\D/g, '')}`,
    physicsEnabled: false,
    logErrors: false
  })

  const readyPromise = expectReady ? waitFor(bot, 'beyond:ready') : null
  const spawnPromise = waitFor(bot, 'spawn')
  const timePromise = waitFor(bot, 'time')

  try {
    if (readyPromise) {
      const [ready] = await readyPromise
      assert.equal(ready.minecraftVersion, minecraftVersion)
      assert.equal(ready.protocolVersion, protocolVersion)
      assert.equal(bot.beyond.ready, true)
      assert.equal(bot.beyond.pack, minecraftVersion)
    }
    await spawnPromise
    await timePromise

    assert.equal(bot.version, minecraftVersion)
    assert.equal(bot.protocolVersion, protocolVersion)
    assert.equal(bot.registry.version.majorVersion, minecraftVersion)
    assert.ok(bot.entity && bot.entity.position, 'bot 应该有实体位置')
    assert.equal(bot.time.timeOfDay, 6000, 'update_time 的 totalTicks 应该被解析成 6000')
    if (expectReady) assert.ok(bot.time.clocks.overworld, '应该记录 overworld 的时间钟')
  } finally {
    try { bot.quit() } catch {}
    await fake.close()
  }
}

test('26.2：自动探测 → 登录 → spawn → 时间', async () => {
  beyond.install()
  await connectAndInspect('26.2', 776)
})

test('26.3：自动探测 → 登录 → spawn → 时间', async () => {
  beyond.install()
  await connectAndInspect('26.3', 777)
})

test('26.1 仍然照常工作（没有被补丁带坏）', async () => {
  beyond.install()
  await connectAndInspect('26.1', 775, { expectReady: false })
})

