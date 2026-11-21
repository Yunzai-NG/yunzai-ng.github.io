# adapter-qqbot

经 QQ 开放平台 API v2 接入 **QQ 官方机器人**，覆盖群聊、C2C 私聊、频道、频道私信四种场景。

::: tip 与 adapter-onebot 的区别
两者都是 QQ，但走的是不同的路：本插件接的是 QQ **官方**开放平台的机器人（要在
[q.qq.com](https://q.qq.com) 注册应用、拿 AppID），[adapter-onebot](adapter-onebot.md)
接的是本机的 NapCat（用你自己的 QQ 号）。官方机器人有平台的内容与频率限制，NapCat 没有；
但官方机器人不需要挂一个客户端。
:::

## 前置条件

1. 在 [QQ 开放平台](https://q.qq.com) 注册开发者账号并创建机器人应用
2. 记下 **AppID** 与 **AppSecret**（应用管理 → 开发设置）
3. 选连接方式：
   - **WebSocket Gateway**：框架主动连 QQ 的 Gateway，不需要公网地址。官方 SDK 已说明 WebSocket 推送将逐步下线
   - **Webhook 回调**：QQ 把事件 POST 给你，需要公网 HTTPS 地址；有条件的建议用这个

调试期可以在应用管理里开**沙箱模式**。

## 怎么装

插件市场里搜 `adapter-qqbot` 装。**装依赖与编译都由内核代跑**，装完即可用。

手工克隆的话两步都要自己来（该仓库的 `dist/` 不进 git，不编译就没有入口）：

```powershell
cd <主目录>\plugins
git clone https://github.com/Yunzai-NG/adapter-qqbot.git
cd adapter-qqbot
pnpm install
pnpm run build
```

随后在面板的插件页重载，或重启内核。

## 账号配置

在**面板的账号页**添加账号，配置项如下：

| 配置项 | 说明 | 缺省 |
|---|---|---|
| 连接方式 | WebSocket Gateway 或 Webhook 回调 | WebSocket Gateway |
| AppID | 开放平台分配的 AppID | 必填 |
| AppSecret | 开放平台分配的密钥 | 必填 |
| 机器人 QQ 号 | 仅用于日志显示 | 留空 |
| 事件订阅 | 预设订阅模式，仅 WebSocket 模式 | 群聊 |
| 分片配置 | `分片ID/分片总数`，如 `0/1`，仅 WebSocket 模式 | 0/1 |
| 沙箱模式 | 切到沙箱环境 | 关闭 |
| 频道 Markdown | 频道消息用 Markdown 发 | 关闭 |
| 群聊 Markdown | 群聊消息用 Markdown 发 | 关闭 |
| Markdown 模式 | 总开关开启后的发送策略 | 原生 Markdown |
| Markdown 模板 ID | 模板模式用的 `custom_template_id` | 留空 |
| 模板参数键 | 按顺序填模板参数 key，如 `abcdefghij` | abcdefghij |
| 键盘模板 ID | 留空则按消息按钮内容生成键盘 | 留空 |
| 转发消息格式 | 合并 或 多条 | 合并 |
| 官方图床 | 图片先传到 QQ 素材库换 `qqbot-media://` 引用，不依赖公网地址 | 开启 |
| 文件服务地址 | 框架图床（内置文件路由）的对外基址，必须公网可达 | 留空 |
| 频道图片压缩上限（MiB） | 仅控制频道图片；群聊和单聊按 20 MiB 软限、Markdown 素材库按 10 MiB 处理；缺少 sharp 时原样发送 | 4 |
| 图片保存时间 | 官方素材的保留秒数，也是定时清理的依据 | 14400 |
| Webhook 监听路径 | Webhook 模式接收事件的路径 | /qqbot |

旧配置里的「图床类型」「图床脚本路径」已移除（0.4.0），打开面板保存一次即自动迁移：选过框架图床的按关闭官方图床处理，
脚本路径直接丢弃，自定义图床改由插件提供，见[自定义图床](#自定义图床)。

配套内核下，`e.reply()` 以触发事件的消息 ID 被动回复；`quote` 只控制可见引用。拆成多条时每条保留原回复 ID，只有首条显示该引用。直接调用 `bot.sendMessage()` 且不指定回复或引用时是主动推送，不借用会话中最近的消息 ID。

WebSocket 就绪后或恢复会话时，若平台返回 4914（下架）、4915（封禁）等致命关闭码，配套内核清理连接并保留错误，不再自动重连；处理平台问题后可在面板手动重连。

## 事件订阅预设

仅 WebSocket 模式需要选：

| 预设 | 适用 |
|---|---|
| 频道公域 | 公域频道机器人 |
| 频道私域 | 私域频道机器人（含论坛事件） |
| 群聊 | 群聊与 C2C 私聊 |
| 频道公域 + 群聊 | 同时接入频道和群 |
| 频道私域 + 群聊 | 同时接入频道和群 |

::: warning 公域与私域不能同时订阅
这是 QQ 开放平台的限制，不是插件的。
:::

每个预设另附 INTERACTION（按钮回调），只用官方事件表里有的位。订阅了没权限的位，平台以 4013 / 4014 关掉连接 ——
INTERACTION 被拒时插件去掉它重新鉴权一次，日志里有一条警告，此时按钮回调收不到。

## 断线与重连

- 网关地址取自 `GET /gateway`，取不到才用写死的地址；心跳周期取平台 Hello 里给的值
- 就绪之后断线：先**恢复会话**（Resume），平台补发断线期间的事件，内核看不到这次断线；恢复不成才报下线，由内核按退避重连
- 4914（已下架）、4915（已封禁）以及 4001、4002、4010~4014：重连也没用，账号停在「错误」、不再自动重连，处理后在面板点「重连」
- 内核关了 HTTP 服务（`server.enable: false`）时插件照常加载，只是 Webhook 与框架图床不可用

各预设能收到哪些事件，见仓库的 [docs/EVENTS.md](https://github.com/Yunzai-NG/adapter-qqbot/blob/main/docs/EVENTS.md)。

## Markdown 发送

**频道 Markdown** 与 **群聊 Markdown** 是分场景的总开关，开启后按 **Markdown 模式** 发：

| 模式 | 行为 |
|---|---|
| 原生 Markdown | Markdown + 交互键盘（按钮渲染为 QQ 键盘） |
| 内联指令 | Markdown + 文本指令链（按钮转为可点的文本指令） |
| 模板 Markdown | 按模板 ID 与参数键发，内容超槽位自动拆条 |
| 纯文本 | 不用富 Markdown，按普通文本拆条发 |

模板模式没填模板 ID 时自动退回纯文本。

::: danger Markdown 里的图片必须是公网 URL
QQ 的 Markdown 消息走不了富媒体接口，图片得先转成公网地址，再以
`![摘要 #宽px #高px](url)` 嵌入（QQ 要求显式声明尺寸，插件会自动解析宽高）。

通道按顺序取，前一级不可用才走下一级：**自定义图床** → **官方图床** → **框架图床**。全都不可用时图片降级为文本占位，
日志里逐级说明原因。
:::

### 自定义图床

**方向是插件提供、适配器调用。** 在你的插件里实现一个函数，用 `ctx.provide` 交出来；适配器需要地址时先问它：

```js
export default definePlugin({
  name: "my-image-host",
  setup(ctx) {
    ctx.provide("qqbot.imageToUrl", async (file, opts) => {
      // file：http(s) 链接 / 绝对路径 / base64:// 是字符串，渲染产物是 Buffer；opts：{ filename?, mime? }
      const url = await uploadToMyCdn(file, opts)
      return url // 返回 http(s):// 或 qqbot-media://；空值或抛错表示交给下一级
    })
  }
})
```

每次取址都现查服务表，插件后加载、热重载、卸载立刻生效。

### 官方图床

图片先上传到 QQ 素材库，Markdown 里引用平台返回的 `qqbot-media://` 链接，**不依赖公网地址**。平台限制：单张 ≤10MB、
仅 png / jpeg / gif / webp、**单机器人 100 张**。插件按「图片保存时间」定时清理旧素材释放配额，删除不影响已发出的消息。

### 框架图床

图片发布到 `/plugin/adapter-qqbot/file/:name` 供 QQ 服务器拉取：

- **文件服务地址**填该路由的对外基址，留空用内核面板的公网地址
- **必须公网可达**：回环、`10.x` / `172.16-31.x` / `192.168.x`、`*.local` 与单标签主机名一律跳过 —— QQ 拉不到，发出去是裂图
- 文件留 5 分钟、最多 100 个，超限自动淘汰

## 富媒体与转发

::: warning 一条消息只能带一个富媒体元素
这是 QQ 平台的限制。插件会把含多个富元素的消息**自动拆成多条**按序发出。
:::

| 场景 | 图片 | 视频 | 语音 | 文件 |
|---|---|---|---|---|
| 群聊 / C2C 私聊 | 富媒体 | 富媒体 | 富媒体 | 富媒体 |
| 频道 / 频道私信 | multipart 或 URL | 降级文本 | 降级文本 | 降级文本 |

群聊与 C2C 走官方富媒体接口：公网 URL 优先交平台转存，转存失败则本机下载后走分片上传；
本地路径、Buffer、base64 直接走分片上传。

**收到的附件**按 MIME 转成内核消息段：`image/*` → `image`，`audio/*` → `record`，
`video/*` → `video`，其余（PDF、压缩包、Office 文档）→ `file`。`file` 段保留 QQ 给的下载
URL、原始文件名与大小，接收时不下载，由使用方按需处理。

**转发消息格式**：`合并` 把多个节点并进一条发，`多条` 每个节点各自成条。含富媒体的节点因
单条限制仍会单独成条；展不开的转发段降级为文本占位。

## Webhook 模式

选 **Webhook 回调** 后：

1. 确保内核有**公网可访问的 HTTPS 地址**（frp、ngrok 一类）
2. 面板里填连接方式、AppID、AppSecret（密钥同时用于 Ed25519 签名验证）
3. 在[开放平台管理端](https://q.qq.com/qqbot/#/developer/webhook-setting)填回调地址：
   `https://你的域名:端口/plugin/adapter-qqbot/qqbot`
4. 保存时平台发 op=13 验证请求，插件自动回签名完成验证

::: warning 端口只能是 80 / 443 / 8080 / 8443
且回调地址必须是 HTTPS。用内网穿透时确认穿透工具监听的是这几个端口之一。
:::

多个账号共用同一条回调路由，插件按请求头 `X-Bot-Appid` 区分账号，不必为每个账号配不同地址。

## 沙箱模式

开启后 WebSocket 连 `wss://sandbox.api.sgroup.qq.com/websocket`，API 走
`https://sandbox.api.sgroup.qq.com`，只收沙箱环境的测试事件。

## 源码与细节文档

[Yunzai-NG/adapter-qqbot](https://github.com/Yunzai-NG/adapter-qqbot)

| 文档 | 内容 |
|---|---|
| [README](https://github.com/Yunzai-NG/adapter-qqbot/blob/main/README.md) | 完整配置说明 |
| [docs/EVENTS.md](https://github.com/Yunzai-NG/adapter-qqbot/blob/main/docs/EVENTS.md) | 各订阅预设的事件清单 |
| [docs/API-REFERENCE.md](https://github.com/Yunzai-NG/adapter-qqbot/blob/main/docs/API-REFERENCE.md) | API 参考 |
| [docs/CORE-EVENTS.md](https://github.com/Yunzai-NG/adapter-qqbot/blob/main/docs/CORE-EVENTS.md) | 与内核事件模型的对照 |
