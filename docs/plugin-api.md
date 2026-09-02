# 插件开发

插件可执行的全部操作均由 `ctx`（`PluginContext`）提供。不存在全局变量，也不存在
`require("../../lib/...")` 一类的反向引用，因此内核确切掌握每个插件占用了哪些资源，
并在卸载时全部回收。

## 最小插件

`<home>/plugins/hello/index.js`：

```js
import { definePlugin } from "@yunzai-ng/core"

export default definePlugin({
  name: "hello",
  setup(ctx) {
    ctx.command("#你好").desc("发送问候").action(async e => { await e.reply("你好") })
  }
})
```

放入该目录后重启即生效，启用 `plugins.hotReload` 时无须重启。亦可直接放置单文件
`<home>/plugins/我的小功能.js` —— 数十行的小型功能无须为此建立目录与 `package.json`。

`yzng plugin new <名字>` 生成一份带注释的骨架。

## 目录与入口

内核按以下顺序确定入口：`package.json` 的 `yunzai.entry` → `exports["."]` → `module` →
`main`，其后依次回落至 `dist/index.js` → `index.js` → `index.mjs` → `lib/index.js`。

TypeScript 插件须编译至 `dist/index.js`，并在 `package.json` 中声明 `"main": "dist/index.js"`。
`src/index.ts` 仅在源码模式（vitest / tsx）下被视为入口，否则未经编译的插件将以
`Unknown file extension ".ts"` 这一缺乏指向性的错误失败。

```
my-plugin/
├─ package.json      main / yunzai.entry
├─ src/              TypeScript 源码
├─ dist/             编译产物（入口在此）
├─ templates/        ctx.render 的模板根
└─ resources/        图片、字体等静态资源，模板内以 res 取用
```

以 `.` 或 `_` 开头的目录名将被跳过，其中 `_` 是"作者临时禁用"的约定；`package.json` 中声明
`"yunzai": { "disabled": true }` 同样跳过。

同名插件只保留先扫到的那份，扫描顺序是 `--plugins` 指定的目录 → `<home>/plugins` → 随发行版
预置的目录。因此复制一份预置插件到用户插件目录并加以修改，即可覆盖原插件而无须改动发行版内容。

## definePlugin

```ts
export default definePlugin({
  name: "mhy-game",          // 必填，且是配置文件名 + KV 命名空间 + URL 前缀 + 日志 scope
  version: "1.0.0",
  description: "原神 / 星穹铁道 / 绝区零",
  author: "…",
  homepage: "…",
  dependencies: ["renderer-puppeteer"],
  provides: ["mihoyo.api"],
  priority: 100,             // 小者先加载
  configSchema: s.object({ /* … */ }),
  setup(ctx) { /* … */ }
})
```

`name` 必须匹配 `/^[a-z][a-z0-9._-]*$/i`。该约束比目录名更严，因为它同时是
`config/<name>.yaml` 的文件名与 KV 命名空间前缀 —— 名称中含 `:` 或 `/` 即意味着一个插件
可以读写他人的命名空间。非法名称在 `import` 的瞬间即抛错，而非等到写文件时抛出一个
难以定位的 ENOENT。

`dependencies` 只影响加载顺序与存活判定：**依赖缺失仅使本插件跳过并记一条 warn，内核照常启动。**
旧框架在缺少 genshin 插件时整体无法启动，原因是内核反向 import 了它。

必须使用 `definePlugin` 而非手写对象字面量：`@yunzai-ng/types` 是零依赖的叶子包，
其中 `configSchema` 声明为 `unknown`，`ConfigOf<S>` 的类型推导只能在 core 中完成。
经此包装之后 `ctx.config.get().cookie` 才具备类型，字段名书写错误将成为编译错误。

插件仓库若随包发布 `.d.ts`（`tsconfig` 开了 `declaration`，官方插件都是如此），应给默认导出
显式标注类型：

```ts
import type { PluginDefinition } from "@yunzai-ng/types"

const plugin: PluginDefinition<MyConfig> = definePlugin({ /* … */ })
export default plugin
```

`definePlugin` 的返回类型声明在 `@yunzai-ng/types` 内，而插件在使用者主目录里就地构建时，
该包由 `<home>/node_modules/@yunzai-ng/types` 这条链接提供，真实路径落在 pnpm 的 `.pnpm/`
之下 —— tsc 写不出可移植的名字，报 `TS2742: The inferred type of 'default' cannot be named`。
标注之后 `.d.ts` 里直接就是这个名字，与宿主的安装布局无关。`MyConfig` 即 `configSchema`
推出的那个类型（`Infer<typeof 你的 schema>`）；未声明 `configSchema` 时写
`PluginDefinition<Record<string, never>>`。

`setup` 有 30 秒超时，超时按加载失败处理。**不应在 setup 内执行耗时的网络请求** ——
需要预热时注册 `ctx.on("app/ready", …)`。返回值可以是一个 Disposer，等价于在其中调用
`ctx.onDispose`。

## ctx 全表

只读属性：

| 属性 | 含义 |
|---|---|
| `ctx.name` `ctx.version` `ctx.root` | 插件自身信息，`root` 为绝对路径 |
| `ctx.dataDir` | 本插件专属数据目录，已创建 |
| `ctx.logger` | 自动附带插件名的 child logger |
| `ctx.kv` | 已绑定 `plugin:<name>:` 前缀的 KV 命名空间 |
| `ctx.config` | 配置句柄，未声明 schema 时 `get()` 返回空对象 |
| `ctx.app` | 应用只读视图（版本、paths、platform、adapters、bots、accounts、plugins、policy、server、`usage()`） |
| `ctx.http` | 带全局代理、超时与重试缺省值的 HTTP 客户端；**已绑定 `ctx.signal`**，在途请求随插件卸载中止 |
| `ctx.signal` | 插件卸载时 abort，可直接传给 `fetch` |

注册类方法**全部返回 Disposer**：

| 方法 | 用途 |
|---|---|
| `command(pattern, opts?)` | 声明命令，返回链式构造器 |
| `middleware(fn, opts?)` | Koa 语义中间件 |
| `on(event, handler)` | 监听内核事件 |
| `cron(expr, fn, opts?)` / `every(interval, fn, opts?)` | 定时任务 |
| `provide(key, value)` / `inject(key)` / `require(key)` / `waitFor(key, timeout?)` | 插件间协作 |
| `route(method, path, handler, opts?)` / `websocket(path, handler, opts?)` / `static(urlPath, dir)` | 挂载至共享 HTTP 服务器 |
| `panel(dir)` | 接管站点根路径，替换内置面板 |
| `registerAdapter` / `registerRenderer` / `registerKvDriver` | 提供内核能力实现 |

其余：`render(template, data?, opts?)`、`sql(name?)`、`cache(opts)`、`resource(...parts)`、
`onDispose(fn)`、`pickBot(bot?)`。

`ctx.app` 刻意设计为**只读**视图：修改全局状态须经各自的具名 API（如 `ctx.config.patch`），
以便审计变更的来源与内容。

## 命令

```ts
ctx.command("#体力", { alias: ["#树脂"], desc: "查询实时便笺", cooldown: "5s" })
  .action(async e => { await e.renderReply("note", await Note.get(e)) })

ctx.command(/^#(?<n>\d+)层深渊$/)
  .action(async e => { await e.reply(`第 ${e.command!.groups.n} 层`) })
```

字符串为**前缀匹配**，正则则对 `e.text` 完整执行 `exec`。命名捕获进入 `e.command.groups`，
数字捕获进入 `captures`；未参与匹配的分组统一为空串，以免插件内到处书写 `?? ""`。
触发词之后剩余的文本是 `e.command.rest`，已去除首尾空白。

`CommandOptions` 全集：`alias` `desc` `usage` `group` `scene` `master` `admin`
`cooldown` `cooldownScope`（`user` / `group` / `groupUser` / `global`）`cooldownTip`
`priority`（缺省 100，小者优先）`atMe` `anywhere` `block` `hidden` `ignoreSelf`。
链式构造器覆盖常用项：`.action() .alias() .desc() .scene() .master() .admin()
.cooldown() .priority() .dispose()`。

以下实现语义需要了解：

- **首字符分桶。** 路由按模式首字符建桶，一条 `#体力` 消息只会尝试 `#` 桶内的候选，
  桶内顺序在注册时即已排定 —— 匹配路径上不存在排序与正则编译。因此命令数量增长至数百条
  也不会使每条消息变慢。这是对旧 loader"逐条消息线性执行全部正则"的直接修正。
- 无法判定首字符的正则（`/^\d+/`、带 `i` 或 `m` 标志的字母开头模式、`anywhere: true` 的字符串）
  落入未分桶列表，每条消息均会尝试。凡可写成固定前缀者，不应写成此种形态。
- 静态过滤（禁用、场景、`atMe`、`master`、`admin`、`ignoreSelf`）在路由中完成，无额外开销。
  **主人不受 `admin` 限制**，否则主人在自身并非管理员的群内将无法使用管理命令。
  `ignoreSelf` 缺省为 true，否则复读一类的命令会自我触发形成死循环。
- **冷却在命中之后才计入**，主人豁免；处理函数抛错或返回 `false` 时退还。
- 处理函数返回 `false` 表示"本条不予处理"，内核继续尝试下一个候选；其余情况下
  `block !== false` 时命中即止。

### 前缀遮蔽

`#体力` 与 `#体力上限` 同时存在时，前者是后者的前缀，两条均会命中，顺序由
`(priority, 注册先后)` 决定。若需更具体者优先，为其设置更小的 `priority`：

```ts
ctx.command("#体力上限", { priority: 50 }).action(...)
ctx.command("#体力").action(...)   // 或在此处判断 e.command.rest 后 return false
```

## 事件对象

适配器只填写平台确实提供的字段（`IncomingEvent`），`id`、`time`、`platform`、`bot`、`reply`、
`isMaster` 等派生项由内核补齐。插件取得的 `MessageEvent` 上常用者如下：

| | |
|---|---|
| 内容 | `message`（段数组，可改写）、`text`（纯文本视图）、`images`（含引用消息里的图）、`quote` |
| 身份 | `sender`、`group`、`channel`、`atMe`、`atUsers`、`isMaster`、`isGroupAdmin`、`isGroupOwner`、`isPrivate`、`isGroup` |
| 动作 | `reply(content, opts?)`、`render(tpl, data?)`、`renderReply(tpl, data?)`、`recall()`、`prompt(opts?)` |
| 其他 | `command`（在 `action` 内必定有值）、`state`（本次事件的临时状态容器）、`stop()`、`refresh()` |

`e.reply` 的 `opts` 中 `at: true` 自动 @ 发送者，`quote: true` 引用当前消息。
`content` 可以是字符串、`seg.*(...)` 的结果，或它们的数组。

改写 `e.message` 之后须调用 `e.refresh()`，否则 `text`、`atMe`、`atUsers`、`images` 仍为旧值。

`e.state` 用于中间件向下游传值，**键应带插件前缀**（如 `"mhy:uid"`）以避免冲突；
它随事件一并回收，不会泄漏。

为事件添加类型化字段应使用 `EventExtensions`，而非修改内核：

```ts
declare module "@yunzai-ng/types" {
  interface EventExtensions { game?: "gs" | "sr" | "zzz" }
}
```

旧框架直接在内核 loader 中写入 `e.isSr = e.game === "sr"`，导致内核永久携带特定游戏的概念。

### 追问

```ts
const next = await e.prompt({ tip: "请发送 UID", timeout: "30s" })
if (next === undefined) return   // 超时，或插件正在卸载
await e.reply(`收到 ${next.text}`)
```

取代旧框架的 `setContext` / `getContext` / `finish` 三者：旧实现将上下文保存在插件类实例的
`stateArr` 上，热重载后上下文即悬空。此处的等待句柄挂在插件的 disposer 上，卸载时以
`undefined` 结束（与超时同一条路径），插件无须为此额外书写一个 catch。等待期间，
该会话的消息不会同时触发命令。

## 中间件

```ts
ctx.middleware(async (e, next) => {
  if (e.kind !== "message") return next()
  if (e.text.startsWith("*")) {
    e.state["mhy:game"] = "sr"
    e.message = [seg.text(`#星铁${e.text.slice(1)}`), ...e.message.slice(1)]
    e.refresh()
  }
  await next()
}, { kind: "message", priority: 10 })
```

Koa 语义：`priority` 小者位于外层，同优先级按注册先后；不调用 `next()` 即阻断后续中间件与
命令匹配。`kind` 限定事件大类，缺省为全部。

游戏前缀识别理应实现在插件内，这也是本次重写最直接的动因之一 ——
旧框架将 `srReg` 与 `zzzReg` 写死在 `lib/plugins/loader.js` 中。

## 配置

一份 schema 同时驱动三处：带中文注释的 YAML、面板表单与写入校验。

```ts
configSchema: s.object({
  cookie: s.password().title("米游社 Cookie").desc("从浏览器 F12 复制"),
  push: s.object({
    enable: s.boolean().default(false).title("开启体力推送"),
    threshold: s.number().int().min(0).max(200).default(150).title("阈值")
                .showWhen({ enable: true })
  }).title("推送").group("推送")
})
```

构造器：`s.string` `number` `boolean` `literal` `enum` `select` `array` `object`
`record` `unknown` `duration` `cron` `port` `password` `text` `tags` `ids` `dir` `file`。
其中后九项为语义类型：它们决定面板采用何种控件，`duration` 另接受 `"5s"`、`"3m"` 一类的写法。

链式修饰：`title` `desc` `group` `order` `widget` `secret` `readonly` `placeholder`
`showWhen` `optional` `default` `check` `min` `max` `pattern` `int` `step` `strict` `single`。

读写：

```ts
const cfg = ctx.config.get()                    // 只读快照，仅在变更后替换为新对象
await ctx.config.patch({ push: { enable: true } })  // 深合并并落盘，校验失败时抛错且原值不变
ctx.config.onChange(({ paths, source }) => { ctx.logger.info(`配置已变更：${paths}`) })
```

`onChange` 附带**变更路径**，因此插件可仅失效受影响的部分。旧框架的 `mergedCache` 在任何变动时
整体 `clear()`，修改一个群的配置将导致全部群的合并结果重算。

`s.password()` 与 `.secret()` 标记的字段在面板与日志中均不回显。

## 存储

`ctx.kv` 已附带 `plugin:<name>:` 前缀，无须自行拼接键名：

```ts
await ctx.kv.set("uid:" + e.sender.uid, uid, { ttl: "7d" })
const uid = await ctx.kv.getOr("uid:" + e.sender.uid, "")
const n = await ctx.kv.incr("today:" + date, 1, { ttl: "1d" })   // 原子自增，计数与冷却应使用此方法
for await (const [k, v] of ctx.kv.entries("uid:")) { /* … */ }
const sub = ctx.kv.sub("gacha")                                   // 派生子命名空间
```

另有 `get` `del` `has` `ttl` `keys` `clear`。默认驱动为内嵌 LevelDB；替换为其他实现
（Redis 等）只需一个实现 `KvDriver` 并调用 `ctx.registerKvDriver` 的插件，
使用 KV 的插件代码无须改动 —— 这即是"计数与冷却不得硬绑 Redis 键"的实现方式。

多行且需要索引的数据（抽卡记录、面板快照）应使用 SQLite：

```ts
const db = await ctx.sql()          // 本插件专属库，随插件卸载自动关闭
await db.migrate([
  { version: 1, name: "init", async up(tx) { await tx.run("CREATE TABLE gacha (…)") } }
])
const rows = await db.all<Row>("SELECT * FROM gacha WHERE uid = ?", [uid])
await db.transaction(async tx => { /* 抛错即回滚 */ })
```

`migrate` 按 version 记录进度，重复调用具备幂等性。此处刻意不引入 ORM。

进程内缓存使用 `ctx.cache`，**必须声明上限**：

```ts
const cache = ctx.cache<Panel>({ max: 500, ttl: "10m" })
```

省略 `ttl` 表示仅受 `max` 约束，适用于预编译 SQL 一类不会失效的内容；会变化的数据必须声明 `ttl`。
`ctx.cache` 创建的实例随插件卸载自动清空。

## 定时任务

```ts
ctx.cron("0 0 8 * * *", async signal => { await Note.pushAll(signal) }, {
  name: "体力推送", overlap: "skip", timeout: "5m"
})
ctx.every("30m", async () => { /* … */ }, { immediate: true })
```

cron 支持 5 段或 6 段（含秒）。`overlap` 缺省为 `"skip"`，即上一轮未执行完毕时跳过本轮 ——
旧框架的推送任务因缺少该保护而出现堆积。`timeout` 到时将 abort 传入任务体的 `signal`，
因此长任务应将其透传给 `fetch`。其他选项：`immediate`、`timezone`。

面板的任务列表来源于这些注册，含 `nextRun`、`lastRun`、`lastCost`、`running`、`skipped`。

## 插件间的协作

不经由 import：那样 A 必须知道 B 安装在哪个目录，且两份代码会被打包两次。
应改用服务注册：

```ts
// 提供方
export default definePlugin({
  name: "mhy-game",
  provides: ["mihoyo.api"],
  setup(ctx) { ctx.provide("mihoyo.api", { async note(uid) { /* … */ } }) }
})

// 使用方
const api = ctx.inject<MihoyoApi>("mihoyo.api")   // 未安装时为 undefined
const api = ctx.require<MihoyoApi>("mihoyo.api")  // 未安装时抛错（硬依赖）
const api = await ctx.waitFor<MihoyoApi>("mihoyo.api", "10s")  // 弱依赖：等待，超时返回 undefined
```

键名建议写作 `<插件域>.<能力>`。`waitFor` 适用于"需要对方提供的能力，但对方未安装时本插件仍应存活"
的场合 —— 配合 `dependencies` 即可表达强弱两种依赖：写入 `dependencies` 者缺失即跳过本插件，
仅经 `waitFor` 获取者缺失则各自降级。

该机制取代了旧框架将 MysApi、MysInfo 直接置入内核 `Runtime` 的做法：内核对
`mihoyo.api` 的内容毫不知情。

## HTTP 路由与静态资源

```ts
ctx.route("GET", "/stat", async req => ({ ok: true, ip: req.ip }))
ctx.websocket("/feed", (conn, req) => { conn.onMessage(d => conn.send(d)) })
ctx.static("/ui", ctx.resource("web"))
```

以上均挂载于 `/plugin/<插件名>` 之下，共用内核的单一 HTTP 服务器。旧框架的 web 调试器与
控制面板各自启动一个 express，端口与鉴权互不相干。

`route` 默认**要求面板令牌**（`auth: true`）。仅当适配器的 webhook 端点自带签名校验时才应设
`auth: false` 并自行验签，并按需以 `rawBody: true` 获取原始字节。`websocket` 的
`verify(req)` 返回 false 即拒绝握手。

需要拼接对外地址（反向代理场景）时读取 `ctx.app.server.publicUrl`，并**先检查 `enabled`** ——
用户可关闭内置服务器，因此被动接入的适配器应在创建账号时即提示该模式需先启用内置服务器。

## 接管面板

**内核不提供面板前端**，只检测站点根路径是否已被接管。面板整体由插件提供：

```ts
ctx.panel(ctx.resource("dist"))
```

`ctx.panel(dir)` 将一个单页应用目录挂载至站点根路径 `/`，并以 SPA 回退方式处理未命中的
子路径。它与 `ctx.static` 有两处区别，均源于"接管"这一语义：

- **不位于 `/plugin/<插件名>` 作用域下。** 接管面板的意义正在于占据站点根路径；
  挂载于插件作用域之下的页面无法成为默认入口。
- **归属可查。** 挂载记为 `plugin:<插件名>`，内核据此回答面板由何者提供。

在 `setup()` 内调用即可。内核在全部插件加载完成之后才检测根路径的归属，因此顺序上
总是插件先挂、内核后看；检测到有归属时记一条 info 说明提供者，无归属时记一条指向
插件市场的提示，根路径返回 404。

根路径仅允许一个归属：第二次挂载将抛错，而非静默覆盖 —— 后者会使"页面上呈现的是
哪一份前端"无法判定。两个插件同时接管时，后加载者的 `setup` 抛错并按加载失败处理，
内核与另一份面板不受影响。

面板前端遵循 `/api` 契约（令牌仅经 `Authorization: Bearer` 传递，WebSocket
令牌经子协议传递），因此无须内核提供任何额外接口。

若只想向已有面板添加一枚组件，不必自己写一整份面板 —— 见[面板插件](panel-plugin.md)。

## 日志

`ctx.logger` 自动附带插件名，级别为 `trace` / `debug` / `info` / `warn` / `error` / `fatal`。
面板的日志页与 `logs/` 下的滚动文件为同一份输出。排障时应记录 `e.id`：
该标识贯穿一次事件处理的全过程。

## 生命周期与资源回收

`ctx` 上每个注册方法均返回 `Disposer`，内核为每个插件维护一份登记表，卸载时**逆序**执行。
因此常规情况下无须额外处理 —— 命令、中间件、cron、路由、`ctx.sql()` 打开的库与
`ctx.cache()` 创建的实例均自动回收。

仅有一种情况需要插件自行处理：**在 `ctx` 之外自行开启的资源**，如 socket、子进程、
第三方库的 watcher：

```ts
const ws = new WebSocket(url)
ctx.onDispose(() => ws.close())
```

长任务与网络请求应使用 `ctx.signal`：

```ts
// ctx.http 已绑定 ctx.signal，无须逐个请求再传一次
const res = await ctx.http.get(url)
while (!ctx.signal.aborted) { /* … */ }
```

`ctx.http` 自 0.2.0 起派生自 `ctx.signal`，**在途请求会随插件卸载被中止**（此前它们能在卸载后
继续跑完）。确有必须跑完的收尾请求时，放到 `app/stopping` 回调里做，而不是指望卸载后仍在途。

旧框架热重载后 watcher、cron、handler 全部悬空，原因即在于缺少这样一份登记表。

内核事件（`ctx.on`）：`app/ready` `app/stopping` `bot/online` `bot/offline`
`message` `notice` `request` `meta` `plugin/loaded` `plugin/unloaded` `plugin/error`
`config/changed` `pipeline/error`。
预热资源应使用 `app/ready`（此时账号方才开始连接），保存状态应使用 `app/stopping`。

## 测试

`@yunzai-ng/core/testing` 是插件作者唯一被允许 import 的内部子路径（分层门禁仅放行该路径
与 `core/package.json`）。无须启动真实内核即可测试命令：

```ts
import { createMockAdapter } from "@yunzai-ng/core/testing"

const mock = createMockAdapter()
app.runtime.adapters.register(mock.provider, "test-plugin")
await app.runtime.accounts.create("mock", { selfId: "10000" })
mock.driver.receivePrivate("#ping")
await mock.waitForSend()
expect(mock.texts).toEqual(["pong"])
```

`createMockAdapter(opts?)` 的 opts 含 `id` `platform` `caps` `failConnect` `callApi`，
返回值含 `provider` `drivers` `driver` `sent` `texts` `recalled` `calls`
`waitForSend(count?, timeoutMs?)` `last()` `reset()`。
另有 `fakeLogger` `recordingHooks` `fakeAppView` `fakeHttp` 用于更小粒度的单元测试。

## 注释规范

仓库采用统一口径，由 `eslint-plugin-jsdoc`（`publicOnly: true`）在 CI 强制：

- 每个文件开头四行块：**模块职责 / 依赖方向 / 生命周期 / 注意事项**。
- 每个导出符号一句话中文 TSDoc，并附 `@param` / `@returns` / `@throws`。
- 非常规做法必须说明**原因**，而非重复代码的行为。本仓库大量注释用于说明旧框架在此处
  存在的缺陷，此为刻意安排：若不记录，后续维护者将把它改回原样。

## 常见陷阱

| 现象 | 原因 |
|---|---|
| 插件未被加载 | 源码目录下启动时遗漏 `--plugins .\plugins`；或目录名以 `.` / `_` 开头；或 `yunzai.disabled` 为真 |
| `Unknown file extension ".ts"` | TypeScript 插件未编译。入口应指向 `dist/index.js` |
| `ERR_MODULE_NOT_FOUND: @yunzai-ng/core` | 框架包未链接至主目录，参见 `init` / `start` 的 warn |
| 修改了 `e.message` 但 `e.text` 未变 | 遗漏 `e.refresh()` |
| 命令被另一条更短的命令命中 | 前缀遮蔽，应为更具体的一条设置更小的 `priority` |
| 正则命令拖慢每条消息 | 首字符无法判定，落入未分桶列表。应改为固定前缀 |
| 热重载后仍有任务在运行 | 自行开启的资源未经 `ctx.onDispose` 登记 |
| 面板中不显示配置表单 | 未声明 `configSchema`；或已声明但插件加载失败（参见日志） |
| `setup` 中 `await` 慢速请求导致插件加载失败 | setup 有 30 秒超时，预热应移至 `app/ready` |








