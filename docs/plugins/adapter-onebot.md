# adapter-onebot

以 OneBot v11 协议接入 [NapCat](https://napneko.github.io/)、[LLOneBot](https://github.com/LLOneBot/LuckyLilliaBot)
（现名 LuckyLilliaBot）或 [SnowLuma](https://snowluma.github.io/zh/)，提供 QQ 收发能力。面板上它叫
「OneBot v11（NapCat / LLOneBot / SnowLuma）」。

## 它做什么

把协议端的报文翻译成内核的通用事件模型，并把内核的通用能力面翻译成 OneBot v11 的 API 调用。
装上它之后「加一个 QQ 账号」这件事在面板的账号页上完成，不必改任何配置文件。

四种网络模式都支持：正向 WebSocket、反向 WebSocket、HTTP、HTTP + 事件上报。

## 怎么装

在插件市场里装，或手动放进 `plugins/`。装完在**面板的账号页**添加账号，按协议端的配置
选连接方式：

| NapCat 侧配置 | LLOneBot 侧配置 | SnowLuma 侧配置 | 账号选哪种 | 适用场景 |
|---|---|---|---|---|
| WebSocket 服务器 | 正向 WebSocket | `wsServers` | 正向 WebSocket | 同机部署，首选 |
| WebSocket 客户端 | 反向 WebSocket | `wsClients` | 反向 WebSocket | 协议端在容器或另一台主机，本机连不进去 |
| HTTP 服务器 | HTTP | `httpServers` | HTTP | 只发不收的推送场景 |
| HTTP 服务器 + HTTP 客户端 | HTTP + HTTP 上报 | `httpServers` + `httpClients` | HTTP + 事件上报 | 两条单向通道凑一对，两侧 token 必须一致 |

### 账号的各栏

表单按连接方式只给用得上的那几栏。缺省值对的是三家协议端的缺省配置，同机部署照着缺省走就能连上。

| 栏 | 出现在 | 缺省 | 填什么 |
|---|---|---|---|
| WebSocket 地址 | 正向 WS | `ws://127.0.0.1:3001` | 对端 WebSocket 服务器的地址。三家缺省端口都是 3001 |
| HTTP 地址 | HTTP、HTTP + 事件上报 | `http://127.0.0.1:3000` | 对端 HTTP 服务器的地址。三家缺省端口都是 3000 |
| 本机监听路径 | 反向 WS、HTTP + 事件上报 | `/napcat` | 对端连进来（或 POST 上报）的路径。对端要填的是 `面板地址 + /adapter/napcat + 这条路径`，如 `ws://127.0.0.1:2536/adapter/napcat/napcat`，连接时也会写进日志。多个账号各用一条 |
| Access Token | 全部 | 空 | 与对端那条网络配置的 token 相同。SnowLuma 给每条网络配置自动生成 token，见下。「HTTP + 事件上报」在对端是两条配置，两条要填同一个 —— 上报签名（`x-signature`）就用它算 |
| 忽略自身消息 | 能收消息的三种 | 开 | 三家缺省都不上报自身消息，那时只有机器人自己戳出去的戳一戳受它影响 |
| 对端可读取本机文件 | 全部（「传输」） | 开 | 同机部署保持开启，图片与语音直接交文件路径；对端在容器或另一台机器上时必须关 |
| 接口调用超时 | 全部（「传输」） | 15 秒 | 一次 API 调用等多久算失败 |
| 静默超时 | 两种 WS（「传输」） | 90 秒 | 这么久没收到任何报文（含心跳）就判定断线重连，见下 |

对端那边的「消息格式」选 array 或 string 都能收；建议保持缺省的 array。

::: warning 没填 Access Token 时，反向 WS 与 HTTP 上报只接受本机
它们是面板上开出来的一个端点，谁能连到面板端口谁就能往里送「消息」—— 包括冒充主人发一条
`#重启`。所以没填 token 时只放本机连入。协议端在 Docker 或另一台机器上，或者面板经反向代理对外
（那时进来的请求看上去都来自本机），两边务必填上同一个 token。正向 WS 与 HTTP 是框架去连对端，
token 留空即不鉴权，安全与否取决于对端自己监听在哪。
:::

::: tip SnowLuma 的 token 是自动生成的
SnowLuma 首次运行时给每条网络配置各生成一个 token，HTTP 与 WebSocket 的不是同一个。到它的 WebUI（缺省端口 5099）
或 `config/onebot_<QQ号>.json` 里找到对应那条的 `accessToken`，照抄进账号。没填的话正向 WS 会被 401 拒绝，
报错里会提示这一点。用「HTTP + 事件上报」时，新建的那条 `httpClients` 的 `accessToken` 要改成与 `httpServers` 那条一样。

SnowLuma 一个 QQ 号一个 OneBot 实例，缺省都占 3000 / 3001，第二个号要在它的配置里换端口，账号这边的地址跟着改。
:::

连的是哪一家不用选：连上之后适配器调一次 `get_version_info` 认出对端，日志里写成
「已接入 LLOneBot 7.x：昵称」。三家扩展出来的接口（戳一戳、表情回应、合并转发、群文件、`get_file`）
同名、参数也一样，故功能上没有差别。

::: tip 静默超时与心跳
账号的「静默超时」缺省 90 秒，须大于协议端的心跳间隔：NapCat 与 SnowLuma 缺省 30 秒，LLOneBot 缺省 60 秒。
把 LLOneBot 的心跳调到 90 秒以上时，记得同时调大这里。
:::

::: warning HTTP 模式收不到事件
这是协议决定的，不是缺陷。适配器会在连接建立时警告一次 —— 否则使用者会以为是自己配错了，
反复去检查 NapCat 的设置。
:::

## 从 adapter-napcat 换过来

本插件原名 adapter-napcat，0.6.0 起改名。**适配器 id 仍是 `napcat`**：已有的账号原样认得，反向 WS 与
HTTP 上报的地址（`/adapter/napcat/…`）也不变，协议端那边不用动。

1. 插件页 → adapter-napcat → 更多 → 删除目录（账号记录在内核里，不随目录删掉）；
2. 插件市场 → adapter-onebot → 安装。

两个同时在会抢同一个适配器 id，后加载的那个报错，故先删再装。

## 各家的出入

三家绝大部分行为一致，适配器只在下面几处就地抹平，不按实现分岔：

| 出入 | NapCat | LLOneBot | SnowLuma | 适配器怎么做 |
|---|---|---|---|---|
| `get_file` 的参数 | `file` 或 `file_id` | 只认 `file` | `file` 或 `file_id` | 两个一起送 |
| 私聊戳一戳的发起者 | 另给 `sender_id` | 不给；机器人戳好友时报成「好友戳好友」 | 另给 `sender_id` | 没有 `sender_id`、发起者与被戳者又相同时，认作机器人自己戳的，按自身消息处理（缺省不投） |
| HTTP 下不认识的接口 | HTTP 200 + `status: "failed"` | HTTP 404 + 同样的报文 | HTTP 200 + `status: "failed"` | 有报文就照报文报「不支持该 API」 |
| Access Token | 可留空 | 可留空 | 每条网络配置自动生成 | 握手被拒而账号没填 token 时，报错里指明去哪儿抄 |

另外 LLOneBot 的表情回应（`bot.setReaction`）只支持群消息，对私聊消息会报「只支持群聊消息」。

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

**自身消息由账号配置 `ignoreSelf` 决定投不投，缺省不投。** `message_sent` 是「机器人自己发出的消息」，
投进管线的话机器人会回复自己的回复，一条指令派生出无限条。内核 0.6.0 起不再替适配器过滤这类消息 ——
「平台会不会回报自身消息」只有适配器知道 —— 故本插件 0.3.0 起要求 `core >=0.6.0`。关掉 `ignoreSelf`
之前先确认插件能自行判断发送者。机器人自己戳出去的戳一戳也受它管：NapCat 照常上报那一下，写成
「谁戳就戳谁」的插件收到它，就会自己跟自己来回戳下去。

**戳一戳不走 `send_msg`。** NapCat 收到 poke 消息段会转成空，故消息里的 `seg.poke()` 被截下来改调
`send_poke`。私聊里不指明被戳者时戳会话对方，群里必须指明：

```ts
ctx.on("notice", async e => {
  // 通用通知的 noticeType 是 string，只比 "poke" 收窄不了联合类型，故再用 in 判一次
  if (e.noticeType !== "poke" || !("targetId" in e) || e.targetId !== e.selfId) return
  // 私聊里 seg.poke() 即戳回去；群里要写明戳谁
  await e.reply(e.gid === undefined ? seg.poke() : seg.poke(e.uid))
})
```

与文字同发时先戳，文字照常发出。`send_poke` 不回消息 id，只发戳一戳时结果的 `messageId` 为空串。
`pokeType` 不起作用。收到的戳一戳会记一行 info 日志，例如 `[onebot11:10000][群 700000] 10001 戳了戳
10000 的脑袋`：内核只给消息记「收到」，不记这一行的话，日志里只有机器人回应的那行「已发出」。私聊
戳一戳报文里的 `user_id` 是会话对方，发起者在 `sender_id`，适配器已换算好，`e.uid` 就是发起者。

**只给了 `file_id` 的媒体按需换成地址。** 群文件一类消息常只带一个 id，`bot.getFileUrl(id)` 调 OneBot 的
`get_file`，优先取直链 `url`、否则退回本机路径，两者都没有就报错而不是返回空串。`getMessage` 取回的
消息会顺手归一；实时收到的消息不做 —— 那要给每条带媒体的消息多打一次 `get_file`，还会打乱消息顺序。
见 `src/codec.ts` 的 `normalizeFileSegments`。

**群成员按需拉取 + LRU/TTL。** 启动时全量写入且从不淘汰的话，数十个千人群就占几百 MB。
`getGroupMemberList` 刻意不回填缓存 —— 一次「群签到排行」会把上千个冷条目挤进去，把真正高频的
那几十个热条目全部挤出。

**中止不归因为对端配置错误。** 内核 0.2.0 起 `ctx.http` 派生自插件的卸载信号，重载或停机会中止
在途请求。HTTP 通道若把这类失败一并包成「请检查网络配置」，日志里就会出现一句与协议端无关的
误导 —— 它其实一切正常。故 `AbortError` 原样抛出，见 `src/transport-http.ts`。

## 源码在哪

[Yunzai-NG/adapter-onebot](https://github.com/Yunzai-NG/adapter-onebot)

| 路径 | 内容 |
|---|---|
| `src/index.ts` | 适配器注册与账号的连接参数 schema |
| `src/transport.ts` | 四种网络模式收敛为一个接口 |
| `src/bot.ts` | `BotDriver` 实现：通用能力面 → OneBot v11 API |
| `src/dialect.ts` | 认出对端是哪一家，以及各家出入的说明 |
| `src/codec.ts` | 消息段双向翻译（数组与 CQ 码都收） |
| `src/events.ts` | 上报报文 → 内核的 `IncomingEvent` |
| `src/media.ts` | 媒体引用与 `file` 字段互转 |
| `src/pending.ts` | 「发一条报文并等它的响应」表达为 Promise |
| `src/transport-http.ts` | 两种 HTTP 模式：调用经请求发出，事件由对端 POST 送入 |
| `src/sign.ts` | 上报请求的 HMAC-SHA1 验签（密钥即 Access Token） |
