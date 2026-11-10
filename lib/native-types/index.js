'use strict'

/**
 * minecraft-data 的 pack 可以让插件在运行时往 minecraft-protocol 里补原生类型
 * （协议 JSON 里写 "native"、而当前 nmp 版本还没实现的那些）。
 * 每个类型对应一个安装函数，幂等、只加类型不改别的。
 */
const { installEntityDelta } = require('./entity-delta')

const INSTALLERS = {
  entityDelta: installEntityDelta
}

function installNativeTypes (ctx, packs) {
  const wanted = new Set()
  for (const pack of packs) {
    for (const name of pack.nativeTypes || []) wanted.add(name)
  }

  const installed = []
  for (const name of wanted) {
    const installer = INSTALLERS[name]
    if (!installer) {
      throw new Error(`[mineflayer-beyond] 数据包要求原生类型 ${name}，但插件里没有实现`)
    }
    const result = installer(ctx)
    if (result.installed) installed.push(name)
  }
  return installed
}

module.exports = { installNativeTypes, INSTALLERS }