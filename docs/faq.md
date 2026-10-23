---
title: 常见问题
---

# 常见问题

按你卡住的环节找。多数问题先跑一遍 `npx yzng doctor`：它检查 Node 版本、目录权限、配置文件语法、原生模块与端口，并指出哪一项不对，见 [CLI · doctor](/cli#doctor)。

## 安装与启动

| 现象 | 原因与办法 |
|---|---|
| `yzng : 无法将“yzng”项识别为…` / `command not found` | 本地安装时 `yzng` 不在 PATH 上，要写 `npx yzng`，见[为什么是 npx yzng](/getting-started#为什么是-npx-yzng) |
| `无法加载文件 …\npm.ps1，因为在此系统上禁止运行脚本` | PowerShell 的执行策略。执行一次 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`，或改用 `npm.cmd` / `npx.cmd`，或改用 cmd |
| `npx yzng` 问「Need to install the following packages: yzng」 | 不在机器人的文件夹里。**按 n 拒绝**，`cd` 回去再执行 |
| `node` / `git` 不是内部或外部命令 | 没装，或装完没新开终端窗口。见[准备环境](/getting-started#准备环境) |
| `npm install` 很慢或超时 | 换国内镜像：`npm config set registry https://registry.npmmirror.com` |
| `init` 时面板没装上 | 多为网络或没装 Git。初始化本身已完成；给 `market.mirror` 填镜像后在面板里装，或照终端给出的 `git clone` 命令手动装，见 [CLI · 安装官方面板](/cli#安装官方面板) |
| 在子目录里启动后「账号和插件都没了」 | 0.5.0 之前会在那里现建第二个实例。升级后会向上找已有实例；误建的目录可直接删掉 |
| 以服务 / 开机自启方式启动，数据跑到了别处 | 那些场景下工作目录不是项目目录，必须设环境变量 `YZNG_HOME`，见[让它一直跑着](/deploy) |

## 面板

| 现象 | 原因与办法 |
|---|---|
| 浏览器打不开 `127.0.0.1:2536` | 机器人没在跑，或端口被占用（启动日志里有说明）。面板与收发消息相互独立，端口冲突不影响机器人 |
| 打开后只有 `/api`，没有页面 | 没装面板插件 webui。在 `init` 时选装，或照 [CLI · 安装官方面板](/cli#安装官方面板) 补装 |
| 令牌找不到了 | 打开 `config/yunzai.yaml`，`server.token` 就是；也可以直接改成自己记得住的值 |
| 能打开但改不了任何东西 | `server.readonly` 开着 |
| 手机 / 别的电脑打不开 | 缺省只监听本机。改 `server.host` 为 `0.0.0.0` 后重启，见[安装与启动](/getting-started#打开面板) |
| 插件页是空的 | 全新安装的预期状态：内核不预装插件。去插件市场装 |

## 接入 QQ

| 现象 | 原因与办法 |
|---|---|
| 账号页没有「OneBot v11（NapCat / LLOneBot）」页签 | 还没装适配器 adapter-onebot，见[接入 QQ](/first-bot) |
| 账号一直离线 | 对照协议端的网络配置检查：类型是「WebSocket 服务器」、端口一致、两边 Token 一致。协议端在 Docker 或另一台机器上时，见[接入 QQ](/first-bot#以-napcat-为例) 末尾的说明 |
| 用的不是 NapCat / LLOneBot，戳一戳等发不出去 | adapter-onebot 的几项扩展照这两家实现，别的 OneBot v11 协议端可能不支持，见[常见的协议端](/first-bot#常见的协议端) |
| 离线后不再自动重连，日志里也没动静 | 连续失败已达重连上限（日志里有一条 warn）。在账号页点「重连」，或调大上限，见[配置项 · 适配器](/config#适配器-adapter) |
| 在线但发消息不回 | 内核不内置命令。装个功能插件，或用 `npx yzng plugin new hello` 生成一个 `#ping` 来验证 |
| 机器人回复自己的回复，停不下来 | 账号的「忽略自身消息」被关掉了，打开它 |
| 发图片报「文件不存在」 | 协议端不在本机时，把账号的「对端可读取本机文件」关掉 |

## 插件

| 现象 | 原因与办法 |
|---|---|
| 插件报 `ERR_MODULE_NOT_FOUND: @yunzai-ng/core` | 框架包没链接到主目录。`init` / `start` 会自动链接，失败时有 warn 说明原因 |
| 插件报 `Unknown file extension ".ts"` | TypeScript 插件没编译。入口要指向 `dist/index.js`，在插件页点「装依赖并编译」 |
| 编辑器里接口缺字段，运行起来却正常 | 装了两份内核：`package.json` 的 `dependencies` 里单列了 `@yunzai-ng/core`。跑 `npx yzng update` |
| `npm update` 只升了 cli，内核版本没动 | 同上一条 |
| 更新时报「插件市场中没有名为 X 的插件」 | 用了插件的**声明名**而不是安装目录名。内核 0.6.0 起会直接告诉你该用哪个名字 |
| 出图报错、只能回文字 | 没装渲染器 [renderer-puppeteer](/plugins/renderer-puppeteer)；Termux 与 Linux ARM64 上还要自己装 chromium |
| 面板插件装了看不到组件 | 刷新页面；带 node 侧的包要到插件页重载 webui，见[安装与管理插件](/install-plugins#从面板商店装面板插件) |

## 长期运行

| 现象 | 原因与办法 |
|---|---|
| 关掉终端机器人就停了 | 预期如此。要后台运行与开机自启，见[让它一直跑着](/deploy) |
| Windows 上出图时弹出黑框 | 以 pm2 / 服务这类无控制台方式启动所致，见[部署 · 浏览器黑框](/deploy#浏览器黑框-windows) |
| `#关机` 之后又被拉起来 | pm2 没配 `stop_exit_codes: [0]`，见[部署 · pm2](/deploy#用-pm2) |
| Termux 熄屏后机器人掉线 | 安卓杀了后台。通知栏点「Acquire wakelock」，并允许 Termux 后台运行 |
| 内存一直涨 | 先看 heap 而不是 RSS —— RSS 只表示历史最高水位，不会回落，见[性能基线 · 内存](/perf#内存) |

还没解决？到 [GitHub](https://github.com/Yunzai-NG) 对应仓库提 issue，附上 `npx yzng doctor` 的输出与相关日志（`logs/` 目录下，发出前删掉令牌）。
