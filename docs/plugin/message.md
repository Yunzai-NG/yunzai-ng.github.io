# 发消息

从回一句话到渲染出图，由浅入深。本页的每段代码都可直接放进 `action` 里跑。

事件对象 `e` 上有三个发送入口：

| | 用途 |
|---|---|
| `e.reply(content, opts?)` | 回到消息来处（群消息回群、私聊回私聊） |
| `e.renderReply(模板, 数据?, opts?)` | 渲染成图片再回 |
| `e.render(模板, 数据?, opts?)` | 只渲染出图片段，**不发送** |

不在事件里（定时任务、HTTP 路由）时用 `ctx.pickBot()`，见[主动发送](#主动发送)。

## 回一句文本

```js
ctx.command("#你好").action(async e => {
  await e.reply("你好")
})
```

`reply` 收字符串、数字、消息段，或它们的任意层数嵌套数组。`null` / `undefined` / `false`
会被丢掉，所以可以直接写条件项：

```js
await e.reply(["结果：", ok && "成功", !ok && "失败"])
```

## @ 与引用

```js
await e.reply("收到", { at: true })         // @ 发送者（仅群聊生效）
await e.reply("收到", { quote: true })       // 引用当前这条消息
await e.reply("收到", { quote: 某条消息id })  // 引用指定消息
await e.reply([seg.at("10001"), " 该你了"])   // @ 指定的人
await e.reply(seg.atAll())                   // @ 全体成员
```

`at` 与 `quote` 可以一起给。`seg` 从内核导入：

```js
import { seg } from "@yunzai-ng/core"
```

## 发图片

图片来源有四种，`seg.image()` 都收：

```js
await e.reply(seg.image("https://example.com/a.png"))  // 链接，对端自行下载
await e.reply(seg.image("D:/pics/a.png"))              // 本地绝对路径
await e.reply(seg.image(buffer))                       // Buffer
await e.reply(seg.image("base64://iVBORw0KGgo..."))    // base64
```

::: tip 同机部署优先给绝对路径
本地路径在同机部署下是零拷贝，base64 要经过一次全量编解码 —— 一张 2MB 的图会变成十几兆瞬时内存。
适配器会按代价从低到高选通路，给它最省的那种。
:::

## 文本 + 图片混排

数组里按顺序排即可：

```js
await e.reply(["你的角色面板：", seg.image(imgPath), "\n更新于 ", 时间])
```

## 其他消息段

```js
await e.reply(seg.face(66))                       // QQ 原生表情
await e.reply(seg.record("D:/a.mp3"))             // 语音
await e.reply(seg.video("D:/a.mp4"))              // 短视频
await e.reply(seg.file("D:/report.pdf"))          // 文件
await e.reply(seg.share("https://…", "标题"))      // 链接分享
await e.reply(seg.json({ app: "…" }))             // JSON 卡片
await e.reply(seg.music("qq", "歌曲id"))           // 平台歌曲
await e.reply(seg.poke("10001"))                  // 戳一戳
await e.reply(seg.markdown("**加粗**"))            // Markdown
```

全表见[消息段全表](#消息段全表)。

## 合并转发

```js
await e.reply(seg.forward([
  seg.node("第一条"),
  seg.node([seg.image(img), "第二条带图"], { name: "小助手", uid: "10001" }),
  seg.node("第三条")
], { summary: "查看 3 条转发" }))
```

`seg.node` 的第二参是显示用的发送者信息。需要转发时**先看平台支不支持**：

```js
if (e.bot.caps.has("forward")) {
  await e.reply(seg.forward(nodes))
} else {
  await e.reply(nodes.map(n => n.message).flat())
}
```

内容过长时也可以让内核自动转成合并转发：

```js
await e.reply(很长的文本, { autoForward: true })
```

## 渲染出图并发送

两种模板，都是一句话：

```tsx
// TSX 模板（推荐，数据有类型检查）
import { defineTemplate } from "@yunzai-ng/jsx"

export const Note = defineTemplate("note", (v: NoteView) => <html>…</html>)

await e.renderReply(Note(view))
```

```js
// 字符串模板，路径相对本插件的 templates/ 目录
await e.renderReply("note", { uid, 体力: 160 })
```

`renderReply` 的选项把渲染与回复选项合在一起，所以可以边渲染边引用：

```js
await e.renderReply(Note(view), { quote: true, width: 800 })
```

::: tip TSX 与字符串模板的区别
TSX 模板的数据在**编译期**就检查了 —— 视图层改了字段名，`tsc` 当场失败，而不是等真机出图时得到一张空白图。
模板同时是纯函数，可以直接快照测试，不需要浏览器。详见[渲染与模板](../renderer.md)。
:::

## 只出图，不发送

`e.render()` / `ctx.render()` 返回图片段，自己决定怎么用：

```js
const img = await e.render(Note(view))
await e.reply(["这是你的便笺：", img, "\n请查收"])
```

返回值是 `ImageSegment` 或 `ImageSegment[]`（分页时是数组），两种都能直接塞进 `reply` 的数组里。

在没有事件的地方渲染用 `ctx.render()`，签名一致：

```js
const img = await ctx.render("daily", { 日期 })
```

::: warning 没有渲染器时会抛错
`render` 在无可用渲染器或渲染失败时抛错。需要退回文字的插件自己接住：

```js
try {
  await e.renderReply(Note(view))
} catch {
  await e.reply(`体力 ${view.体力}/160`)
}
```
:::

## 主动发送

定时任务、HTTP 路由里没有 `e`，用 `ctx.pickBot()` 取一个账号：

```js
ctx.cron("0 0 8 * * *", async () => {
  const bot = ctx.pickBot()          // 缺省第一个在线账号
  if (bot === undefined) return      // 没有可用账号，返回 undefined 而不是抛错

  await bot.sendMessage({ scene: "group", gid: "12345" }, "早上好")
})
```

多账号部署时显式指定：`ctx.pickBot("账号id")`。

发送目标三种形状：

```js
{ scene: "private", uid: "10001" }                              // 私聊
{ scene: "group", gid: "12345" }                                // 群
{ scene: "guild", gid: "…", guildId: "…", channelId: "…" }      // 频道
```

`sendMessage` 的第三参是发送选项：`quote`（消息 id）、`recallAfter`、`autoForward`、`splitLength`。

## 撤回

```js
const res = await e.reply("这条待撤回")
await e.bot.recallMessage(res.messageId)

await e.reply("5 秒后自动撤回", { recallAfter: 5000 })  // 平台支持时
await e.recall()                                        // 撤回触发本次命令的那条消息
```

撤回需要平台支持，先看 `e.bot.caps.has("recall")`。

## 发送结果

三个入口都返回 `SendResult`：

| 字段 | 含义 |
|---|---|
| `ok` | 是否送达平台 |
| `messageId` | 平台返回的消息 id；平台不返回时是空串 |
| `time` | 发送时间（毫秒时间戳） |
| `raw` | 平台原始返回，排障用 |

## 追问

发一句提示并等对方的下一条消息：

```js
const next = await e.prompt({ tip: "请发送 UID", timeout: "30s" })
if (next === undefined) return          // 超时，或插件正在卸载
await e.reply(`收到 ${next.text}`)
```

选项：`timeout`（缺省 60s）、`sameUser`（缺省 true，只收同一用户）、`tip`、`filter`
（返回 false 表示这条不算，继续等）。等待期间该会话的消息不会同时触发命令。

## 平台能力差异

同一段代码发到不同平台不一定都成立。`e.bot.caps` 是本账号支持的可选能力集合：

```js
if (e.bot.caps.has("recall")) await e.bot.recallMessage(id)
```

可选能力包括 `recall` `forward` `poke` `groupFile` `groupCard` `groupMute` `fetchHistory` 等。
必选能力（发消息、取好友与群信息）所有适配器都实现，不必判断。

::: warning 段类型也有平台差异
适配器收到不支持的段时会降级或丢弃 —— 比如 QQ 官方机器人把频道场景的视频降级为文本占位。
拿不准就查对应适配器那一页，如 [adapter-napcat](../plugins/adapter-napcat.md)、
[adapter-qqbot](../plugins/adapter-qqbot.md)。
:::

## 消息段全表

| 构造器 | 说明 |
|---|---|
| `seg.text(文本)` | 纯文本，数字会转成字符串 |
| `seg.image(来源, opts?)` | 图片 |
| `seg.at(uid, name?)` | @ 某人 |
| `seg.atAll()` | @ 全体成员 |
| `seg.face(id, big?)` | QQ 原生表情 |
| `seg.reply(消息id)` | 引用回复 |
| `seg.record(来源, opts?)` | 语音 |
| `seg.video(来源, 封面?)` | 短视频 |
| `seg.file(来源, opts?)` | 文件 |
| `seg.location(纬度, 经度, opts?)` | 位置 |
| `seg.share(url, 标题, opts?)` | 链接分享 |
| `seg.contact("user" \| "group", id)` | 推荐好友 / 群 |
| `seg.json(数据)` | JSON 卡片，传对象自动序列化 |
| `seg.xml(数据)` | XML 卡片 |
| `seg.poke(uid?, 类型?)` | 戳一戳 |
| `seg.dice(点数?)` | 骰子 |
| `seg.rps(结果?)` | 猜拳 |
| `seg.music(平台, id)` | 平台歌曲 |
| `seg.musicCustom(字段)` | 自定义音乐卡片 |
| `seg.forward(节点[], opts?)` | 合并转发 |
| `seg.node(内容, opts?)` | 合并转发中的一条 |
| `seg.markdown(正文)` | Markdown |

## 读收到的消息

| | |
|---|---|
| `e.text` | 纯文本视图，拼接所有文本段并 trim，不含 at 与图片 |
| `e.message` | 段数组，中间件可改写 |
| `e.images` | 消息里的图（含引用消息里的） |
| `e.quote` | 被引用的消息 |
| `e.atMe` / `e.atUsers` | 是否 @ 了机器人 / @ 了哪些人 |
| `e.sender` / `e.group` / `e.channel` | 发送者与所在会话 |
| `e.isMaster` / `e.isGroupAdmin` / `e.isGroupOwner` | 身份 |
| `e.isPrivate` / `e.isGroup` | 场景 |

::: warning 改了 e.message 要调 e.refresh()
`text`、`atMe`、`atUsers`、`images` 都是派生视图。改完段数组不刷新的话，它们还是旧值。
:::

## 下一步

- [命令与事件](command.md) —— 怎么让消息进到你的 `action` 里
- [渲染与模板](../renderer.md) —— 模板怎么写、资源怎么放
