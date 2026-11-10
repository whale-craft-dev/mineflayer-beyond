'use strict'

/**
 * 插件锁定它认识的那一套依赖版本。
 *
 * 「锁定」是双向的：
 *  - 发布侧：package.json 的 peerDependencies 把 mineflayer 钉死在 4.39.0；
 *  - 运行侧：install() 时逐个核对真实解析到的版本，不一致就抛错（除非显式放行）。
 *
 * 为什么要连 minecraft-data / minecraft-protocol / prismarine-* 一起钉：
 * 这个插件不使用任何 patch 文件，它靠的是这些包**当前的内部结构**（loader.js 的闭包、
 * data.js 的表、prismarine-physics 的 features.json 按版本名精确匹配……）。
 * 上游一改结构，补丁就可能静默失效 —— 与其埋雷，不如在启动时大声报错。
 */
const PINNED = Object.freeze({
  mineflayer: '4.39.0',
  'minecraft-data': '3.119.0',
  'minecraft-protocol': '1.68.0',
  'prismarine-chunk': '1.41.0',
  'prismarine-physics': '1.11.1',
  'prismarine-registry': '1.12.0'
})

const INSTALL_HINT = [
  'npm i mineflayer@4.39.0 minecraft-data@3.119.0 minecraft-protocol@1.68.0',
  '（npm 会自动把 mineflayer 的 ^3.108 / ^1.66 范围解析到这两个版本；',
  '  若你的 lockfile 已经把它们顶到更高版本，先降回来。）'
].join('\n')

function checkPins (stack, options = {}) {
  const allowUnpinned = options.allowUnpinned ?? (process.env.BEYOND_ALLOW_UNPINNED === '1')
  const warn = options.warn ?? ((msg) => console.warn(msg))
  const problems = []
  for (const [name, expected] of Object.entries(PINNED)) {
    const actual = stack[name] && stack[name].version
    if (actual !== expected) problems.push({ name, expected, actual: actual ?? '(未找到)' })
  }
  if (problems.length === 0) return { ok: true, problems, allowed: false }
  if (!allowUnpinned) {
    const lines = problems.map(p => `  - ${p.name}: 需要 ${p.expected}，实际 ${p.actual}`)
    const err = new Error([
      '@whale-craft/mineflayer-beyond 的依赖版本不对，已拒绝打补丁。',
      '它只支持下面这一组版本（补丁依赖这些版本的内部结构）：',
      ...lines,
      '',
      '修复：',
      INSTALL_HINT,
      '或者把本插件升级到支持你当前依赖树的版本。',
      '（仅临时试验可用 BEYOND_ALLOW_UNPINNED=1 跳过检查 —— 后果自负。）'
    ].join('\n'))
    err.name = 'BeyondPinnedVersionError'
    err.code = 'BEYOND_PINNED_VERSION'
    err.problems = problems
    throw err
  }
  warn('[mineflayer-beyond] 已按 BEYOND_ALLOW_UNPINNED=1 跳过版本锁定检查：\n' +
    problems.map(p => `  - ${p.name}: 期望 ${p.expected}，实际 ${p.actual}`).join('\n'))
  return { ok: false, problems, allowed: true }
}

module.exports = {
  PINNED,
  INSTALL_HINT,
  checkPins,
  mineflayerVersions: [PINNED.mineflayer]
}