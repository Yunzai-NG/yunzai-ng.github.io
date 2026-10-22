---
title: 这是什么
---

<script setup>
const FLOW = [
  { icon: 'message', title: '有人发消息', sub: '群里发 #ping' },
  { icon: 'plug', title: '适配器收到', sub: '翻译成通用事件', tone: 'ext' },
  { icon: 'layers', title: '内核分发', sub: '找到对应的命令', tone: 'core' },
  { icon: 'box', title: '插件处理', sub: '查数据、出图……', tone: 'ext' },
  { icon: 'send', title: '回复', sub: '原路发回群里' }
]

const ROUTE = [
  { icon: 'wrench', title: '安装与启动', sub: '装好、打开面板' },
  { icon: 'qq', title: '接入 QQ', sub: '机器人回第一句话', tone: 'ext' },
  { icon: 'store', title: '装插件', sub: '加上想要的功能', tone: 'ext' },
  { icon: 'rocket', title: '一直跑着', sub: '开机自启、自动重连', tone: 'core' }
]

const PATHS = [
  { icon: 'rocket', title: '我要搭一个机器人', desc: '从安装开始，每一步都有截图与终端示意', link: '/getting-started' },
  { icon: 'code', title: '我要写插件', desc: '最小插件、ctx 能力一览、发布上架', link: '/plugin-api' },
  { icon: 'route', title: '我在用 Miao-Yunzai', desc: '两者的差异，以及旧插件怎么迁过来', link: '/migration' },
  { icon: 'layers', title: '我想了解它怎么设计的', desc: '分层、事件管线、各子系统的职责', link: '/architecture' }
]
</script>

# 这是什么

**Yunzai NG 是一个 QQ 机器人的运行框架。** 你在群里发一条命令查游戏体力，机器人回你一张图 —— 收消息、找到该谁处理、把结果发回去，这一整套就是它在做的事。

它是 [Miao-Yunzai](https://github.com/yoimiya-kokomi/Miao-Yunzai) 的重写版：保留「插件化的游戏 / 群管机器人」这个用法，换掉了底层，使它启动更快、占内存更少、长期运行更稳。

## 内核 + 插件

最重要的一个概念：**框架本身（内核）只负责传递消息，能做什么完全取决于装了哪些插件**。就像手机系统和 App 的关系。

<Flow :steps="FLOW" />

所以刚装好时，它连 QQ 都还接不上 —— 那是适配器插件的事。常用的几样都有官方插件：

| 想要的能力 | 由哪个插件提供 | 在哪装 |
|---|---|---|
| 网页管理面板 | [webui](/plugins/webui) | 初始化时直接回车就装 |
| 接入 QQ | 协议端（如 NapCat）+ 适配器 [adapter-onebot](/plugins/adapter-onebot)，或官方机器人 + [adapter-qqbot](/plugins/adapter-qqbot)，见[接入 QQ](/first-bot) | 插件市场 |
| 把结果画成图片 | [renderer-puppeteer](/plugins/renderer-puppeteer) | 插件市场 |
| 原神 / 星铁 / 绝区零的体力、深渊等查询 | [mhy-game](/plugins/mhy-game) | 插件市场 |
| 在 QQ 里重启、更新机器人 | [steward](/plugins/steward) | 插件市场 |
| 面板上看 CPU、内存、磁盘 | [hardware](/plugins/hardware) | 面板商店 |

全部插件见[插件商店](/store)。

## 开始前要准备什么

- **一台能一直开着的设备**：Windows / macOS / Linux 电脑、云服务器，或一部安卓手机（[Termux](https://termux.dev/)）都可以。
- **一个给机器人用的 QQ 号**，建议用小号。
- **大约二十分钟**：装环境、装框架、接 QQ。命令都给好了，照着复制即可。

不需要会编程。只有想自己写插件时才需要 JavaScript / TypeScript。

## 推荐的阅读路线

<Flow :steps="ROUTE" />

<LinkCards :items="PATHS" />
