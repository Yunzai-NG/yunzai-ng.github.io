# 快速开始

本页仅涉及内核的部署。内核不内置适配器、渲染器与业务功能，因此完成本页的步骤后即可启动
并打开面板，但尚不能收发消息 —— 接入聊天平台与渲染出图均由插件承担，见[插件市场](market.md)
与[官方插件](official-plugins.md)。

## 环境要求

| | 最低版本 | 说明 |
|---|---|---|
| Node.js | 20.11 | 使用了 `import.meta.dirname` 等特性 |
| pnpm | 9 | 仅从源码构建时需要；使用安装包时无须此项 |

Windows 与 Android（Termux）均在支持范围内。Termux 上应将存储驱动设为 `json`，
详见[配置与面板](config.md#低内存设备)。

各插件可能引入额外的环境要求（例如渲染器插件需要 Chromium），由插件自行说明；
其缺失不影响内核启动。

## 从源码构建

```powershell
pnpm install
pnpm run build          # 构建内核、CLI、JSX 运行时与类型包
```

框架仓库不包含任何插件，**面板亦是插件**。构建完成后即可启动并打开 `/api`，
但站点根路径尚无人提供 —— 需先安装 `webui` 插件，见[官方插件](official-plugins.md)。

构建前应确认分层约束未被破坏，并一并执行测试：

```powershell
pnpm run verify         # build → check:layering → check:firstrun → typecheck:test → lint → test
```

## 初始化目录

```powershell
node packages\cli\dist\bin.js init
```

该命令输出主目录、配置、数据、日志、插件、临时六个位置。**该操作幂等**，对已长期运行的
实例重复执行同样安全，已存在的文件不会被覆盖。

主目录的选取顺序：`--home` > 环境变量 `YZNG_HOME` > 便携模式（安装目录下存在 `.portable`
文件）> **当前工作目录**。

::: warning 0.1.x 升上来的实例
0.2.0 起默认主目录由系统位置（Windows 的 `%LOCALAPPDATA%\YunzaiNG` 等）改为**当前目录**，
且**刻意不做静默回落** —— 回落会使「默认在当前目录」在任何装过旧版的机器上都不成立。
旧实例仍在原处，`init` / `start` / `doctor` 会把它的位置打印出来；要继续用它，
将 `YZNG_HOME` 指向该目录。

以 Windows 服务、开机自启或 pm2 启动时，工作目录并非项目目录，**必须显式给出 `YZNG_HOME`**，
否则数据会落在启动器所在之处。
:::

## 启动

```powershell
node packages\cli\dist\bin.js start
```

终端输出面板地址。`dev` 与 `start` 的唯一区别是日志级别为 debug。

内核扫描 `<home>/plugins` 与安装包预置的插件目录。开发插件时可经 `--plugins <目录>`
追加扫描目录，多个目录以逗号分隔：

```powershell
node packages\cli\dist\bin.js start --plugins <插件目录>
```

## 面板

默认地址为 `http://127.0.0.1:2536`。缺省配置下不设访问令牌，面板仅接受来自本机的请求，
其余来源一律拒绝。将 `config/yunzai.yaml` 的 `server.host` 改为非本机地址而 `server.token`
仍为空时，启动阶段自动生成一份令牌、写入该配置项并输出至日志；亦可自行在该处指定。

令牌经请求头传递（`Authorization: Bearer <令牌>` 或 `x-yunzai-token`），**不读取查询串
与 Cookie** —— 由此免疫 CSRF，亦不会将令牌留存于浏览器历史与反向代理日志中。

面板含八个页面：概览、账号、日志、插件、插件市场、面板商店、配置、帮助。配置表单并非手写，
而是由各插件声明的 schema 生成，因此插件新增配置项后面板自动出现对应控件。

## 安装插件

内核不预装任何插件。全新安装后插件页为空，此为预期状态。

面板 → 插件市场 → 安装，或将插件置入 `<home>/plugins` 之下。索引文件格式与自建索引的
方式见[插件市场](market.md)；官方插件的清单与各自的配置见[官方插件](official-plugins.md)。

## 环境检查

```powershell
node packages\cli\dist\bin.js doctor
```

该命令检查运行环境版本、主目录与配置、数据三个目录的可写性、原生模块（`classic-level` /
`better-sqlite3`）能否加载、面板端口是否被占用，并输出系统、CPU 与当前常驻内存。
新部署一台主机时应先执行该命令。

插件自身的依赖不在检查范围内 —— 该项属各插件职责，启动后查看其日志即可。

## 常见问题

| 现象 | 原因 |
|---|---|
| 插件页为空 | 尚未安装任何插件。内核不预装插件，须经面板的插件市场安装或置入 `<home>/plugins` |
| 插件报 `ERR_MODULE_NOT_FOUND: @yunzai-ng/core` | 框架包未链接至主目录。`init` / `start` 会自动链接，失败时输出 warn 说明原因 |
| 插件报 `Unknown file extension ".ts"` | TypeScript 插件未编译。入口应指向 `dist/index.js` |
| 面板可打开但无法修改 | `server.readonly` 处于开启状态 |
| 面板无法启动但机器人正常 | 端口被占用。二者相互独立，端口冲突不会导致消息收发中断 |
| 启动后无任何账号 | 需先安装适配器插件，再在面板的账号页添加 |
