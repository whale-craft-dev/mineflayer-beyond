#!/usr/bin/env node
'use strict'

/**
 * 发布闸门：项目早期 @whale-craft/mc-data-beyond 还没发包，依赖写的是 file:../mc-data-beyond。
 * 真到要发布时，必须先把它发上 npm，再把这里改成 ^0.1.0 —— 这个脚本就是防止带着 file: 直接 publish。
 */
const pkg = require('../package.json')

const localDeps = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })
  .filter(([, spec]) => String(spec).startsWith('file:'))

const badRuntimeDeps = localDeps.filter(([name]) => name in (pkg.dependencies || {}))

if (badRuntimeDeps.length > 0) {
  console.error('[check-publishable] 不能发布：运行时依赖里还有本地路径：')
  for (const [name, spec] of badRuntimeDeps) console.error(`  - ${name}: ${spec}`)
  console.error('先把 @whale-craft/mc-data-beyond 发布到 npm，再把依赖改成 ^0.1.0。')
  process.exit(1)
}

console.log('[check-publishable] PASS')