# 任务与协作

定时任务、插件之间互相调用、HTTP 路由，以及资源该怎么收。

## 定时任务

```js
ctx.cron("0 0 8 * * *", async signal => {
  await 推送体力(signal)
}, { name: "体力推送", overlap: "skip", timeout: "5m" })

ctx.every("30m", async () => { … }, { immediate: true })
```

cron 收 5 段或 6 段（6 段含秒）。选项：

| 选项 | 说明 |
|---|---|
| `name` | 面板任务列表里的显示名 |
| `overlap` | 上一轮没跑完时怎么办，缺省 `"skip"`（跳过本轮） |
| `timeout` | 到时 abort 传进任务体的 `signal` |
| `immediate` | 注册时立刻先跑一次（仅 `every`） |
| `timezone` | 时区 |

**长任务要把 `signal` 透传下去**，否则 `timeout` 到了任务还在跑：

```js
ctx.cron("0 0 8 * * *", async signal => {
  const res = await ctx.http.get(url, { signal })
}, { timeout: "5m" })
```

任务注册即受内核托管，插件卸载时自动停。面板的任务列表就是这些注册，带 `nextRun`、`lastRun`、
`lastCost`、`running`、`skipped`。

## 插件间协作

**不要互相 import** —— 那样得知道对方装在哪个目录，且两份代码会被打包两次。用服务注册：

```js
// 提供方
export default definePlugin({
  name: "mhy-game",
  provides: ["mihoyo.api"],
  setup(ctx) {
    ctx.provide("mihoyo.api", {
      async note(uid) { … }
    })
  }
})
```

```js
// 使用方，三种取法
const api = ctx.inject("mihoyo.api")              // 没装时 undefined
const api = ctx.require("mihoyo.api")             // 没装时抛错（硬依赖）
const api = await ctx.waitFor("mihoyo.api", "10s")  // 等，超时返回 undefined
```

键名建议写成 `<插件域>.<能力>`。

配合 `dependencies` 表达强弱两种依赖：

| 写法 | 对方没装时 |
|---|---|
| 写进 `dependencies` | 本插件跳过加载，记一条 warn，内核照常启动 |
| 只用 `waitFor` / `inject` | 本插件照常活着，自己降级 |

## HTTP 路由

```js
ctx.route("GET", "/stat", async req => ({ ok: true, ip: req.ip }))
ctx.websocket("/feed", (conn, req) => {
  conn.onMessage(d => conn.send(d))
})
ctx.static("/ui", ctx.resource("web"))
```

三者都挂在 `/plugin/<插件名>` 之下，共用内核那一个 HTTP 服务器。

::: warning route 默认要面板令牌
`auth` 缺省为 `true`。只有适配器的 webhook 端点自带签名校验时才设 `auth: false` **并自己验签**，
按需用 `rawBody: true` 拿原始字节。`websocket` 的 `verify(req)` 返回 false 即拒绝握手。
:::

要拼对外地址（反向代理、内网穿透）读 `ctx.app.server.publicUrl`，**先检查 `enabled`** ——
使用者可以关掉内置服务器。

## 资源回收

`ctx` 上每个注册方法都返回一个 Disposer，内核给每个插件记一份登记表，卸载时**逆序**执行。
所以命令、中间件、cron、路由、`ctx.sql()` 开的库、`ctx.cache()` 建的实例，都不用自己收。

**只有一种情况要自己处理：在 `ctx` 之外自己开的资源。**

```js
const ws = new WebSocket(url)
ctx.onDispose(() => ws.close())
```

网络请求与长循环用 `ctx.signal`：

```js
const res = await ctx.http.get(url)      // ctx.http 已绑定 ctx.signal
while (!ctx.signal.aborted) { … }
```

::: warning 在途请求会随卸载被中止
`ctx.http` 派生自 `ctx.signal`，插件一卸载在途请求就断。确实必须跑完的收尾请求放到
`app/stopping` 回调里做，别指望卸载后还能跑完。
:::

## 内核事件

```js
ctx.on("app/ready", async () => { await 预热() })
```

| 事件 | 时机 |
|---|---|
| `app/ready` | 全部插件加载完，账号开始连接 |
| `app/stopping` | 准备停机，保存状态用 |
| `bot/online` / `bot/offline` | 账号上下线 |
| `message` / `notice` / `request` / `meta` | 四类事件进来 |
| `plugin/loaded` / `plugin/unloaded` / `plugin/error` | 插件生命周期 |
| `config/changed` | 配置变了 |
| `pipeline/error` | 管线出错 |
| `command/done` | 一条消息的命令匹配结束 |
| `message/sent` | 一条消息已发出（含主动推送） |
| `render/done` | 一次渲染结束 |

**预热放 `app/ready`，别放 `setup`** —— `setup` 有 30 秒超时。保存状态放 `app/stopping`。

## 日志

```js
ctx.logger.info("已加载 %d 条数据", n)
```

`ctx.logger` 自动带插件名，级别 `trace` / `debug` / `info` / `warn` / `error` / `fatal`。
面板的日志页与 `logs/` 下的滚动文件是同一份输出。

**排障时记 `e.id`** —— 这个标识贯穿一次事件处理的全过程，能把散在各处的日志串起来。

## 下一步

- [测试与发布](publish.md) —— 怎么测，怎么让别人装上
- [插件市场](../market.md) —— 索引格式与自建索引
