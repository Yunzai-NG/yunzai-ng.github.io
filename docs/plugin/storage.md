# 配置与存储

配置 schema 一份声明换三样东西，数据按形态选 KV 还是 SQLite。

## 配置 schema

声明 `configSchema` 就自动得到：`config/<插件名>.yaml`（带中文注释）、面板里的一张表单、写入时的校验。
不必自己写文件读写，也不必为面板写任何前端。

```js
import { definePlugin, s } from "@yunzai-ng/core"

export default definePlugin({
  name: "mhy-game",
  configSchema: s.object({
    cookie: s.password().title("米游社 Cookie").desc("从浏览器 F12 复制"),
    push: s.object({
      enable: s.boolean().default(false).title("开启体力推送"),
      threshold: s.number().int().min(0).max(200).default(150)
        .title("阈值").showWhen({ enable: true })
    }).title("推送").group("推送")
  }),
  setup(ctx) { … }
})
```

### 类型

```
s.string  number  boolean  literal  enum  select  array  object  record  unknown
s.duration  cron  port  password  text  tags  ids  dir  file
```

后九个是**语义类型**：决定面板用哪种控件。`duration` 另收 `"5s"`、`"3m"` 这类写法。

### 修饰

```
.title  .desc  .group  .order  .widget  .placeholder  .default  .optional
.secret  .readonly  .showWhen  .check  .min  .max  .pattern  .int  .step
.strict  .single
```

`s.password()` 与 `.secret()` 标记的字段在面板和日志里都不回显。

### 读写

```js
const cfg = ctx.config.get()                         // 只读快照
await ctx.config.patch({ push: { enable: true } })   // 深合并并落盘

ctx.config.onChange(({ paths, source }) => {
  ctx.logger.info(`配置变了：${paths}`)
})
```

`get()` 返回的是只读快照，只在变更后被替换成新对象。`patch` 校验失败时抛错且原值不变。
`onChange` 带**变更路径**，可以只失效受影响的那部分，不必整体重算。

::: tip 缺省值只作用于新生成的配置
改了 schema 的 `default` 之后，已经落盘的 `config/<插件名>.yaml` 里那份值仍然优先。
要让老实例用上新缺省，得自己改那个文件或删掉对应行。
:::

## KV 存储

`ctx.kv` 已经绑好 `plugin:<插件名>:` 前缀，不用自己拼键名：

```js
await ctx.kv.set("uid:" + e.sender.uid, uid, { ttl: "7d" })
const uid = await ctx.kv.getOr("uid:" + e.sender.uid, "")

const n = await ctx.kv.incr("today:" + 日期, 1, { ttl: "1d" })   // 原子自增

for await (const [k, v] of ctx.kv.entries("uid:")) { … }

const sub = ctx.kv.sub("gacha")     // 派生子命名空间
```

另有 `get` `del` `has` `ttl` `keys` `clear`。

**计数与冷却用 `incr`**，别读出来加一再写回 —— 那不是原子的。

默认驱动是内嵌 LevelDB。换成 Redis 只需装一个实现 `KvDriver` 的插件，用 KV 的代码一行不用改。

## SQLite

多行且要索引的数据（抽卡记录、面板快照）用 SQLite：

```js
const db = await ctx.sql()          // 本插件专属库，随插件卸载自动关闭

await db.migrate([
  { version: 1, name: "init", async up(tx) {
    await tx.run("CREATE TABLE gacha (uid TEXT, time INTEGER, item TEXT)")
  } }
])

const rows = await db.all("SELECT * FROM gacha WHERE uid = ?", [uid])

await db.transaction(async tx => {
  // 抛错即回滚
})
```

`migrate` 按 version 记进度，重复调用是幂等的。这里刻意不带 ORM。

## 进程内缓存

`ctx.cache` **必须声明上限**：

```js
const cache = ctx.cache({ max: 500, ttl: "10m" })
```

省略 `ttl` 表示只受 `max` 约束，适合预编译 SQL 这类不会失效的东西；**会变的数据必须给 `ttl`**。
`ctx.cache` 创建的实例随插件卸载自动清空。

## 数据目录

`ctx.dataDir` 是本插件专属的数据目录，已经建好。要拼插件内的资源路径（模板、图片、字体）用
`ctx.resource()`：

```js
const 字体 = ctx.resource("resources", "fonts", "hywh.ttf")
```

## 怎么选

| 形态 | 用什么 |
|---|---|
| 使用者要能改的设置 | `configSchema` |
| 键值对、计数、冷却、缓存标记 | `ctx.kv` |
| 多行、要查询与排序 | `ctx.sql()` |
| 进程内的临时结果 | `ctx.cache()` |
| 图片、字体、模板等文件 | `ctx.resource()` 读，`ctx.dataDir` 写 |

## 下一步

- [任务与协作](service.md) —— 插件之间怎么互相用
- [配置与面板](../config.md) —— 内核自己的配置项
