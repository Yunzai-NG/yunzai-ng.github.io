# 快速开始

装内核、起服务、打开面板。**内核不内置适配器、渲染器与业务功能**，所以走完本页可以打开面板，
但还收发不了消息 —— 接入聊天平台与渲染出图都由插件承担，见[插件市场](market.md)与[官方插件](official-plugins.md)。

要改框架自身或跑在未发布的提交上，走[从源码构建](from-source.md)。

## 环境要求

| | 最低版本 | 说明 |
|---|---|---|
| Node.js | 20.11 | 用到了 `import.meta.dirname` 等特性 |
| pnpm | 9 | 建议但非必需，npm 也行 |

Windows 与 Android（Termux）都在支持范围内。Termux 上把存储驱动设为 `json`，
见[配置与面板](config.md#低内存设备)。

插件可能有额外要求（比如渲染器插件要 Chromium），由插件自己说明；缺了不影响内核启动。

## 安装

建新目录，装 CLI 一个包：

```powershell
mkdir 我的机器人
cd 我的机器人
pnpm init
pnpm add @yunzai-ng/cli
```

::: warning 只装 `@yunzai-ng/cli`
内核、JSX 运行时与类型包是它的依赖，会一并装上，且锁的是**精确版本** —— 四个包必然出自同一次发布。

别把它们再单列进 `dependencies`。那会把内核锁死在某个版本，此后 `pnpm update` 只动得了 `cli`，
而新版 `cli` 依赖新版内核，包管理器只能装两份：编辑器与 `tsc` 从根目录解析到旧的，插件经主目录的链接拿到新的。
症状是**代码里报错、运行时正常**，很难归因。`yzng update` 会替你把这几条剪掉。
:::

装好后 `yzng` 在 `node_modules/.bin/`：

```powershell
pnpm exec yzng --help    # 或 npx yzng --help
```

::: tip 全局安装
`pnpm add -g @yunzai-ng/cli` 也行，此后 `yzng` 直接可用。代价是主目录与安装目录彻底分离，
`yzng update` 找不到安装目录（它会提示改用 `pnpm add -g`）。多实例部署更推荐上面的目录内安装。
:::

## 初始化

```powershell
yzng init
```

输出主目录、配置、数据、日志、插件、临时六个位置。**幂等**，对已长期运行的实例重复执行同样安全，
已存在的文件不会被覆盖。

建好目录后会**问一句是否安装官方面板 webui**（推荐，直接回车即安装）—— 面板是插件而非内核内置，不装的话下一步 `start` 打开只有 `/api`、没有页面。想装第三方面板就选否。`--webui` / `--no-webui` 可跳过询问；细节与国内网络的镜像设置见 [CLI 命令](cli.md#安装官方面板)。

主目录的选取顺序：`--home` > 环境变量 `YZNG_HOME` > 便携模式（安装目录下有 `.portable` 文件）>
**自当前目录向上找到的实例** > 当前工作目录。详见 [CLI 命令](cli.md#全局选项)。

::: warning 以服务方式启动时必须给 YZNG_HOME
Windows 服务、开机自启或 pm2 启动时工作目录并非项目目录，不显式给出 `YZNG_HOME` 的话，
数据会落在启动器所在之处。
:::

## 启动

```powershell
yzng start
```

终端输出面板地址与访问令牌。`dev` 与 `start` 的唯一区别是日志级别为 debug。

`yzng start` 缺省自带进程守护，裸起也能重启与关机（[steward](official-plugins.md) 插件的 `#重启` / `#关机`），无须额外挂 pm2 / systemd；已有外部守护时用 `yzng start --no-supervise`。细节见 [CLI 命令](cli.md#自带进程守护)。

## 打开面板

默认 `http://127.0.0.1:2536`。**首次启动时内核自动生成一份 16 位访问令牌**，写入
`config/yunzai.yaml` 的 `server.token` 并在日志里打印一次 —— 首次打开面板要从终端或日志里把它抄进去。

即使只监听本机也照样生成令牌：浏览器里的任何页面都能向 `127.0.0.1:2536` 发请求，而那就是面板的全部写权限。

令牌抄丢了不必翻日志：面板的令牌页有一枚「发送到日志」，点一下重新打印一遍。也可以直接把
`server.token` 改成自己记得住的值。

令牌走请求头（`Authorization: Bearer <令牌>` 或 `x-yunzai-token`），**不读查询串与 Cookie**。

面板有十个页面：概览、账号、日志、插件、扩展页面、插件市场、面板商店、配置、帮助、外观。
配置表单由各插件声明的 schema 生成，插件新增配置项后面板自动出现对应控件。

## 装插件

内核不预装任何插件，**全新安装后插件页是空的，这是预期状态**。

面板 → 插件市场 → 安装，或把插件放进 `<home>/plugins`。索引格式与自建索引见[插件市场](market.md)；
官方插件的清单见[官方插件](official-plugins.md)。

收发消息至少要一个适配器：

- [adapter-napcat](plugins/adapter-napcat.md) —— 经 NapCat 接入 QQ，需要一个在跑的 NapCat
- [adapter-qqbot](plugins/adapter-qqbot.md) —— QQ 官方机器人，需要在 QQ 开放平台注册

装完在**面板的账号页**添加账号。

## 下一步

- 让它一直跑（开机自启、pm2 / systemd）：[部署与长期运行](deploy.md)
- 检查环境：`yzng doctor`，见 [CLI 命令](cli.md#doctor)
- 升级框架：`yzng update`，见 [CLI 命令](cli.md#update)
- 调内核配置：[配置与面板](config.md)
- 写自己的插件：[插件开发](plugin-api.md)

## 常见问题

| 现象 | 原因 |
|---|---|
| 插件页为空 | 尚未安装任何插件。内核不预装插件，经面板的插件市场安装或放进 `<home>/plugins` |
| 插件报 `ERR_MODULE_NOT_FOUND: @yunzai-ng/core` | 框架包未链接到主目录。`init` / `start` 会自动链接，失败时有 warn 说明原因 |
| 插件报 `Unknown file extension ".ts"` | TypeScript 插件没编译。入口要指向 `dist/index.js` |
| 编辑器里接口缺字段，但运行起来正常 | 装了两份内核。根 `package.json` 的 `dependencies` 里单列了 `@yunzai-ng/core`，跑 `yzng update` |
| `pnpm update` 只升了 `cli`，内核版本没动 | 同上一条 |
| 面板可打开但改不了东西 | `server.readonly` 开着 |
| 面板起不来但机器人正常 | 端口被占用。二者相互独立，端口冲突不会中断消息收发 |
| 启动后没有账号 | 要先装适配器插件，再在面板的账号页添加 |
| 某个账号一直离线，日志里也没动静 | 连续失败已达重连上限，此后不再自动重试（日志里有一条 warn）。面板点「重连」从头再来，或调大上限 —— 见[重连策略](config.md#适配器-adapter) |
| 在子目录里 `yzng start` 之后「账号和插件都没了」 | 0.5.0 之前会在那里现建第二个实例。升级后会向上找已有实例；误建出来的目录可直接删掉 |
| 插件更新时报「插件市场中没有名为 X 的插件」 | 拿插件的**声明名**当目录名请求了。市场按安装目录寻址，两者常常不同 —— 内核 0.6.0 起会直接告诉你该用哪个名字 |
