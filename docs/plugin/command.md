# 命令与事件

怎么让一条消息进到你的代码里。

## 声明一条命令

```js
ctx.command("#你好").action(async e => {
  await e.reply("你好")
})
```

字符串是**前缀匹配** —— `#你好啊` 也会命中。触发词之后剩下的文本在 `e.command.rest`（已去首尾空白）：

```js
ctx.command("#查询").action(async e => {
  const uid = e.command.rest      // "#查询 10001" → "10001"
  if (uid === "") return await e.reply("请给出 UID")
  await e.reply(`查 ${uid}`)
})
```

正则则对 `e.text` 整体 `exec`，命名捕获进 `e.command.groups`，数字捕获进 `captures`：

```js
ctx.command(/^#(?<n>\d+)层深渊$/).action(async e => {
  await e.reply(`第 ${e.command.groups.n} 层`)
})
```

未参与匹配的分组统一是空串，不必到处写 `?? ""`。

## 选项

第二参给选项，或用链式方法：

```js
ctx.command("#体力", { alias: ["#树脂"], desc: "查询实时便笺", cooldown: "5s" })
  .action(async e => { … })

ctx.command("#踢人").admin().cooldown("3s").action(async e => { … })
```

| 选项 | 作用 |
|---|---|
| `alias` | 别名，数组 |
| `desc` / `usage` / `group` | 帮助文案与分组 |
| `scene` | 限定场景：`private` / `group` / `guild` |
| `master` | 仅主人可用 |
| `admin` | 仅群管理可用（**主人不受此限**，否则主人在自己不是管理的群里用不了管理命令） |
| `cooldown` | 冷却，如 `"5s"` |
| `cooldownScope` | 冷却范围：`user` / `group` / `groupUser` / `global` |
| `cooldownTip` | 冷却中的提示语 |
| `priority` | 缺省 100，**小者优先** |
| `atMe` | 仅在 @ 机器人时触发 |
| `anywhere` | 触发词不必在开头 |
| `block` | 命中后是否阻断后续候选，缺省阻断 |
| `hidden` | 不出现在帮助里 |

自身消息由适配器决定要不要投给内核（NapCat 是账号配置项 `ignoreSelf`，缺省不投），
路由这一层不再过滤，故命令选项里没有对应开关。

链式方法覆盖常用项：`.action() .alias() .desc() .scene() .master() .admin() .cooldown()
.priority() .dispose()`。

## 冷却与放行

- 冷却**在命中之后才计入**，主人豁免
- 处理函数抛错或返回 `false` 时**退还**冷却
- 返回 `false` 表示「这条我不处理」，内核继续试下一个候选

```js
ctx.command("#签到").action(async e => {
  if (e.isPrivate) return false      // 私聊不接，交给别的候选
  await e.reply("签到成功")
})
```

## 前缀遮蔽

`#体力` 与 `#体力上限` 同时存在时，前者是后者的前缀，**两条都会命中**，顺序按
`(priority, 注册先后)`。要让更具体的先来，给它更小的 `priority`：

```js
ctx.command("#体力上限", { priority: 50 }).action(…)
ctx.command("#体力").action(…)
```

或者在短的那条里判断 `e.command.rest` 后 `return false`。

## 正则命令会拖慢每条消息

命令按模式**首字符分桶**：一条 `#体力` 只会尝试 `#` 桶里的候选，所以命令涨到几百条也不会变慢。

但下面这些**判不出首字符**，会落进未分桶列表，每条消息都要试一遍：

- `/^\d+/` 这类数字开头的正则
- 带 `i` 或 `m` 标志、且以字母开头的模式
- `anywhere: true` 的字符串

凡能写成固定前缀的，别写成这几种。

## 中间件

Koa 语义，`priority` 小者在外层，不调 `next()` 即阻断后续中间件与命令匹配：

```js
ctx.middleware(async (e, next) => {
  if (e.kind !== "message") return next()

  if (e.text.startsWith("*")) {
    e.state["mhy:game"] = "sr"
    e.message = [seg.text(`#星铁${e.text.slice(1)}`), ...e.message.slice(1)]
    e.refresh()                 // 改了 message 必须刷新派生字段
  }

  await next()
}, { kind: "message", priority: 10 })
```

`kind` 限定事件大类，缺省全部。

`e.state` 用来向下游传值，**键要带插件前缀**（如 `"mhy:uid"`）避免撞车；它随事件回收，不会泄漏。

## 内核事件

```js
ctx.on("bot/online", bot => ctx.logger.info(`${bot.selfId} 上线`))
```

| 事件 | 时机 |
|---|---|
| `app/ready` | 全部插件加载完、账号开始连接 —— **预热放这里** |
| `app/stopping` | 停机前 —— 存状态、发收尾请求放这里 |
| `bot/online` / `bot/offline` | 账号上下线 |
| `message` / `notice` / `request` / `meta` | 四类事件 |
| `plugin/loaded` / `plugin/unloaded` / `plugin/error` | 插件生命周期 |
| `config/changed` | 配置变更 |
| `pipeline/error` | 管线内未捕获的错误 |

::: warning setup 里别塞慢请求
`setup` 有 30 秒超时，超时按加载失败处理。要预热就注册 `ctx.on("app/ready", …)`。
:::

## 给事件加字段

不要改内核，用 `EventExtensions`：

```ts
declare module "@yunzai-ng/types" {
  interface EventExtensions { game?: "gs" | "sr" | "zzz" }
}
```

声明之后 `e.game` 就有类型了。

## 定时任务

```js
ctx.cron("0 0 8 * * *", async signal => { await 推送(signal) }, {
  name: "体力推送", overlap: "skip", timeout: "5m"
})

ctx.every("30m", async () => { … }, { immediate: true })
```

cron 收 5 段或 6 段（带秒）。选项：

| 选项 | 说明 |
|---|---|
| `name` | 面板任务列表里的显示名 |
| `overlap` | 缺省 `"skip"`，上一轮没跑完就跳过本轮 |
| `timeout` | 到时 abort 传给任务体的 `signal`，**长任务要把它透传给 fetch** |
| `immediate` | 注册时立刻跑一次（仅 `every`） |
| `timezone` | 时区 |

面板的任务列表就来自这些注册，含 `nextRun`、`lastRun`、`lastCost`、`running`、`skipped`。

## 下一步

- [发消息](message.md) —— `action` 里怎么回
- [配置与存储](storage.md) —— 配置 schema、KV 与 SQLite
