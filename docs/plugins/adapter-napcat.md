# adapter-napcat

以 OneBot v11 协议接入 NapCat，提供 QQ 收发能力。

## 它做什么

把 NapCat 的报文翻译成内核的通用事件模型，并把内核的通用能力面翻译成 NapCat 的 API 调用。
装上它之后「加一个 QQ 账号」这件事在面板的账号页上完成，不必改任何配置文件。

四种网络模式都支持：正向 WebSocket、反向 WebSocket、HTTP、HTTP + 事件上报。

## 怎么装

在插件市场里装，或手动放进 `plugins/`。装完在**面板的账号页**添加账号，按 NapCat 侧的配置
选连接方式：

| NapCat 侧配置 | 账号选哪种 | 适用场景 |
|---|---|---|
| WebSocket 服务器 | 正向 WebSocket | 同机部署，首选 |
| WebSocket 客户端 | 反向 WebSocket | NapCat 在容器或另一台主机，本机连不进去 |
| HTTP 服务器 | HTTP | 只发不收的推送场景 |
| HTTP 服务器 + HTTP 客户端 | HTTP + 事件上报 | 两条单向通道凑一对，两侧 token 必须一致 |

::: warning HTTP 模式收不到事件
这是协议决定的，不是缺陷。适配器会在连接建立时警告一次 —— 否则使用者会以为是自己配错了，
反复去检查 NapCat 的设置。
:::

## 关键实现

**四种模式实为两组正交的选择**：事件由哪方主动、API 走哪条通路。展开成四份独立实现会得到四份
几乎相同的重连、鉴权与错误处理，故只实现三个（两种 WS 共用报文层，两种 HTTP 共用调用层）。
见 `src/transport.ts`。

**消除全链路 base64。** `file` 字段有三条通道，按代价自低至高：裸本地绝对路径（同机部署零拷贝）、
http(s) URL（对端自行下载）、`base64://`（仅在前两项都不成立时）。一律转 base64 的话，一张 2MB
的图就是十几兆瞬时内存与两次全量编解码。见 `src/media.ts`。

::: danger NapCat 的 `file://` 不是文件路径
`file://<数字哈希ID>` 指向它内部的文件哈希 id。给本地图片加 `file://` 前缀会让它去查一个不存在
的哈希并报「文件不存在」—— 本地路径必须以裸路径传递。这是它与其他 OneBot 实现最易混淆的一处
分歧。
:::

**收到的 `message` 可能是数组也可能是 CQ 码**，取决于对端的 `messagePostFormat`，而适配器约束不了
对端的配置。只支持数组的话，配成 string 的使用者会得到「机器人收到消息但内容全为空」——
一种从日志里完全看不出原因的症状。故两种都解析。发送一律用数组（不必转义，也不会因使用者消息里
出现 `[CQ:` 而被误解析）。见 `src/codec.ts`。

**用 Promise 登记取代忙等轮询。** OneBot 的 WebSocket 是全双工，请求带一个 `echo`、响应把它带回，
两者之间没有顺序保证。把响应存进全局对象再每 50ms 轮询的话，单次调用最坏等 60 秒，且几十个群
同时收发时那个轮询循环本身就是主要的 CPU 开销。见 `src/pending.ts`。

**`message_sent` 直接忽略。** 那是「机器人自己发出的消息」，投进管线的话机器人会回复自己的回复，
一条指令派生出无限条。

**群成员按需拉取 + LRU/TTL。** 启动时全量写入且从不淘汰的话，数十个千人群就占几百 MB。
`getGroupMemberList` 刻意不回填缓存 —— 一次「群签到排行」会把上千个冷条目挤进去，把真正高频的
那几十个热条目全部挤出。

## 源码在哪

[Yunzai-NG/adapter-napcat](https://github.com/Yunzai-NG/adapter-napcat)

| 路径 | 内容 |
|---|---|
| `src/index.ts` | 适配器注册与账号的连接参数 schema |
| `src/transport.ts` | 四种网络模式收敛为一个接口 |
| `src/bot.ts` | `BotDriver` 实现：通用能力面 → NapCat API |
| `src/codec.ts` | 消息段双向翻译（数组与 CQ 码都收） |
| `src/events.ts` | 上报报文 → 内核的 `IncomingEvent` |
| `src/media.ts` | 媒体引用与 `file` 字段互转 |
| `src/pending.ts` | 「发一条报文并等它的响应」表达为 Promise |
