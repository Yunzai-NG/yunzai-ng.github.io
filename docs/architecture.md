# 框架说明

## 重写的原因

Miao-Yunzai v3.1.3 所称的"底层"并不构成底层。以下六项均可在旧代码中指出具体位置：

| # | 问题 | 旧代码位置 |
|---|---|---|
| 1 | **内核反向依赖插件**，缺少插件即无法启动 | `lib/plugins/runtime.js:9-18` 直接 `import ../../plugins/genshin/model/...` 与 `#miao`；`lib/plugins/plugin.js:1` `import { Common } from "#miao"`；`lib/renderer/loader.js:6` `import { Data } from "#miao"` |
| 2 | **登录逻辑固化于内核** | `lib/bot.js` 中 `class Yunzai extends Client`（icqq）。更换协议端只能借助 `skip_login` 并覆写 `global.Bot` |
| 3 | **游戏逻辑写入消息分发器** | `lib/plugins/loader.js:53-56` 的 `srReg` 与 `zzzReg`，并在 `deal()` 中注入 `e.game`、`e.isSr`、`e.isGs` |
| 4 | **全局变量污染** | `global.Bot`、`redis`、`logger`、`plugin`、`segment`、`Renderer`：插件之间缺少边界，亦无法卸载 |
| 5 | **硬依赖 Redis** | 计数、冷却、CK 池、puppeteer wsEndpoint 全部存于 Redis，未部署 Redis 即无法启动 |
| 6 | **内存与热重载缺陷** | 每条消息执行 `new i.class(e)` 实例化全部插件；`regCache` 与 `Renderer.html` 无上限；适配器将整群成员预载至 `Bot[id].gml`；媒体一律经 base64 往返；热重载不回收 watcher、cron 与 handler |

以上并非可经补丁消除的缺陷，而是分层方向本身相反：**插件被内核依赖**，因而内核无法演进。
Yunzai NG 将该方向纠正，代价是与旧插件干净断裂（详见[迁移](migration.md)）。

## 分层

```
        ┌──────────────────────────────────────────────┐
插件层  │ adapter-napcat  renderer-puppeteer           │
        │ mhy-game-plugin  第三方插件  自有插件         │
        └───────────────┬──────────────────────────────┘
                        │ 只能看见 ctx（PluginContext）
        ┌───────────────▼──────────────────────────────┐
内核层  │ @yunzai-ng/core                              │
        │ 生命周期 · 插件宿主 · 管线 · 存储 · 配置       │
        │ 日志 · 服务器 · 调度 · 渲染注册表 · 平台差异   │
        └───────────────┬──────────────────────────────┘
        ┌───────────────▼──────────────────────────────┐
类型层  │ @yunzai-ng/types（纯类型，零运行时依赖）      │
        └──────────────────────────────────────────────┘
```

依赖只允许向下。`scripts/check-layering.mjs`（`pnpm check:layering`）将该约束固化为 CI 断言，共四条规则：

| 目录 | 允许依赖的工作区包 | 备注 |
|---|---|---|
| `packages/types` | 无 | 类型包必须是叶子 |
| `packages/core` | `types` | **不允许出现任何 `plugins/*`** —— 本次重写的核心不变量 |
| `packages/jsx` | `types` | 模板层不该能碰到内核 |
| `packages/cli` | `types` `core` | |

「插件只许经公开入口引用内核」这一条不在此处：官方插件均已独立成库，本仓库内不再有
`plugins/` 目录，该约束移交各插件仓库的 eslint `no-restricted-imports` 等价实现
（`@yunzai-ng/core/<内部路径>` 一律拒绝，仅放行 `core/testing`）。但上表各条仍保留对
`plugins/*` 的拒绝：那拦的是**内核反向引用插件**，即本次重写要消灭的方向。

脚本先移除注释再扫描模块说明符。该步骤是必需的：本仓库的中文注释中大量引用
`require("../../lib/...")` 一类被批判的旧写法作为反例，若直接以正则扫描全文，将把注释中的
反例判定为真实依赖。门禁一旦出现误报，其后便不再具备可信度。

插件之间不经由 import 协作（那样 A 必须知道 B 安装在哪个目录），而应使用
`ctx.provide` / `ctx.inject`，见[插件开发](plugin-api.md#插件间的协作)。

## 仓库结构

框架仓库仅包含内核及其配套工具。**官方插件与本文档各自独立成库**，
经插件市场或 `git clone` 获取，不随框架仓库分发。

```
yunzai-ng/
├─ packages/
│  ├─ types/      @yunzai-ng/types   纯类型：事件、消息段、适配器、存储、插件契约
│  ├─ core/       @yunzai-ng/core    内核
│  ├─ cli/        @yunzai-ng/cli     yzng init / start / dev / doctor / plugin new
│  └─ jsx/        @yunzai-ng/jsx     渲染模板的 JSX 运行时
└─ scripts/
   ├─ check-layering.mjs   分层门禁
   ├─ smoke-firstrun.mjs   首次启动门禁
   └─ bench-memory.mjs     内存与吞吐基线
```

独立仓库：

| 仓库 | 内容 |
|---|---|
| [`webui-plugin`](https://github.com/Yunzai-NG/webui-plugin) | 面板（八个页面与 schema 驱动的配置表单） |
| [`adapter-napcat`](https://github.com/Yunzai-NG/adapter-napcat) | NapCat OneBot v11 适配器（四种网络模式） |
| [`renderer-puppeteer`](https://github.com/Yunzai-NG/renderer-puppeteer) | puppeteer-core 与 art-template 渲染器 |
| [`mhy-game-plugin`](https://github.com/Yunzai-NG/mhy-game-plugin) | 原神 / 星穹铁道 / 绝区零 |
| [`hardware-plugin`](https://github.com/Yunzai-NG/hardware-plugin) | 硬件信息面板插件，兼作[面板插件](panel-plugin.md)的示例 |
| [`plugin-index`](https://github.com/Yunzai-NG/plugin-index) | 插件市场索引 |
| `yunzai-ng.github.io` | 本文档 |

## 内核模块

`packages/core/src` 下每个目录承担一件事，相互之间仅通过显式参数通信，不存在单例与全局：

| 模块 | 职责 | 关键点 |
|---|---|---|
| `kernel/` | 生命周期 `create → load → start → stop` | 分阶段启动；任何插件抛错仅影响其自身 |
| `plugin/` | 发现、排序、加载、卸载、热重载 | 每插件一份 DisposalRegistry；`ctx.provide` / `inject` 取代旧 `Runtime` 的 getter 集合 |
| `pipeline/` | 中间件、命令路由与冷却 | 路由按首字符分桶，不再逐条消息线性执行全部正则 |
| `adapter/` | 账号记录、驱动生命周期、交互式登录会话 | 内核不知晓 QQ 的存在，仅知晓某插件能将一份账号配置转为可收发消息的驱动 |
| `message/` | 消息段模型、长文本切分、发送目标 | 段模型与平台解耦，编解码位于适配器内 |
| `store/` | KV（level / json / memory）与 SQLite | Redis 降级为可选驱动插件，接口一致即可替换 |
| `config/` | Schema 生成 YAML、表单与校验 | 一份声明驱动三处，不存在"修改校验而遗漏表单"的情形 |
| `logger/` | pino 风格分级与滚动 | 每插件一份 child logger，自动附带插件名 |
| `server/` | 共享 HTTP 服务器 | 同时承载面板、`ctx.route` 与适配器 webhook；令牌经请求头传递 |
| `scheduler/` | cron 与固定间隔任务 | 重入保护（`overlap: "skip"`），单次执行超时后 abort |
| `render/` | 渲染器注册表 | 按可用性选择，未探测到 Chromium 时回落而非报错 |
| `platform/` | 目录布局与系统探测 | 八个目录在启动时确定为绝对路径，不再依赖 `process.cwd()` |
| `http/` | 带代理与重试的 HTTP 客户端 | 插件使用 `ctx.http`，代理与超时缺省值统一；派生自 `ctx.signal`，在途请求随插件卸载中止 |
| `util/` | LRU、队列、时长解析、深比较等 | 全部有界；`lru.ts` 即"缓存必须声明上限"的实现处 |
| `testing/` | Mock 适配器与假上下文 | 插件作者无须启动真实内核即可测试命令 |

## 启动顺序

`createApp()` 按九步装配，任何一步的失败均有明确的降级行为，而非导致整体无法启动：

```
1 日志       ← 必须最早：装配期的错误亦需有处可记
2 配置       ← config/yunzai.yaml，随即按配置调整日志级别
3 存储       ← KV（level / json / memory）与 SQLite，无法装载时降级
4 网络       ← HTTP 客户端（代理、超时、重试）
5 注册表     ← 适配器 / Bot / 渲染器 / 命令 / 任务，以及事件总线
6 子系统接缝  ← 尚不可填充者标记为 unavailable，而非留 undefined
7 插件宿主
8 运行期     ← 管线、调度器、账号运行时
9 面板       ← 未找到前端产物时仅提供 /api
```

`app.start()` 之后的顺序：启用配置热加载 → 确定面板令牌 → 输出安全警告 → **加载插件** →
开始监听端口 → 广播 `app/ready`（账号在该事件中方才开始连接）。

监听时机刻意置于"插件加载完成"与"`app/ready`"之间：过早将出现面板部分可用的窗口期，
过晚则反向 WebSocket 适配器会在端点尚未就绪时即等待对端接入。插件加载失败仅记录 warn ——
**单个插件的正则书写错误不应导致整个机器人无法启动**，该行为是旧框架最常被反馈的问题。

停机为终态且幂等：`app/stopping` → 卸载插件（逆加载顺序）→ 关闭服务器 → 逆序执行运行期
Disposer → 事件总线 → SQL → KV → HTTP 连接池 → 配置监听 → 日志。每一步出错仅记录日志并继续，
停机路径上单个资源无法关闭绝不应导致后续资源全部泄漏。

## 消息的处理流程

`pipeline/dispatch.ts` 是**唯一**决定一条消息将发生何种处理的位置，其顺序即语义：

```
适配器 host.submit(event)
   │
   ├─ 1 维护模式 / 忽略自身   ← 在构造事件对象之前判定，省去全部派生计算
   ├─ 2 中间件（Koa 语义）    ← 可改写 text、注入字段，不调用 next 即阻断
   ├─ 3 e.prompt() 等待者     ← 位于中间件之后、路由之前：用户正在应答时不应同时触发命令
   ├─ 4 命令路由             ← 首字符分桶与零成本静态过滤，纯查询
   ├─ 5 冷却                 ← 命中之后才计入，主人豁免，处理函数抛错时退还
   └─ 6 处理函数             ← 返回 false 时继续尝试下一条；block !== false 时命中即止
```

`submit()` **永不抛出**。适配器在 socket 回调中调用它，一个未捕获的 rejection 将成为
`unhandledRejection` 并导致进程崩溃 —— 旧框架即存在该缺陷（`loader.deal` 抛错直接冒至 icqq 的
事件回调）。出错时经 `pipeline/error` 事件上报。

## 资源回收：Disposer 契约

`ctx` 上每个注册方法均返回 `Disposer`，内核为每个插件维护一份登记表，卸载时逆序执行。
凡插件自行开启且内核不可见的资源（socket、子进程、第三方库的 watcher），均必须经
`ctx.onDispose(...)` 登记。旧框架热重载后 watcher、cron 与 handler 全部悬空，
原因即在于缺少这样一份登记表。

配套机制为 `ctx.signal`：插件卸载时 abort，可直接传给 `fetch`，亦可在长循环中判断。

## 内存约束

以下各项已固化于实现中：

| 约束 | 旧框架的对应问题 |
|---|---|
| 联系人缓存必须采用 LRU 与 TTL 惰性加载，由 `host.createCache()` 统一提供 | 适配器将整群成员常驻 `Bot[id].gml`，从不淘汰 |
| 模板编译缓存有界，键含文件 mtime | `Renderer.html = {}` 无上限 |
| 命令处理不再对每条消息实例化全部插件类 | 每条消息 `new i.class(e)` 实例化所有插件 |
| 媒体优先使用 `file://`、URL 或直传 Buffer，仅在必要时 base64 | 全链路 base64 往返 |
| 定时任务默认 `overlap: "skip"` 并设单次超时 | 推送任务堆积 |
| 计数与冷却经 store 抽象 | 硬绑 `Yz:count:*` 等 Redis 键 |
| 可配置 `message.concurrency` 上限（低内存设备设为 2~4） | 无并发控制，多张图同时渲染将耗尽内存 |

实测数据见[性能基线](perf.md)。

## 运行时目录

八个目录在启动时一次性解析为绝对路径，其余模块仅允许经 `app.paths` 获取 ——
旧框架多处直接书写 `process.cwd()`（如 puppeteer 的 `${process.cwd()}/temp`），一旦以服务、
开机自启或 pm2 自其他位置启动，工作目录即非项目目录，相关逻辑全部失效。

```
<home>/
├─ config/    yunzai.yaml 与每个插件各一份
├─ data/      KV、SQLite、账号记录
├─ logs/      滚动日志
├─ temp/      渲染中间产物，按保留期清理
├─ plugins/   用户插件
└─ cache/
```

`<home>` 的优先级：`--home` 参数 > `YZNG_HOME` 环境变量 > **便携模式**（安装目录下存在
`.portable` 文件）> **当前工作目录**。默认落在当前目录：解压或克隆到一个文件夹、在其中
`yzng init`，数据就在眼前，拷走整个文件夹即完成迁移 —— 便携模式想达到的效果成了默认行为。

代价是解析主目录必须读 `process.cwd()`，而以 Windows 服务、开机自启或 pm2 启动时工作目录
并非项目目录，那些场景须显式给出 `YZNG_HOME`。

0.1.1 及更早的默认位置是系统目录（Windows 的 `%LOCALAPPDATA%\YunzaiNG`、Termux 的
`~/.yunzai-ng`）。**不为其保留静默回落** —— 回落会使「默认在当前目录」在任何装过旧版的机器上
都不成立。改由 `legacyInstance()` 把旧实例报出来，`init` / `start` / `doctor` 显式提示，
是否搬家交给使用者决定：两个目录都有内容时无从判断该以谁为准，猜错即覆盖掉正在用的那份。

## 两个框架的对应关系

| 事项 | Miao-Yunzai | Yunzai NG |
|---|---|---|
| 发送消息 | `global.Bot.pickGroup(id).sendMsg()` | `e.reply(...)`；主动推送使用 `ctx.pickBot()?.sendMessage({ scene: "group", gid }, ...)` |
| 消息段 | `global.segment.image(x)` | `import { seg } from "@yunzai-ng/core"`，或直接向 `e.reply` 传入字符串 |
| 声明命令 | `class extends plugin` 与 `rule[]` | `ctx.command("#体力").action(fn)` |
| 定时任务 | `this.task = { cron, fnc }` | `ctx.cron(expr, fn)`，返回 Disposer |
| 存储数据 | `global.redis.set("Yz:xx", v)` | `ctx.kv.set("xx", v)`，已按插件隔离，无须前缀 |
| 渲染出图 | `puppeteer.screenshot(name, {tplFile, ...})` 并自行计算 `../` | `ctx.render("note", data)` |
| 读取配置 | `Cfg.getConfig("xx")` 并自行维护 yaml | `configSchema` 与 `ctx.config.get()`，面板据此生成表单 |
| 使用其他插件的能力 | `import { MysInfo } from "../../genshin/model"` | `ctx.inject("mihoyo.api")` |
| 接入新协议 | 修改 `lib/bot.js` 或覆写 `global.Bot` | 编写插件并调用 `ctx.registerAdapter(provider)` |
| 更换渲染器 | 修改 `lib/renderer/` | 编写插件并调用 `ctx.registerRenderer(provider)` |
| 使用 Redis | 内核硬依赖 | 安装 KV 驱动插件并调用 `ctx.registerKvDriver(driver)` |

## 分层约束的验证方式

```powershell
pnpm run verify
```

依次执行：`build` → `check:layering` → `check:firstrun` → `typecheck:test` → `lint` → `test`。
其中 `check:layering` 即上述五条规则；该项失败即表明分层已被破坏，**不应**修改门禁以迁就代码。

