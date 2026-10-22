---
title: 接入 QQ
---

<script setup>
const PATH = [
  { icon: 'qq', title: 'QQ 服务器', sub: '腾讯' },
  { icon: 'plug', title: '协议端', sub: '登录账号、开出接口' },
  { icon: 'link', title: '适配器', sub: '接口 → 通用事件', tone: 'ext' },
  { icon: 'layers', title: 'Yunzai NG', sub: '内核', tone: 'core' },
  { icon: 'box', title: '插件', sub: '处理并回复', tone: 'ext' }
]

const PING = `
# 先停掉正在跑的机器人（在它的终端里按 Ctrl+C），然后：
$ npx yzng plugin new hello

  已生成 D:\\Bot\\my-bot\\plugins\\hello

  下一步 yzng dev 随后向机器人发送 #ping
$ npx yzng start
  INFO  plugin   插件 hello@0.1.0 已加载（1 条命令、0 个任务，18ms）
  INFO  account  账号上线：10001@napcat（云崽）
`

const NEXT = [
  { icon: 'store', title: '安装更多插件', desc: '插件市场与面板商店：出图、硬件监控、运维', link: '/install-plugins' },
  { icon: 'rocket', title: '让它一直跑着', desc: '开机自启、掉线自动回来', link: '/deploy' },
  { icon: 'code', title: '写自己的插件', desc: '从刚生成的 hello 开始改', link: '/plugin-api' },
  { icon: 'book', title: '连不上？', desc: '常见问题里有排查表', link: '/faq#接入-qq' }
]
</script>

# 接入 QQ

内核不认识任何聊天平台。让它收发 QQ 消息，中间要有两样东西：

<Flow :steps="PATH" />

| 角色 | 是什么 | 例子 |
|---|---|---|
| **协议端** | 独立运行的程序（或库），替机器人登录 QQ 号、维持与 QQ 服务器的连接，再把收发消息的能力按某种协议开放出来 | NapCat、LLOneBot、Lagrange、go-cqhttp、oicq |
| **通信协议** | 协议端与框架之间说的「话」。QQ 机器人圈子里最通行的是 [OneBot v11](https://github.com/botuniverse/onebot-11) | OneBot v11、QQ 官方 API |
| **适配器** | Yunzai NG 的插件，把某种协议翻译成内核的通用事件，再把内核的回复翻译回去 | [adapter-onebot](/plugins/adapter-onebot)、[adapter-qqbot](/plugins/adapter-qqbot) |

协议端决定「用什么方式登录 QQ」，适配器决定「框架怎么跟协议端对话」。两者分开，换协议端不必改插件，换框架也不必换协议端。

## 选一条路

| | 第三方协议端 + OneBot v11 | QQ 官方机器人 |
|---|---|---|
| 用什么账号 | 一个普通 QQ 号（**建议用小号**） | 在 [QQ 开放平台](https://q.qq.com/) 注册的机器人 |
| 协议端 | 自己装一个，见下表 | 不需要，框架直连腾讯的接口 |
| 适配器 | [adapter-onebot](/plugins/adapter-onebot) | [adapter-qqbot](/plugins/adapter-qqbot) |
| 能做什么 | 与真人账号一样收发群聊、私聊，戳一戳、撤回等 | 群聊、私聊、频道，受平台的内容与频率限制 |
| 上手 | 装协议端，扫码登录 | 申请、审核，拿 AppID 与 AppSecret |

### 常见的协议端

| 协议端 | 实现方式 | 与本框架 |
|---|---|---|
| [NapCat](https://napneko.github.io/) | 基于官方 QQNT 客户端，无界面运行 | **推荐**。adapter-onebot 以它为基准开发与测试 |
| [LLOneBot](https://github.com/LLOneBot/LuckyLilliaBot) | 现名 LuckyLilliaBot，基于官方 QQNT 客户端运行 | **支持**。与 NapCat 同等对待，两家的出入见 [adapter-onebot](/plugins/adapter-onebot#两家的出入) |
| [Lagrange](https://github.com/LagrangeDev/Lagrange.Core) | 自行实现 QQNT 协议 | 其 Lagrange.OneBot 提供 OneBot v11，同上 |
| [go-cqhttp](https://github.com/Mrs4s/go-cqhttp) | 自行实现手机 QQ 协议 | 曾是 OneBot 的事实标准，**已停止维护**，新部署不建议 |
| [oicq](https://github.com/takayama-lily/oicq) / [icqq](https://github.com/icqqjs/icqq) | Node.js 库，嵌在机器人进程里 | 旧版 Yunzai-Bot 用的就是它。它不是独立的 OneBot 服务，本框架没有对应的适配器 |

adapter-onebot 说的是标准 OneBot v11，因此别的 OneBot v11 协议端原则上都能接。它正式支持 NapCat 与 LLOneBot 两家：几处标准之外的扩展（戳一戳走 `send_poke`、表情回应、`get_file` 取媒体地址）两家都有、写法也一样。换用别的协议端时，这几项可能不可用，其余收发不受影响。各协议端的维护状态变化较快，以其主页为准。

::: warning 用小号
第三方协议端登录的是一个真实的 QQ 号。机器人回复频繁时，平台风控可能限制这个号，所以别拿常用的大号来挂。
:::

## 以 NapCat 为例

下面以推荐的 NapCat 走一遍。换用 LLOneBot 或别的 OneBot v11 协议端，第 1、2 步按它的文档做，要做的事是一样的：**登录账号，开一个 WebSocket 服务器**（LLOneBot 里叫「正向 WebSocket」）。

<div class="steps">

### 安装并登录协议端

按 [NapCat 官方文档](https://napneko.github.io/) 选择适合你系统的安装方式（Windows 一键包、Linux 脚本、Docker 都有），装好后启动，**用手机 QQ 扫码登录机器人那个号**。

协议端与 Yunzai NG 是两个程序，各开各的窗口，都要一直开着。

### 开一个 WebSocket 服务器

打开 NapCat 的 WebUI（地址与登录口令在 NapCat 启动时的输出里），进入**网络配置 → 新建 → WebSocket 服务器**：

| 项 | 填什么 |
|---|---|
| 启用 | 打开 |
| Host | `127.0.0.1`（协议端与机器人在同一台机器上时） |
| Port | `3001` |
| Token | 自己编一串，例如 `my-secret-123`，后面还要填一次 |

保存。这一步是让协议端在 `ws://127.0.0.1:3001` 等着框架连上来。

### 装适配器 adapter-onebot

回到 Yunzai NG 的面板，进**插件市场**，找到 **adapter-onebot**，点「安装」：

<Shot name="market" alt="面板的插件市场页，adapter-onebot 显示安装按钮" url="127.0.0.1:2536/#/market">插件市场：列出索引里的全部内核插件，点「安装」即可</Shot>

装完它会出现在**插件**页，状态为已加载。国内网络下拉取慢或超时，见[安装插件 · 国内网络](/install-plugins#国内网络)。

### 添加账号

进**账号**页。页面按适配器分页签，选 **OneBot v11（NapCat / LLOneBot）** 那一枚，点「添加账号」，弹窗里的表单按它的需要展开：

<Shot name="accounts" alt="账号页的添加账号弹窗，NapCat 页签下" url="127.0.0.1:2536/#/accounts?adapter=napcat">每个适配器一枚页签，添加账号的表单由插件声明的字段生成</Shot>

- **连接方式**：正向 WebSocket（对应上一步建的「WebSocket 服务器」）
- **WebSocket 地址**：`ws://127.0.0.1:3001`（缺省就是；用别的协议端时填它的地址）
- **Access Token**：填上一步编的那串
- 其余保持缺省

点「创建账号」。弹窗关掉，几秒内页签下那一行的状态变成**在线**，就连上了。

### 发一句试试

内核不内置任何命令，所以现在发什么机器人都不会回。生成一个示例插件来验证整条链路：

<Terminal title="终端" :text="PING" />

用另一个 QQ 号给机器人发 `#ping`（私聊，或在它所在的群里），它回 `pong` —— 整条链路就通了。

</div>

::: details 协议端在 Docker 里，或在另一台机器上？
这时框架连不进协议端的 `127.0.0.1`。两种办法：把协议端的 WebSocket 服务器 Host 改成 `0.0.0.0`，「WebSocket 地址」填它的局域网 IP；或者反过来，在协议端建「WebSocket 客户端」（LLOneBot 里叫「反向 WebSocket」）、账号里选「反向 WebSocket」，让协议端主动连框架 —— 这时两边要填上同一个 Access Token，没填 token 的反向连接只接受本机。并把账号的「对端可读取本机文件」关掉。四种连接方式的对照见 [adapter-onebot](/plugins/adapter-onebot#怎么装)。
:::

## 用 QQ 官方机器人接入

这条路没有第三方协议端：在 [QQ 开放平台](https://q.qq.com/) 创建机器人、拿到 AppID 与 AppSecret 后，在插件市场装 **adapter-qqbot**，在账号页它的页签下点「添加账号」、填入凭据即可。申请流程、沙箱与正式环境的区别见 [adapter-qqbot](/plugins/adapter-qqbot)。

## 没有 QQ 也想先试试

装 [adapter-stdin](/plugins/adapter-stdin)：它把运行机器人的终端本身当成一个账号，在终端里敲 `#ping`，回复就打印在下面。适合先把插件写起来，再去折腾协议端。

## 下一步

<LinkCards :items="NEXT" />
