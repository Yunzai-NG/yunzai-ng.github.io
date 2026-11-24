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

KV 落在存储目录的 `kv.db` 一个 SQLite 文件里，电脑与安卓通用。**存储只由内核负责**，插件不能注册或替换驱动：
账号凭据与全部插件的数据同在一个库里，交给插件提供的驱动就等于把这些数据都交给它。

### 旧实例升级

停掉所有使用同一存储目录的实例，再启动新版。没有 `kv.db` 时，内核会迁移旧 `kv.json` 或 LevelDB 的 `kv/`，成功后将原件改名保留。JSON 迁移使用进程锁；异常退出后锁会自动释放，不要手动删除 `.kv-json-migration.lock`。

若两种旧格式并存，启动和 `yzng data export` 都会停止，不按修改时间猜哪份有效。先备份两份数据，确认实际使用的来源，将另一份移出存储目录后再重试。已有 `kv.db` 时仍以它为准。

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

同一事务里用 `Promise.all` 提交的嵌套事务按提交顺序执行。内层抛错时只撤销该层；外层接住错误后可以继续，未接住则一起回滚。`tx` 只在对应回调里有效，不能留到回调结束后再写。

`migrate` 按 version 记进度，重复调用是幂等的。这里刻意不带 ORM。

## 临时文件

`ctx.temp` 把文本、`Uint8Array`（含 `Buffer`）或 `{ url }` 写入实例的 `temp/plugins/<插件名>/`。字符串总是文本；`{ url }` 走插件的 HTTP 客户端，流式下载。不要把未经校验的用户输入当下载地址。

```js
const file = await ctx.temp.file(html, ".html")
try {
  await renderFile(file.path)
} finally {
  await file.remove()
}

const path = await ctx.temp.cached("map:v2", { url }, { ext: ".png", ttl: "5m" })
```

`file()` 每次返回独占文件；`cached()` 返回共享的只读绝对路径，不要修改或手动删除。键只在本插件实例内有效；内容、版本或使用者不同，就要换键。同键并发只写一次，从写入成功起算 TTL，命中不续期，失败可重试。到期后不再命中，无人访问的过期文件按分钟清理。

插件正常卸载会清理剩余文件；强杀进程可能留下文件，停机后可删除。不要保存这些路径供下次启动使用：需要保留的文件请放 `ctx.dataDir`。

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
