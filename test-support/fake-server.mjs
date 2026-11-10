import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const mc = require('minecraft-protocol')

const LOGIN_WORLD_STATE = {
  dimension: 0,
  name: 'minecraft:overworld',
  hashedSeed: 0n,
  gamemode: 'creative',
  previousGamemode: 255,
  isDebug: false,
  isFlat: true,
  death: undefined,
  portalCooldown: 0,
  seaLevel: 63
}

/**
 * 最小的假服务器：只做三件事 —— 登录、给一个位置、给血量/时间。
 * 足够让 mineflayer 走完 connect_allowed → inject_allowed → spawn，验证协议数据是真的能编解码。
 *
 * 注意：26.2 的 login_success 多了 sessionId 字段，而 nmp 的 server 端没填，
 * 这里补一个空 UUID；多出来的字段对没有该字段的版本会被 protodef 忽略。
 */
export function startFakeServer ({ version, port = 0 }) {
  return new Promise((resolve, reject) => {
    const server = mc.createServer({
      version,
      'online-mode': false,
      host: '127.0.0.1',
      port,
      motd: 'beyond-test',
      hideErrors: true
    })

    const sockets = new Set()
    server.socketServer.on('connection', (socket) => {
      sockets.add(socket)
      socket.on('close', () => sockets.delete(socket))
    })

    server.once('error', reject)
    server.once('listening', () => {
      resolve({
        server,
        port: server.socketServer.address().port,
        close: () => new Promise(resolveClose => {
          let settled = false
          const finish = () => {
            if (settled) return
            settled = true
            resolveClose()
          }
          server.close(finish)
          setTimeout(() => {
            for (const socket of sockets) socket.destroy()
            finish()
          }, 1000)
        })
      })
    })

    server.on('connection', (client) => {
      const write = client.write.bind(client)
      client.write = (name, params) => {
        if (name === 'success') {
          params = { ...params, sessionId: params.sessionId ?? Buffer.alloc(16) }
        }
        return write(name, params)
      }
    })

    server.on('playerJoin', (client) => {
      try {
        client.write('login', {
          entityId: 1,
          isHardcore: false,
          worldNames: ['minecraft:overworld'],
          maxPlayers: 20,
          viewDistance: 8,
          simulationDistance: 8,
          reducedDebugInfo: false,
          enableRespawnScreen: true,
          doLimitedCrafting: false,
          worldState: LOGIN_WORLD_STATE,
          onlineMode: false,
          enforcesSecureChat: false
        })
        client.write('position', {
          teleportId: 1,
          x: 0.5,
          y: 64,
          z: 0.5,
          dx: 0,
          dy: 0,
          dz: 0,
          yaw: 0,
          pitch: 0,
          flags: {}
        })
        client.write('update_health', { health: 20, food: 20, foodSaturation: 5 })
        client.write('update_time', {
          age: [0, 0],
          clockUpdates: [{ id: 0, totalTicks: 6000, partialTick: 0, rate: 1 }]
        })
      } catch (err) {
        client.end(`beyond-test: ${err.message}`)
      }
    })
  })
}

export function waitFor (emitter, event, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`等待 ${event} 超时（${timeoutMs}ms）`))
    }, timeoutMs)
    const onEvent = (...args) => {
      cleanup()
      resolve(args)
    }
    const onError = (err) => {
      cleanup()
      reject(err)
    }
    const cleanup = () => {
      clearTimeout(timer)
      emitter.removeListener(event, onEvent)
      emitter.removeListener('error', onError)
    }
    emitter.once(event, onEvent)
    emitter.once('error', onError)
  })
}