# @whale-craft/mineflayer-beyond

不改 `mineflayer` 一行源码，用**运行时插件**把它还不认识的 Minecraft 版本接进来。

配套数据包：[`@whale-craft/mc-data-beyond`](https://github.com/whale-craft/mc-data-beyond)。本插件只负责「怎么接」，数据在那边，两者的发版节奏互不牵连。

## 它解决什么问题

`mineflayer` 能不能连一个版本，取决于三层：

1. `lib/version.js` 的 `testedVersions` —— 决定 `loader.js` 会不会在连上后直接拒绝；
2. `minecraft-data` 里有没有该版本的数据（`protocol.json` / `version.json`）；
3. `prismarine-chunk` / `prismarine-physics` 这类按版本名查表的依赖。

上游的节奏是：新版本先出快照，再出正式版，然后才轮到 PrismarineJS 合并数据、发 npm。等它跟上，通常已经过去几周。改 `mineflayer` 源码（fork / patch-package）能解决，但代价是每次升级都要 rebase 一遍补丁。

这个插件的思路是：**这三层全是运行时状态，不是编译期常量**，所以在 `createBot` 之前把内存里的表补齐就行。

## 用法

```js
const beyond = require('@whale-craft/mineflayer-beyond')

beyond.install()   // 必须在 createBot 之前；幂等

const bot = require('mineflayer').createBot({
  host: 'example.com',
  port: 25565,
  username: 'Bot',
  version: false   // 让它按服务器实际协议号自动探测
})
```

或者直接用封装（自动 `install()` 并挂上插件）：

```js
const bot = require('@whale-craft/mineflayer-beyond').createBot({ host, port, username })
```

手动当普通插件用也可以，但它只负责核对协议号、抛事件，不负责版本闸门：

```js
bot.loadPlugin(beyond)          // 或者 createBot({ plugins: { beyond } })
bot.on('beyond:ready', info => console.log(info))
```

### 事件

| 事件 | 时机 | 内容 |
| --- | --- | --- |
| `beyond:ready` | 版本确定且数据对得上 | `{ minecraftVersion, protocolVersion, dataVersion, baseVersion }` |
| `beyond:error` | 协议号对不上 | `Error`，`code = BEYOND_PROTOCOL_MISMATCH` |

## 它到底改了什么

`install()` 做四件事，全部只动进程内的模块对象，**不写 `node_modules`、不改任何文件**：

| 目标 | 做法 | 为什么必须这样 |
| --- | --- | --- |
| `minecraft-data` | 往 `data.js` 的导出表、`versionsByMinecraftVersion`、`postNettyVersionsByProtocolVersion`、`protocolVersions`、`supportedVersions` 里注册新版本 | 它没有官方扩展 API；`index.js` 和我们 require 到的是同一个 `data.js` 实例 |
| `mineflayer` 版本闸门 | 改 `lib/version.js` 的导出，丢掉 `lib/loader.js` 的模块缓存重新 require，再把新 loader 的能力写回 `index.js` 的导出对象 | `loader.js` 在加载时把 `latestSupportedVersion` 解构成了闭包常量，事后改 `version.js` 没用；而 `index.js` 只是 `module.exports = require('./lib/loader.js')` |
| `prismarine-chunk` | 替换模块导出：新版本走基线实现（`1.18` 的 chunk 实现完全不读版本号） | 实现表是模块私有的，只能从导出层绕 |
| `prismarine-physics` | 把新版本名追加到基线版本所在的所有特性列表 | 它的判定是 `versions.includes(majorVersion)`，精确匹配 |
| `minecraft-protocol` 原生类型 | 26.3 用到的 `entityDelta`（新的分级实体移动编码）在 1.68.0 里还没有，插件的 `lib/native-types/` 在运行时把它注册进 nmp 的 datatypes | 协议 JSON 里写的是 `"entityDelta": "native"`，不补就 `ctx.entityDelta is not a function` |

另外，26.3 的实体移动包把位移包成了 `move: { dX, dY, dZ, onGround, steps }`，而 mineflayer 的 entities 插件读 `packet.dX`。插件在 `client.emit` 前把字段摊平，mineflayer 原样工作。

这也是为什么它必须**锁定依赖版本**（见下）。

## 本地开发（两个仓库并排）

本插件依赖 `@whale-craft/mc-data-beyond`，早期两个仓并排放：

```
workspace/
  mc-data-beyond/
  mineflayer-beyond/
```

`package.json` 里写的是 `file:../mc-data-beyond`，`npm i` 即可。要发布时先把数据包发上 npm，再把依赖改成 `^0.1.0` —— `prepublishOnly` 会跑 `tools/check-publishable.js`，拦住带 `file:` 的发布。

## 版本锁定

`mineflayer` 用 `peerDependencies` 精确钉在 **4.39.0**；`minecraft-data`、`minecraft-protocol`、`prismarine-*` 在 `install()` 时逐个核对：

```js
mineflayer 4.39.0 · minecraft-data 3.119.0 · minecraft-protocol 1.68.0
prismarine-chunk 1.41.0 · prismarine-physics 1.11.1 · prismarine-registry 1.12.0
```

任何一项不符，`install()` 直接抛 `BEYOND_PINNED_VERSION`，并告诉你该装什么。原因是上面的补丁依赖这些包的**内部结构**，版本漂了可能静默失效 —— 与其连上去才炸，不如启动时炸。

临时试验可以 `BEYOND_ALLOW_UNPINNED=1` 跳过检查（只警告），后果自负。

## 当前支持的版本

| MC | 协议号 | 数据基线 | 来源 |
| --- | --- | --- | --- |
| 26.2 | 776 | 26.1 | `minecraft-data@pc_26_2` |
| 26.3 | 777 | 26.1 | `suisarbre/minecraft-data@port-26.3`（PR #1345）+ 运行时补 `entityDelta` |

`26.1` 及更早由上游原生支持，插件不碰。两个版本都用**真实原版服务端**验证过：登录 → 配置阶段 → spawn → 区块读取。

快照版本（如 `26.4-snapshot-7`）暂不支持：协议号是 `1073742xxx`，每两周变一次，没有稳定的数据来源。

## 小版本

26.3.1 这类补丁版本通常沿用 26.3 的协议号。自动探测（`version: false`）按协议号反查，所以服务器是 26.3.1 也会被识别成 26.3 并正常连接；显式传 `version: '26.3.1'` 时，`createBot` 会自动折成 `26.3`。

只有补丁版本**改了协议号**才需要新数据，那种情况加一个 pack 即可。

## 测试

```bash
npm test          # 19 项：版本锁定 / 数据注册 / 原生类型 / 小版本 / 假服务器登录（26.2、26.3、26.1 回归）
npm run selfcheck # 只验补丁和数据，不连服务器
npm run live-check -- <host> <port> [username] [auth]
```

假服务器用 `minecraft-protocol` 起一个只做「登录 + 位置 + 血量 + 时间」的最小服务，验证的是**真实协议编解码**：自动探测 → `connect_allowed` → `inject_allowed` → `spawn` → 时间包解析。

## 边界

- 只解决「版本不被认识 / 没有数据」，不解决「新版本包结构变了导致解析出错」。后者需要针对具体版本写兼容层 —— 26.3 的 `entityDelta`、实体移动字段和 `login_success` 就是例子，已经在插件/数据包里处理；26.2 不需要。
- `install()` 必须在 `createBot` 之前。已经创建过的 bot 不受影响。
- 依赖锁的是**整棵树的版本**，不是 semver 范围；升级 `mineflayer` 要等本插件跟进。
- 数据包只覆盖正式版，且静态数据复用 `26.1`（26.2 / 26.3 没有改注册表，上游 `dataPaths.json` 也这么写）。

## 许可

MIT。协议数据来自 [PrismarineJS/minecraft-data](https://github.com/PrismarineJS/minecraft-data)（MIT），详见 `@whale-craft/mc-data-beyond` 的说明。

