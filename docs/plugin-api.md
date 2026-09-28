# 插件开发

插件能做的一切都由 `ctx` 提供。没有全局变量，也没有 `require("../../lib/...")` 这种反向引用 ——
内核确切知道每个插件占了哪些资源，卸载时全部回收。

## 五分钟跑通一个

```powershell
yzng plugin new hello
yzng dev
```

然后向机器人发 `#ping`。生成的 `plugins/hello/index.js` 长这样：

```js
import { definePlugin, s } from "@yunzai-ng/core"

export default definePlugin({
  name: "hello",
  version: "0.1.0",

  configSchema: s.object({
    greeting: s.string().default("pong").title("回复内容")
  }),

  setup(ctx) {
    ctx.command("#ping")
      .desc("检测插件是否正常运行")
      .action(async e => {
        await e.reply(ctx.config.get().greeting)
      })
  }
})
```

改完代码在面板的插件页点重载，不用重启进程。

声明了 `configSchema` 就自动有了 `config/hello.yaml` 和面板里的一张表单 ——
不用自己写文件读写，也不用为面板写任何前端代码。

## 最小形态

不想要脚手架的话，一个文件就够。放 `<home>/plugins/我的小功能.js`：

```js
import { definePlugin } from "@yunzai-ng/core"

export default definePlugin({
  name: "hello",
  setup(ctx) {
    ctx.command("#你好").action(async e => { await e.reply("你好") })
  }
})
```

几十行的小功能不必建目录和 `package.json`。

## 分册

按顺序读，或直接跳到要用的那一节：

| | |
|---|---|
| [发消息](plugin/message.md) | 文本、图片、@、引用、转发、渲染出图、主动推送 |
| [命令与事件](plugin/command.md) | 命令怎么声明、事件对象上有什么、中间件、追问 |
| [配置与存储](plugin/storage.md) | schema 驱动的配置、KV、SQLite、缓存 |
| [任务与协作](plugin/service.md) | 定时任务、插件间服务、HTTP 路由、资源回收、维护面 |
| [测试与发布](plugin/publish.md) | Mock 适配器、TypeScript、发到插件市场 |

## 目录与入口

内核找入口的顺序：`package.json` 的 `yunzai.entry` → `exports["."]` → `module` → `main`，
然后依次回落 `dist/index.js` → `index.js` → `index.mjs` → `lib/index.js`。

```
my-plugin/
├─ package.json      main / yunzai.entry
├─ src/              TypeScript 源码
├─ dist/             编译产物（入口在此）
├─ templates/        ctx.render 的模板根
└─ resources/        图片、字体等静态资源，模板内以 res 取用
```

TypeScript 插件必须编译到 `dist/index.js` 并声明 `"main": "dist/index.js"`。`src/index.ts`
只在源码模式（vitest / tsx）下算入口，否则会得到 `Unknown file extension ".ts"`。

以 `.` 或 `_` 开头的目录会被跳过（`_` 是「作者临时禁用」的约定）；`package.json` 里写
`"yunzai": { "disabled": true }` 也跳过。

同名插件只留先扫到的那份，扫描顺序是 `--plugins` 指定的目录 → `<home>/plugins` → 发行版预置目录。
所以把预置插件复制一份到用户插件目录改，就能覆盖原插件而不动发行版内容。

## definePlugin

```ts
export default definePlugin({
  name: "mhy-game",          // 必填
  version: "1.0.0",
  description: "原神 / 星穹铁道 / 绝区零",
  author: "…",
  homepage: "…",
  dependencies: ["renderer-puppeteer"],
  provides: ["mihoyo.api"],
  priority: 100,             // 小者先加载
  configSchema: s.object({ … }),
  setup(ctx) { … }
})
```

`name` 要匹配 `/^[a-z][a-z0-9._-]*$/i`，它同时是配置文件名、KV 命名空间前缀、URL 前缀和日志 scope。
名字非法在 `import` 那一刻就抛错。

`dependencies` 只影响加载顺序与存活判定：**依赖缺失只让本插件跳过并记一条 warn，内核照常启动。**

必须用 `definePlugin` 而不是手写对象字面量 —— 经它包装之后 `ctx.config.get().cookie` 才有类型，
字段名写错会是编译错误。

::: warning setup 有 30 秒超时
超时按加载失败处理，所以**不要在 setup 里跑慢速网络请求**。要预热就注册
`ctx.on("app/ready", …)`。返回值可以是一个清理函数，等价于在里面调 `ctx.onDispose`。
:::

## ctx 速查

只读属性：

| | |
|---|---|
| `ctx.name` `ctx.version` `ctx.root` | 插件自身信息，`root` 是绝对路径 |
| `ctx.dataDir` | 本插件专属数据目录，已创建 |
| `ctx.logger` | 自动带插件名的 child logger |
| `ctx.kv` | 已绑定 `plugin:<name>:` 前缀的 KV |
| `ctx.config` | 配置句柄，没声明 schema 时 `get()` 返回空对象 |
| `ctx.app` | 应用只读视图（版本、paths、platform、adapters、bots、accounts、plugins、policy、server、`usage()`、[`maintenance`](plugin/service.md#维护面)） |
| `ctx.http` | 带全局代理、超时与重试缺省值的 HTTP 客户端，**已绑定 `ctx.signal`** |
| `ctx.signal` | 插件卸载时 abort，可直接传给 `fetch` |

注册类方法**全部返回一个清理函数**：

| 方法 | 用途 | 详见 |
|---|---|---|
| `command(pattern, opts?)` | 声明命令 | [命令与事件](plugin/command.md) |
| `middleware(fn, opts?)` | Koa 语义中间件 | [命令与事件](plugin/command.md) |
| `on(event, handler)` | 监听内核事件 | [命令与事件](plugin/command.md) |
| `cron` / `every` | 定时任务 | [任务与协作](plugin/service.md) |
| `provide` / `inject` / `require` / `waitFor` | 插件间协作 | [任务与协作](plugin/service.md) |
| `route` / `websocket` / `static` | 挂到共享 HTTP 服务器 | [任务与协作](plugin/service.md) |
| `panel(dir)` | 接管站点根路径 | [任务与协作](plugin/service.md) |
| `registerAdapter` / `registerRenderer` / `registerKvDriver` | 提供内核能力实现 | [适配器开发](adapter.md) |

其余：`render()`、`sql()`、`cache()`、`resource()`、`onDispose()`、`pickBot()`。

`ctx.app` 是**只读**视图，改全局状态要走各自的具名 API（如 `ctx.config.patch`）。

## 常见陷阱

| 现象 | 原因 |
|---|---|
| 插件没被加载 | 源码目录下启动时漏了 `--plugins .\plugins`；或目录名以 `.` / `_` 开头；或 `yunzai.disabled` 为真 |
| `Unknown file extension ".ts"` | TypeScript 插件没编译，入口要指向 `dist/index.js` |
| `ERR_MODULE_NOT_FOUND: @yunzai-ng/core` | 框架包没链接到主目录，看 `init` / `start` 的 warn |
| 改了 `e.message` 但 `e.text` 没变 | 漏了 `e.refresh()` |
| 命令被另一条更短的命令命中 | 前缀遮蔽，给更具体的那条设更小的 `priority` |
| 正则命令拖慢每条消息 | 首字符判不出来，落进未分桶列表，应改成固定前缀 |
| 热重载后还有任务在跑 | 自己开的资源没经 `ctx.onDispose` 登记 |
| 面板里不显示配置表单 | 没声明 `configSchema`；或声明了但插件加载失败（看日志） |
| `setup` 里 `await` 慢请求导致加载失败 | setup 有 30 秒超时，预热移到 `app/ready` |
