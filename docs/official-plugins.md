# 官方插件

内核之外的全部能力都由插件提供：适配器、渲染器、面板、业务功能。这一节逐个说清它们做什么、
怎么装、以及**关键实现是怎么想的** —— 后者是给想自己写插件的人看的。

## 一览

| 插件 | 作用 | 装在哪 | 额外要求 |
|---|---|---|---|
| [webui](/plugins/webui) | 面板本身：七个页面、配置表单、面板插件宿主与商店 | 插件市场 | 从源码装时要构建前端 |
| [adapter-napcat](/plugins/adapter-napcat) | 以 OneBot v11 接入 NapCat，提供 QQ 收发 | 插件市场 | 一个在跑的 NapCat |
| [renderer-puppeteer](/plugins/renderer-puppeteer) | 把模板渲染成图片 | 插件市场 | 装完执行 `pnpm run install:browser` |
| [hardware](/plugins/hardware) | 整机硬件监控，九枚面板组件 | **面板商店** | 装完要重载 webui |
| [webui-example](/plugins/webui-example) | 面板插件的示例包，用于照抄 | **面板商店** | 装完要重载 webui |
| [mhy-game](/plugins/mhy-game) | 原神 / 星穹铁道 / 绝区零 查询 | 插件市场 | 渲染器（否则退回文字） |

## 两类插件，两个市场

**这一点最容易装错地方**，故单独说：

| | 内核插件 | 面板插件包 |
|---|---|---|
| 是什么 | 跑在 node 进程里，可注册命令、任务、适配器、渲染器 | 跑在浏览器里，往面板上加组件与页签 |
| 装在哪 | 插件市场 → `plugins/` | 面板商店 → webui 目录下的 `plugins/` |
| 索引 | `index.json`，顶层键 `plugins` | `webui_index.json`，顶层键 `panels` |
| 版本门 | `minCore`（内核版本） | `minWebui`（webui 版本） |
| 写法 | `definePlugin({ name, setup })` | `export default [组件…]` |

两份索引的顶层键刻意不同名：填错了地方会当场报「格式不符」，而不是列出一堆装到错处的条目。

上表里 `hardware` 与 `webui-example` 是面板插件包，其余四个是内核插件。

## 想自己写一个

- 内核插件：读[插件开发](/plugin-api)，那里有从骨架到发布的完整一遍。
- 面板插件：读[面板插件](/panel-plugin)，然后照抄 [webui-example](/plugins/webui-example)。
- 适配器：读[适配器开发](/adapter)。
- 渲染器：读[渲染与模板](/renderer)。

**读实现时的次序建议**：先 `webui-example`（每样能力各一次，短），再 `hardware`（同样的能力做到
生产规模），最后按需读其余四个。

## 停用与卸载

在插件页上操作。**停用**改的是配置项 `plugins.disabled`，故与配置页里改同一项是一回事；
**卸载**只删安装目录，配置与数据都留着 —— 重装同名插件后原有配置仍然有效。

面板插件包没有「重载」与「卸载」按钮：那两个动作对浏览器侧的包没有意义（刷新页面即重新加载），
删除走面板商店。
