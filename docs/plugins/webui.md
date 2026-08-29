# webui

面板本身。八个页面、schema 驱动的配置表单、面板插件的宿主与商店。

## 它做什么

它是**唯一接管站点根路径**的插件 —— 内核只检测根路径有没有被接管，不自带兜底的前端。故
「面板由谁提供」只有一个答案，而替换面板不需要改内核。

八个页面：概览、账号、日志、插件、插件市场、面板商店、配置、帮助。其中三件能力对写插件的人
最有用：

- **配置表单自动生成。** 插件写完 `configSchema` 就有了表单，不必碰任何前端代码。
- **面板插件的宿主。** 别人的包放进 `plugins/` 即可往面板上加组件与页签。
- **面板商店。** 从索引装、更、删面板插件包。

## 怎么装

已有面板时，在**插件市场**里点更新即可，无须命令行。首次安装或面板打不开时从源码装：

```bash
cd <home>/plugins
git clone https://github.com/Yunzai-NG/webui-plugin.git webui
cd webui
pnpm install
pnpm run build
```

`<home>` 是内核主目录，即 `yzng init` 所在的那个目录。装完重启内核。

本仓库不发布至 npm，git 里也不含构建产物，故**两步都不能省**。少了 `pnpm install` 则没有
TypeScript 与 Vite；少了 `pnpm run build` 则 `dist/index.js` 不存在，内核找不到入口，插件被
跳过并记一条警告。`build` 同时跑 `tsc -b` 与 `vite build web`，只跑前者会得到一个能加载但整站
404 的插件。

构建之后 `node_modules/` 可以删掉：运行期只需要内核提供的 `@yunzai-ng/core` 与
`@yunzai-ng/types`，其余全是构建期依赖。

::: tip 在主目录之外克隆时
`tsc -b` 会因找不到 `@yunzai-ng/core` 而失败，先跑一次 `pnpm run link:framework`。
装在 `<home>/plugins/` 之下不需要这一步 —— 内核的 `init` / `start` 已把框架包链至
`<home>/node_modules/`，Node 与 tsc 都能自插件目录逐级向上找到它。
:::

## 用面板

访问内核日志里给出的地址（默认 `http://127.0.0.1:2536`），用同一行日志里的令牌登录。

| 页面 | 做什么 |
|---|---|
| 概览 | 运行状态与资源占用；卡片可拖动改版面 |
| 账号 | 添加与登录机器人账号 |
| 日志 | 实时日志，按级别多选筛选 |
| 插件 | 已装插件的启停、配置与详情 |
| 插件市场 | 装 / 更 / 删内核插件 |
| 面板商店 | 装 / 更 / 删面板组件 |
| 配置 | 编辑内核配置 |
| 帮助 | 命令一览与文档入口 |

概览页进入编辑态后卡片可拖动、缩放与移除，版面存在浏览器本地，换设备不会带过去。

只读模式（内核配置 `server.readonly`）下全部写操作被拒绝，面板会隐去相应按钮。

想自己往面板上加组件，见[面板插件](../panel-plugin.md)。

## 关键实现

**产物目录取自 `import.meta.dirname`，不取 `process.cwd()`。** 以服务或 pm2 方式启动时工作目录
并非插件目录。见 `src/index.ts`。

**面板插件只有一处落点**（本插件安装目录下的 `plugins/`）。曾有三路，收敛为一路的理由是：
三处落点意味着「我的组件为什么没出现」有三个要逐一排查的答案。

**目录只在 `setup()` 时挂一次，而清单端点每次请求都重扫。** 于是放进一个新文件后刷新页面即
生效；而 node 侧入口只在 `setup()` 时加载一次，那一半要重载 webui 才生效。这两种情形的下一步
动作不同，故安装结果里用 `hasServer` 分开告知。

**webui 自己的写路由要自行判定只读。** 内核的 `requireWritable()` 只拦 `/api` 之下的请求，管不到
本插件 scope 里的六条写路由（商店四条、面板插件配置两条），故经 `src/coreconfig.ts` 读内核配置的
`server.readonly` 自己拦。同一件事该是同一句话，故 403 的文案与内核那条一致。

**镜像前缀读内核的 `market.mirror`，不自己声明一份。** 国内网络下它是「能不能装上」的前提；
让使用者填两遍，第二遍必然有人忘，而忘的表现是「面板商店连不上，而插件市场是好的」。

## 源码在哪

[Yunzai-NG/webui-plugin](https://github.com/Yunzai-NG/webui-plugin)

| 路径 | 内容 |
|---|---|
| `src/index.ts` | 插件入口、面板挂载、清单与商店路由 |
| `src/panelscan.ts` | 扫描面板插件目录（只看磁盘，不执行 js） |
| `src/panelconfig.ts` | 面板插件包的配置：校验、存取、默认值 |
| `src/panelstore.ts` | 面板商店：索引、装 / 更 / 删 |
| `src/coreconfig.ts` | 读内核配置里的镜像前缀与只读开关 |
| `web/src/` | 前端（Vue 3 + Vite），`views/` 是八个页面 |
| `web/src/panelapi.ts` | 注入给面板插件的 `api` |
| `web/src/panelcheck.ts` | 校验面板插件的形状，错时给出一句可示于界面的原因 |
