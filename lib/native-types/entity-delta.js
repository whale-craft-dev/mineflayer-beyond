'use strict'

const path = require('path')

/**
 * 26.3 把实体移动的 delta 换成了新的「分级」编码（VecDelta），协议里声明为原生类型 entityDelta：
 *
 *   properties: varint   bit0 = onGround，其余位 = stepCount
 *   stepCount <= 0       → 老格式：3 × i16（dX, dY, dZ），ticks 记 0
 *   stepCount > 0        → stepCount 组 { ticks: varint, dX: i16, dY: i16, dZ: i16 }，
 *                          每一组都是相对上一组的增量
 *
 * node-minecraft-protocol 1.68.0 还没有这个类型（上游 PR #1538 / #1553 尚未合并）。
 * 这里在运行时把它注册进 nmp 的 datatypes 模块：只加一个类型，不动其它任何东西。
 *
 * 为了让 mineflayer 的 entities 插件（它读 packet.dX/dY/dZ，再除以 4096）继续工作，
 * read() 除了 steps 之外还给出累计后的 dX/dY/dZ。
 */
function createEntityDelta () {
  const protodef = require('protodef')
  const [readVarInt, writeVarInt, sizeOfVarInt] = protodef.types.varint
  const PartialReadError = protodef.utils.PartialReadError

  function read (buffer, offset) {
    let cursor = offset
    const props = readVarInt(buffer, cursor)
    cursor += props.size
    if (props.value < 0) throw new PartialReadError('entityDelta: properties 是负数')
    const onGround = (props.value & 1) !== 0
    const stepCount = props.value >>> 1

    const steps = []
    if (stepCount <= 0) {
      if (cursor + 6 > buffer.length) throw new PartialReadError('entityDelta: 线性段数据不足')
      steps.push({
        dX: buffer.readInt16BE(cursor),
        dY: buffer.readInt16BE(cursor + 2),
        dZ: buffer.readInt16BE(cursor + 4),
        ticks: 0
      })
      cursor += 6
    } else {
      for (let i = 0; i < stepCount; i++) {
        const ticks = readVarInt(buffer, cursor)
        cursor += ticks.size
        if (cursor + 6 > buffer.length) throw new PartialReadError('entityDelta: 分段数据不足')
        steps.push({
          dX: buffer.readInt16BE(cursor),
          dY: buffer.readInt16BE(cursor + 2),
          dZ: buffer.readInt16BE(cursor + 4),
          ticks: ticks.value
        })
        cursor += 6
      }
    }

    let dX = 0
    let dY = 0
    let dZ = 0
    for (const step of steps) {
      dX += step.dX
      dY += step.dY
      dZ += step.dZ
    }

    return { value: { dX, dY, dZ, onGround, steps }, size: cursor - offset }
  }

  function toSteps (value) {
    if (value && Array.isArray(value.steps) && value.steps.length > 0) return value.steps
    return [{ dX: value.dX | 0, dY: value.dY | 0, dZ: value.dZ | 0, ticks: 0 }]
  }

  function encode (value) {
    const steps = toSteps(value)
    const useLinear = steps.length === 1 && steps[0].ticks === 0
    const stepCount = useLinear ? 0 : steps.length
    const properties = (value.onGround ? 1 : 0) | (stepCount << 1)
    return { steps, useLinear, properties }
  }

  function write (value, buffer, offset) {
    const { steps, useLinear, properties } = encode(value)
    offset = writeVarInt(properties, buffer, offset)
    if (useLinear) {
      buffer.writeInt16BE(steps[0].dX, offset)
      buffer.writeInt16BE(steps[0].dY, offset + 2)
      buffer.writeInt16BE(steps[0].dZ, offset + 4)
      return offset + 6
    }
    for (const step of steps) {
      offset = writeVarInt(step.ticks, buffer, offset)
      buffer.writeInt16BE(step.dX, offset)
      buffer.writeInt16BE(step.dY, offset + 2)
      buffer.writeInt16BE(step.dZ, offset + 4)
      offset += 6
    }
    return offset
  }

  function sizeOf (value) {
    const { steps, useLinear, properties } = encode(value)
    let size = sizeOfVarInt(properties)
    if (useLinear) return size + 6
    for (const step of steps) size += sizeOfVarInt(step.ticks) + 6
    return size
  }

  return [read, write, sizeOf]
}

function installEntityDelta (ctx) {
  const minecraftProtocol = ctx.stack['minecraft-protocol']
  const typesPath = path.join(minecraftProtocol.dir, 'src', 'datatypes', 'minecraft.js')
  const compilerPath = path.join(minecraftProtocol.dir, 'src', 'datatypes', 'compiler-minecraft.js')

  const types = ctx.require(typesPath)
  const compiler = ctx.require(compilerPath)

  if (types.entityDelta) return { installed: false, reason: 'already present' }
  if (!compiler || !compiler.Read || !compiler.Write || !compiler.SizeOf) {
    throw new Error('[mineflayer-beyond] minecraft-protocol 的 compiler-minecraft 结构不认识，无法注册 entityDelta')
  }

  const [read, write, sizeOf] = createEntityDelta()
  types.entityDelta = [read, write, sizeOf]
  compiler.Read.entityDelta = ['native', read]
  compiler.Write.entityDelta = ['native', write]
  compiler.SizeOf.entityDelta = ['native', sizeOf]

  return { installed: true, files: [typesPath, compilerPath] }
}

module.exports = { installEntityDelta }