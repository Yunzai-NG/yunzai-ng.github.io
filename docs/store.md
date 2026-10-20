---
title: 插件商店
---

# 插件商店

下面这份列表**直接读[插件索引](https://github.com/Yunzai-NG/plugin-index)**渲染，与面板内的插件市场、面板商店同一来源 —— 索引里上架了什么，这里就有什么。

::: tip 这里只用于浏览
真正的安装、更新、卸载都在**你自己的面板**里点：内核插件进「插件市场」，面板插件进「面板商店」。两者有什么区别、装完要做什么，见[安装与管理插件](/install-plugins)。
:::

<PluginStore />

## 想上架自己的插件

发一个 PR 到 [plugin-index](https://github.com/Yunzai-NG/plugin-index) 仓库，往 `index.json`（内核插件）或 `webui_index.json`（面板插件）里加一条即可。字段含义、`minCore` 版本门与校验规则见[插件市场（索引格式）](/market)，写插件本身见[插件开发](/plugin-api)。
