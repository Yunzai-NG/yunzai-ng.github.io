# adapter-qqbot

经 QQ 开放平台 API v2 接入 **QQ 官方机器人**，覆盖群聊、C2C 私聊、频道、频道私信四种场景。

::: tip 与 adapter-napcat 的区别
两者都是 QQ，但走的是不同的路：本插件接的是 QQ **官方**开放平台的机器人（要在
[q.qq.com](https://q.qq.com) 注册应用、拿 AppID），[adapter-napcat](adapter-napcat.md)
接的是本机的 NapCat（用你自己的 QQ 号）。官方机器人有平台的内容与频率限制，NapCat 没有；
但官方机器人不需要挂一个客户端。
:::

## 前置条件

1. 在 [QQ 开放平台](https://q.qq.com) 注册开发者账号并创建机器人应用
2. 记下 **AppID** 与 **AppSecret**（应用管理 → 开发设置）
3. 选连接方式：
   - **WebSocket Gateway**（推荐）：框架主动连 QQ 的 Gateway
   - **Webhook 回调**：QQ 把事件 POST 给你，需要公网 HTTPS 地址

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
| 图片压缩上限 | sharp 可用时压缩超限图片，单位 MiB | 4 |
| 图床脚本路径 | 自定义图床 JS 脚本，用于 Markdown 图片 | 留空 |
| 文件服务地址 | Markdown 图片内置文件路由的对外基址 | 留空 |
| Webhook 监听路径 | Webhook 模式接收事件的路径 | /qqbot |

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

通道按优先级选：**图床脚本** → **内置文件服务**。两个都不可用时图片降级为文本占位，日志里有告警。
:::

### 内置文件服务

没配图床脚本时，图片发布到 `/plugin/adapter-qqbot/file/:name` 供 QQ 服务器拉取：

- **文件服务地址**填该路由的对外基址。留空则用内核面板的公网地址，也可以填内网穿透域名
- 文件留 5 分钟、最多 100 个，超限自动淘汰
- 填了回环地址（`localhost` / `127.0.0.1`）会告警 —— QQ 的服务器拉不到你本机的回环地址

### 图床脚本

配了**图床脚本路径**后优先走它。脚本要求：

- 导出一个函数（`export default` 或 `export function upload`）
- 收 `data`（图片 Buffer）与 `options`（`{ filename, mimeType }`）
- 返回 `Promise<string>`，即公网 URL

```js
// D:\my-image-host.js
export default async function upload(data, options) {
  const form = new FormData()
  form.append("files", new File([data], options.filename ?? "image.png", {
    type: options.mimeType ?? "image/png"
  }))

  const res = await fetch("https://图床地址/upload", { method: "POST", body: form })
  const result = await res.json()
  return result.data[0]
}
```

上传失败时自动降级到内置文件服务。

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

## 增强依赖

`sharp`（图片压缩）、`qrcode`、`silk-wasm`（语音转码）都是可选依赖，没装则对应增强自动降级，
基础收发不受影响。

## 源码与细节文档

[Yunzai-NG/adapter-qqbot](https://github.com/Yunzai-NG/adapter-qqbot)

| 文档 | 内容 |
|---|---|
| [README](https://github.com/Yunzai-NG/adapter-qqbot/blob/main/README.md) | 完整配置说明 |
| [docs/EVENTS.md](https://github.com/Yunzai-NG/adapter-qqbot/blob/main/docs/EVENTS.md) | 各订阅预设的事件清单 |
| [docs/API-REFERENCE.md](https://github.com/Yunzai-NG/adapter-qqbot/blob/main/docs/API-REFERENCE.md) | API 参考 |
| [docs/CORE-EVENTS.md](https://github.com/Yunzai-NG/adapter-qqbot/blob/main/docs/CORE-EVENTS.md) | 与内核事件模型的对照 |
