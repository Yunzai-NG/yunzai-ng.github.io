---
title: 安装与管理插件
---

<script setup>
const MANUAL = `
# 先停掉机器人（Ctrl+C），进插件目录
$ cd plugins
$ git clone https://github.com/Yunzai-NG/adapter-onebot.git
$ cd adapter-onebot
# 装依赖并编译（多数插件的 dist/ 不进 git，不编译就没有入口）
$ npm install
$ npm run build
$ cd ../..
$ npx yzng start
`

const NEXT = [
  { icon: 'store', title: '浏览插件', desc: '索引里的全部插件，含第三方', link: '/store' },
  { icon: 'box', title: '官方插件', desc: '每个官方插件做什么、要什么', link: '/official-plugins' },
  { icon: 'code', title: '自己写一个', desc: '从骨架到上架', link: '/plugin-api' }
]
</script>

# 安装与管理插件

Yunzai NG 的几乎所有功能都来自插件。插件分两类，**装在两个不同的地方**，这是最容易装错的一点：

| | 内核插件 | 面板插件包 |
|---|---|---|
| 是什么 | 跑在机器人进程里：命令、定时任务、适配器、渲染器 | 跑在浏览器里：往面板上加组件和页签 |
| 例子 | adapter-onebot、renderer-puppeteer、steward | hardware（硬件监控）、webui-example |
| 在哪装 | 面板 → **插件市场** | 面板 → **面板商店** |
| 装完 | 立即加载，不用重启 | 刷新页面；带 node 侧的包要到插件页重载 webui |

不确定一个插件属于哪类，看[官方插件一览](/official-plugins#一览)的「装在哪」一列。

## 从插件市场装内核插件

<div class="steps">

### 打开插件市场

面板左侧进**插件市场**，列出的是[插件索引](https://github.com/Yunzai-NG/plugin-index)里上架的全部内核插件，与本站的[浏览插件](/store)同源。

<Shot name="market" alt="插件市场页" url="127.0.0.1:2536/#/market" />

### 点「安装」

市场会用 Git 拉下插件、装依赖、跑编译，完成后**直接加载**，不用重启。大一点的插件（例如要下载浏览器的 renderer-puppeteer）可能要几分钟，页面上会一直显示进行中。

### 在插件页确认

进**插件**页，刚装的插件应在列表里、状态为已加载。有配置项的插件，到**配置**页找它的表单：

<Shot name="plugins" alt="插件页：已安装插件的列表与状态" url="127.0.0.1:2536/#/plugins" />

</div>

## 从面板商店装面板插件

面板商店在面板左侧，用法与插件市场相同：点「安装」。商店分「组件」「主题」两栏，同时给两样的包两栏都有。装好之后：

- **只有浏览器侧**的包：刷新页面，新组件出现在概览页；点概览页的「编辑组件」可以拖动、缩放、显示或隐藏它们。
- **带 node 侧**的包（例如 hardware 要在服务器上采样硬件数据）：到**插件**页对 webui 点「重载」才生效，只刷新页面不够。之后**更新**这类包时，node 侧的新代码要重启机器人才会换上。
- **主题**：装完不用刷新，到**外观**页的「主题」页签里选它。见[外观与主题](/themes)。

装好之后商店卡片上只剩「去插件页」（有新版时是「去更新」）：**面板插件的更新与删除都在插件页**的「面板插件」页签，与内核插件同一处。只带主题、没有组件的包在那里也有一张卡片。

<Shot name="store" alt="面板商店页" url="127.0.0.1:2536/#/store" />

## 国内网络

插件索引与插件仓库都在 GitHub 上，国内常超时。在面板的**配置**页（或 `config/yunzai.yaml`）给 `market.mirror` 填一个 GitHub 镜像前缀，例如 `https://gh-proxy.org/`，之后的索引与安装都经它走：

```yaml
market:
  mirror: https://gh-proxy.org/
```

镜像是第三方服务，可用性不由本项目保证；哪个能用换哪个。也可以自建或换用别的插件索引，见[插件市场（索引格式）](/market)。

## 更新、停用与卸载

| 操作 | 在哪 | 做了什么 | 配置与数据 |
|---|---|---|---|
| 更新 | 插件页 | 拉取远端新提交并重新编译；面板插件包同在这一页 | 保留 |
| 重载 | 插件页 | 卸载再加载一遍，改了插件代码后用 | 保留 |
| 卸载 | 插件页 → 更多 | 从运行中的进程里卸下，回收它注册的一切；目录不动 | 保留 |
| 删除目录 | 插件页 → 更多 | 删除插件目录 | **保留**，重装同名插件后原配置仍有效 |
| 停用 | 配置页 → 内核 → `plugins.disabled` | 写上插件名，此后不加载、不占内存 | 保留 |

插件页页头的「检查更新」把插件市场与面板商店两份索引一起回源，之后哪些可更新就在卡片上标出来，页头那一行也给出合计。

也可以在 QQ 里让机器人自己更新，见 [steward](/plugins/steward)（限主人）。

## 不用面板，手动安装

把插件仓库克隆进 `plugins/` 目录，装依赖、编译，再启动：

<Terminal title="终端" :text="MANUAL" />

单文件的 JS 插件更简单：放进 `plugins/example/` 即可。

## 下一步

<LinkCards :items="NEXT" />
