# 从 Miao-Yunzai 迁移

结论先行：**旧插件无法直接放入运行。** 这并非兼容工作的缺失，而是刻意的选择 ——
旧插件所依赖的 `global.Bot`、`global.plugin`、`global.segment`、`global.redis` 均不存在，
而它们的存在本身即是[重写的原因](architecture.md#重写的原因)。

当前**没有随发行版预置的兼容层插件**。一个尽力而为的 `yunzai-compat`（补足 `global.Bot`、
`segment`、`plugin`、`e.runtime`）在计划中属可选项，尚未实现。因此当前的迁移途径是手工改写。

改写量小于表面所见：典型的 miao 插件中，业务逻辑本身（伤害计算、数据组装、模板编写）
无须改动，需要改写的仅是外壳。

## 对照表

| 项目 | Miao-Yunzai | Yunzai NG |
|---|---|---|
| 插件形态 | `class X extends plugin` + `rule[]` | `definePlugin({ setup(ctx) })` |
| 声明命令 | `rule: [{ reg: "^#体力$", fnc: "note" }]` | `ctx.command("#体力").action(fn)` |
| 回复 | `this.reply(msg, quote)` / `e.reply` | `e.reply(msg, { quote: true })` |
| 消息段 | `global.segment.image(x)` | `import { seg } from "@yunzai-ng/core"`，或直接传字符串 |
| 主动发消息 | `Bot.pickGroup(gid).sendMsg(m)` | `ctx.pickBot()?.sendMessage({ scene: "group", gid }, m)` |
| 定时任务 | `this.task = { cron, name, fnc }` | `ctx.cron(expr, fn)`，返回 Disposer |
| 存数据 | `redis.set("Yz:xx", v)` | `ctx.kv.set("xx", v)`，已按插件隔离，无须自行加前缀 |
| 关系数据 | sequelize | `ctx.sql()` + `migrate()` |
| 读配置 | `Cfg.getConfig("xx")` 并自行维护 yaml | `configSchema` + `ctx.config.get()`，面板据 schema 生成表单 |
| 出图 | `puppeteer.screenshot(name, { tplFile, ... })` 并自行拼接相对路径 | `ctx.render("note", data)` / `e.renderReply(...)` |
| 多轮对话 | `setContext` / `getContext` / `finish` | `await e.prompt({ tip })` |
| 调用其他插件 | `import { MysInfo } from "../../genshin/model"` | `ctx.inject("mihoyo.api")` |
| 日志 | `global.logger.info` | `ctx.logger.info`，自动带插件名 |
| 接入新协议 | 修改 `lib/bot.js` 或改写 `global.Bot` | 编写插件并调用 `ctx.registerAdapter` |
| 更换渲染器 | 修改 `lib/renderer/` | 编写插件并调用 `ctx.registerRenderer` |
| 使用 Redis | 内核硬依赖 | 编写 KV 驱动插件并调用 `ctx.registerKvDriver` |

## 逐段改写

### 命令

```js
// 旧
export class example extends plugin {
  constructor() {
    super({
      name: "示例", dsc: "示例", event: "message", priority: 100,
      rule: [{ reg: "^#体力$", fnc: "note" }, { reg: "^#签到$", fnc: "sign", permission: "master" }]
    })
  }
  async note(e) { await this.reply("查询中") ; return true }
}
```

```ts
// 新
export default definePlugin({
  name: "example",
  setup(ctx) {
    ctx.command("#体力").desc("查询体力").action(async e => { await e.reply("查询中") })
    ctx.command("#签到", { master: true }).action(async e => { /* … */ })
  }
})
```

对应关系：`reg` → 命令模式（**字符串即可，无须写正则**，前缀匹配经首字符分桶，代价更低）；
`fnc` → `action` 的函数体；`permission: "master"` → `{ master: true }`；
`priority` → `{ priority }`；`return true` → 无须书写（缺省命中即止），
`return false` 语义不变，表示继续尝试下一个候选。

`this.e` 不再存在：事件是 `action` 的参数。这也使"每条消息实例化一遍全部插件类"这一行为
从根本上不再出现。

### 定时任务

```js
// 旧
this.task = { cron: "0 0 8 * * *", name: "体力推送", fnc: () => this.push() }
```

```ts
// 新
ctx.cron("0 0 8 * * *", () => push(), { name: "体力推送", overlap: "skip", timeout: "5m" })
```

`overlap: "skip"` 是缺省值，等价于旧 loader 中的 `taskRunning` 标记，但无须自行维护。

### 多轮对话

```js
// 旧
this.setContext("saveCookie", false, 120)
// 另一个方法里
async saveCookie(e) { ... this.finish("saveCookie") }
```

```ts
// 新
const next = await e.prompt({ tip: "请发送 Cookie", timeout: "2m" })
if (next === undefined) return           // 超时或插件卸载
await save(next.text)
```

一处写完即可，无须"另起一个方法并记得调用 finish"。等待句柄挂在插件的 disposer 上，
热重载不会留下悬空的等待者。

### 存储

```js
// 旧
await redis.set(`Yz:genshin:mys:cookie:${uid}`, ck)
await redis.incr(`Yz:count:${e.user_id}`)
```

```ts
// 新
await ctx.kv.set(`cookie:${uid}`, ck)          // 前缀 plugin:<插件名>: 由内核添加
await ctx.kv.incr(`count:${e.sender.uid}`, 1, { ttl: "1d" })
```

键前缀无须自行拼接，亦不再需要安装 Redis。确需使用 Redis 时，编写一个实现 `KvDriver` 的
插件即可，使用 KV 的代码无须改动。

### 出图

```js
// 旧
await this.reply(await puppeteer.screenshot("genshin/note", {
  tplFile: "./plugins/genshin/resources/html/note/note.html",
  pluResPath: `${_path}/plugins/genshin/resources/`,
  ...data
}))
```

```ts
// 新
await e.renderReply("note", data)
```

模板置于插件的 `templates/`，静态资源置于 `resources/`，模板内以 <code v-pre>{{res}}</code> 取用。
渲染器同时提供 `_res_path`、`pluResPath`、`resPath` 三个旧变量，
**因此多数旧 HTML 模板可原样迁入**，需要改动的仅是调用侧。详见[渲染与模板](renderer.md)。

### 配置

```js
// 旧：自行创建 config/default_config/xx.yaml，再以 Cfg.getConfig("xx") 读取
```

```ts
// 新
configSchema: s.object({
  cookie: s.password().title("米游社 Cookie"),
  pushHour: s.number().int().min(0).max(23).default(8).title("推送时间")
})
// 读：ctx.config.get().pushHour
```

无须编写读写文件的代码，无须提供默认配置文件，亦无须为面板编写任何前端。

### 跨插件调用

```js
// 旧
import { MysInfo } from "../../genshin/model/index.js"
```

```ts
// 新
const api = ctx.inject<MihoyoApi>("mihoyo.api")
if (api === undefined) return e.reply("请先安装 mhy-game 插件")
```

以相对路径 import 意味着插件必须知道对方安装在哪个目录，目录名一经改动即失效。
详见[插件间的协作](plugin-api.md#插件间的协作)。

## 米游社相关插件

若插件属于"基于 genshin 插件的扩展"，即使用其 CK 池与 MysApi，则等价物是 `mhy-game-plugin`
所提供的服务：`ctx.inject("mihoyo.api")`。它是旧 genshin 插件的重写，包含 CK 池、设备指纹，
以及体力、札记、角色、深渊、抽卡等主链路。

**设备信息的口径已变更**：每个用户在绑定 Cookie 时获得一份**固定**的虚拟设备信息，此后
所有请求均使用该信息；用户自行绑定了设备时优先使用绑定的设备。米游社将出现超过一天的设备
视为常用设备，因此设备信息不得每次请求都更换 —— 旧实现中随机生成 device 的做法会使账号
长期处于新设备状态。

## 不予支持的用法

| 旧写法 | 原因 |
|---|---|
| `global.Bot` / `global.redis` / `global.logger` / `global.plugin` / `global.segment` / `global.Renderer` | 全局变量意味着没有边界，也就无法卸载。这是重写的首要动因 |
| `e.runtime` | 该对象是内核反向依赖 genshin 插件的入口（`lib/plugins/runtime.js`） |
| `#miao` / `#miao.models` / `#yunzai` 等 import | 分层门禁（`pnpm check:layering`）将直接判定失败 |
| 由内核注入 `e.isSr` / `e.isGs` / `e.game` | 游戏识别属插件职责，应以中间件配合 `EventExtensions` 自行添加 |
| `icqq` 直连登录 | 登录属适配器插件职责；如需 icqq，编写一个 `adapter-icqq` |

## 建议的迁移顺序

1. 执行 `yzng plugin new <名字>`，先使 `#ping` 可用。
2. 将旧插件中的**纯逻辑文件**（算法、数据处理）原样复制过来，它们通常不涉及任何全局变量。
3. 将 `rule[]` 逐条翻译为 `ctx.command`。建议先迁移一条最简单的命令并验证可用。
4. 将 `redis.*` 替换为 `ctx.kv.*`，并去除键前缀。
5. 将配置替换为 `configSchema`，删除自行编写的 yaml 读写代码。
6. 将模板目录迁至 `templates/`、资源迁至 `resources/`，调用改为 `e.renderReply`。
7. 最后迁移定时任务：它在改写未完成时最易被误触发。
