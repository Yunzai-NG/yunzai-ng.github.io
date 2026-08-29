# Yunzai NG 文档站

[Yunzai NG](https://github.com/Yunzai-NG) 的官方文档，以 VitePress 构建，发布于
<https://yunzai-ng.github.io>。

文档独立于框架仓库维护。其一，文档的修订频率高于框架的发布频率，独立仓库使文档得以
随时发布，无须等待框架发版；其二，面板的帮助页需引用一个可访问的线上地址，本地文件
路径在无桌面环境的运行环境（Termux、远程主机）中无法打开。

## 本地预览

```powershell
pnpm install
pnpm run dev        # 默认监听 http://localhost:5173
```

```powershell
pnpm run build      # 构建；死链在此阶段报错
pnpm run preview    # 预览构建产物
```

## 文档结构

| 文件 | 标题 |
|---|---|
| `docs/index.md` | 首页 |
| `docs/getting-started.md` | 快速开始 |
| `docs/official-plugins.md` | 官方插件 |
| `docs/config.md` | 配置与面板 |
| `docs/plugin-api.md` | 插件开发 |
| `docs/panel-plugin.md` | 面板插件 |
| `docs/adapter.md` | 适配器开发 |
| `docs/renderer.md` | 渲染与模板 |
| `docs/market.md` | 插件市场与索引文件格式 |
| `docs/architecture.md` | 框架说明 |
| `docs/migration.md` | 从 Miao-Yunzai 迁移 |
| `docs/perf.md` | 性能基线 |

导航、侧边栏与站点元信息位于 `docs/.vitepress/config.mts`。

## 部署约束

**本仓库须部署为组织主站点仓库（`Yunzai-NG/yunzai-ng.github.io`），不得部署为项目页。**
面板帮助页中的文档站地址为 `https://yunzai-ng.github.io`，其链接形如
`<站点>/getting-started`。项目页形式的部署会引入一层路径前缀，导致帮助页中的全部
文档链接失效。

**文件名即站点路径。** 站点路径与 `docs/` 下的文件名一一对应（`plugin-api.md`
对应 `/plugin-api`），面板帮助页据此拼接地址。重命名文档前须同步修改面板的帮助页，
或为原路径保留重定向。

## 许可

以 AGPL-3.0-or-later 许可发布，与框架仓库一致。
