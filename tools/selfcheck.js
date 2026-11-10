#!/usr/bin/env node
'use strict'

/**
 * 不打游戏、不连服务器，只验证「补丁装上了、数据能加载、自检全绿」。
 * 用法：node tools/selfcheck.mjs
 */
const beyond = require('../index.js')

const report = beyond.install()
console.log(JSON.stringify(report, null, 2))

const failed = report.checks.filter(check => !check.ok)
if (failed.length > 0) {
  console.error(`\n[selfcheck] 失败：${failed.map(check => check.name).join(', ')}`)
  process.exit(1)
}

console.log('\n[selfcheck] PASS')
console.log(`[selfcheck] mineflayer ${report.mineflayer} · 最新支持 ${report.latestSupportedVersion} · 版本包 ${report.packs.map(p => p.minecraftVersion).join(', ')}`)