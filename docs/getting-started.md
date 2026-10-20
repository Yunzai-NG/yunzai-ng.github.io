---
title: 安装与启动
---

<script setup>
const INSTALL = `
# 建一个文件夹给机器人住，路径里最好别带空格和中文
$ mkdir my-bot; cd my-bot
$ npm init -y
Wrote to D:\\Bot\\my-bot\\package.json
$ npm install @yunzai-ng/cli
added 126 packages in 9s
`

const INIT = `
$ npx yzng init

  已就绪 目录与缺省配置均已建立

  主目录 D:\\Bot\\my-bot
  配置   D:\\Bot\\my-bot\\config
  数据   D:\\Bot\\my-bot\\data
  日志   D:\\Bot\\my-bot\\logs
  插件   D:\\Bot\\my-bot\\plugins
  临时   D:\\Bot\\my-bot\\temp

? 是否安装官方面板 webui？ 推荐，直接回车即安装 [Y/n]
>
  正在安装官方面板 webui（git 拉取 + 编译，国内网络下可能要几分钟）…
✓ 官方面板 webui@0.6.0 已安装

  下一步 yzng start 随后访问 http://127.0.0.1:2536/
`

const START = `
$ npx yzng start
  INFO  kernel   Yunzai NG 0.7.0 装配中：windows/x64，Node 22.22.3
  INFO  plugin   插件 webui@0.6.0 已加载
  INFO  server   面板与插件路由已就绪：http://127.0.0.1:2536
  INFO  account  没有已启用的账号，等待在 WebUI 中添加
! WARN  server   已自动生成面板访问令牌：Ab3dEf6hJk9mNp2q
! WARN  server   首次打开面板须填入它。该令牌已写入配置项 server.token，可随时自行修改

  Yunzai NG 已启动

  版本   0.7.0
  主目录 D:\\Bot\\my-bot
  面板   http://127.0.0.1:2536/
  令牌   Ab3dEf6hJk9mNp2q
  账号   尚未配置，请在面板中添加

  Ctrl+C 停机（再次按下则强制退出）
`

const WRONG = `
# 直接敲 yzng：它装在 node_modules 里，不在系统 PATH 上
$ yzng start
yzng : 无法将“yzng”项识别为 cmdlet、函数、脚本文件或可运行程序的名称。
# 正确写法：npx 会先到当前目录的 node_modules/.bin 里找
$ npx yzng start
`

const CHECK = `
# 装完后新开一个终端窗口，确认三样都在
$ node -v
v22.22.0
$ npm -v
10.9.4
$ git --version
git version 2.49.0
`

const POLICY = `
$ npm -v
npm : 无法加载文件 C:\\Program Files\\nodejs\\npm.ps1，因为在此系统上禁止运行脚本。
# 办法一：只对当前用户放开本机脚本，一次设置、以后都不用管（推荐）
$ Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
# 办法二：不改设置，每次都写成 .cmd
$ npm.cmd -v
$ npx.cmd yzng start
`

const WINGET = `
# Windows 10 1809 起自带 winget，两行装完 Node.js 与 Git
$ winget install OpenJS.NodeJS.LTS
$ winget install Git.Git
`

const MAC = `
# 有 Homebrew 的话（没有就用上面的安装包）
$ brew install node git
`

const LINUX = `
# 用 nvm 装 Node.js，不受发行版自带旧版本的限制
$ curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# 关掉终端再开一个，让 nvm 生效
$ nvm install --lts
# Git 用发行版自带的就行（Debian / Ubuntu 用 apt，Fedora 用 dnf）
$ sudo apt install -y git
`

const TERMUX = `
$ pkg update
$ pkg install nodejs-lts git
# 想出图的话还要浏览器（可选，不装也能收发文字）
$ pkg install x11-repo
$ pkg install chromium
`

const STEPS = [
  { icon: 'wrench', title: '准备环境', sub: 'Node.js + Git' },
  { icon: 'box', title: '装 CLI', sub: 'npm install', tone: 'core' },
  { icon: 'sparkles', title: '初始化', sub: 'npx yzng init', tone: 'core' },
  { icon: 'rocket', title: '启动', sub: 'npx yzng start', tone: 'core' },
  { icon: 'panel', title: '打开面板', sub: '填入令牌', tone: 'ext' }
]

const NEXT = [
  { icon: 'qq', title: '接入 QQ', desc: '装适配器、加账号，让机器人回你第一句话', link: '/first-bot' },
  { icon: 'store', title: '安装插件', desc: '插件市场与面板商店怎么用、装在哪', link: '/install-plugins' },
  { icon: 'rocket', title: '让它一直跑着', desc: '开机自启、pm2 / systemd 托管', link: '/deploy' },
  { icon: 'book', title: '常见问题', desc: '装不上、打不开、连不上时先看这里', link: '/faq' }
]
</script>

# 安装与启动

走完本页，你会得到一个**跑着的 Yunzai NG 和一个能打开的管理面板**。接入 QQ 是下一页的事 —— 内核不内置任何聊天平台，那要装一个适配器插件，见[接入 QQ](/first-bot)。

<Flow :steps="STEPS" />

::: tip 没碰过命令行也没关系
本页每一步都给出了要敲的命令和**正常情况下应该看到的输出**。黑框里以 `$` 开头的行是要敲的命令（`$` 本身不用敲），右上角的按钮可以一键复制；其余行是终端的回应，对照着看就知道有没有走对。
:::

## 准备环境

需要两样软件：

| 软件 | 要求 | 用来做什么 |
|---|---|---|
| [Node.js](https://nodejs.org/zh-cn/download) | 20.11 或更新，选 **LTS** 版 | 运行机器人本身。装它会顺带装上 `npm` 与 `npx` |
| [Git](https://git-scm.com/downloads) | 任意较新版本 | 从插件市场安装面板与插件（市场按 Git 仓库拉取） |

选你的系统：

<OsTabs>
<template #win>

1. 打开 [Node.js 下载页](https://nodejs.org/zh-cn/download)，下载 **LTS** 版的 Windows 安装包（`.msi`），一路「下一步」装完。
2. 打开 [Git 下载页](https://git-scm.com/downloads/win)，下载 64 位安装包，同样一路默认装完。
3. 打开**终端**：开始菜单里搜「PowerShell」或「终端」（[Windows Terminal](https://aka.ms/terminal)）。**装完软件后要新开一个窗口**，旧窗口读不到新装的程序。

也可以用系统自带的 [winget](https://learn.microsoft.com/zh-cn/windows/package-manager/winget/) 两行装好：

<Terminal title="PowerShell" :text="WINGET" />

<Terminal title="PowerShell" :text="CHECK" />

::: warning 报「因为在此系统上禁止运行脚本」
这是 PowerShell 的[执行策略](https://learn.microsoft.com/zh-cn/powershell/module/microsoft.powershell.core/about/about_execution_policies)默认不许运行 `npm.ps1` / `npx.ps1` 这类脚本，不是安装出错。二选一：

<Terminal title="PowerShell" :text="POLICY" />

用「命令提示符」（cmd）则没有这个限制，下文的命令在 cmd 里同样可用。
:::

</template>
<template #mac>

1. 打开 [Node.js 下载页](https://nodejs.org/zh-cn/download)，下载 **LTS** 版的 macOS 安装包（`.pkg`）并安装。
2. 打开**终端**（`⌘ 空格` 搜「终端」），敲 `git --version`。没装过 Git 时系统会弹窗提示安装「命令行开发者工具」，点安装即可，里面带着 Git。

用 [Homebrew](https://brew.sh/zh-cn/) 的话一行搞定：

<Terminal title="终端 — zsh" :text="MAC" />

<Terminal title="终端 — zsh" :text="CHECK" />

</template>
<template #linux>

发行版仓库里的 Node.js 往往很旧（Ubuntu 22.04 自带的是 12），推荐用 [nvm](https://github.com/nvm-sh/nvm) 装：

<Terminal title="bash" :text="LINUX" />

不想用 nvm，可以按 [Node.js 下载页](https://nodejs.org/zh-cn/download) 的「包管理器」一栏换官方源安装。

<Terminal title="bash" :text="CHECK" />

</template>
<template #android>

安卓手机上用 [Termux](https://termux.dev/) 跑，它在手机里提供一个 Linux 终端。

1. 从 [F-Droid](https://f-droid.org/packages/com.termux/) 或 [GitHub Releases](https://github.com/termux/termux-app/releases) 安装 Termux。**别装 Google Play 上的旧版**，它的软件源早已停更，装东西会报错。
2. 打开 Termux，装 Node.js 与 Git：

<Terminal title="Termux" :text="TERMUX" />

::: tip 手机上有几处不同
- 存储引擎的原生模块在 Termux 上常编译不过。不影响安装（它们是可选依赖），但请在初始化之后把存储驱动设成 `json`，见[配置项 · 低内存设备](/config#低内存设备)。
- 出图用上面装的 `chromium`，不会自动下载浏览器，见 [renderer-puppeteer](/plugins/renderer-puppeteer)。
- 熄屏后系统可能杀掉 Termux：在通知栏点 Termux 的「Acquire wakelock」，并在系统设置里允许它后台运行。
:::

</template>
</OsTabs>

## 安装

<div class="steps">

### 建文件夹、装 CLI

找一个地方建文件夹（例如 `D:\Bot\my-bot` 或 `~/my-bot`），在里面装 `@yunzai-ng/cli` 这一个包。内核、JSX 运行时与类型包是它的依赖，会一并装上。

<Terminal title="终端" :text="INSTALL" />

::: details 国内网络下 npm 很慢？
给 npm 换一个国内镜像（只影响下载源，不影响装出来的东西）：`npm config set registry https://registry.npmmirror.com`。也可以用 [pnpm](https://pnpm.io/zh/)，下文的 `npm install` 换成 `pnpm add`、`npx` 换成 `pnpm exec` 即可。
:::

::: warning 只装 `@yunzai-ng/cli`
别把 `@yunzai-ng/core` 等几个框架包再单列进 `package.json`。那会把内核锁在某个版本，以后升级时装出两份内核，症状是「编辑器里报错、运行时正常」，很难查。`npx yzng update` 会替你把这几条剪掉。
:::

### 初始化

<Terminal title="终端" :text="INIT" />

它建好六个目录与缺省配置，然后**问一句要不要装官方面板**，直接回车就装。面板也是插件，不装的话启动后只有接口、没有页面。

- 装面板要用 Git 从 GitHub 拉取，国内网络下可能要几分钟；超时或失败**不影响初始化本身**，终端会给出补救办法，详见 [CLI · 安装官方面板](/cli#安装官方面板)。
- 重复执行 `init` 是安全的，已存在的文件不会被覆盖。
- 最后一行提示的是 `yzng start`，在本地安装方式下要写成 `npx yzng start`，原因见[下文](#为什么是-npx-yzng)。

### 启动

<Terminal title="终端" :text="START" />

看到「Yunzai NG 已启动」就成了。**这个终端窗口要一直开着**，关掉它机器人就停了；按 `Ctrl+C` 是正常停机。想让它在后台一直跑、开机自启，见[让它一直跑着](/deploy)。

令牌只在首次启动时生成并打印，**抄下来**，下一步要用。上面那串是示例，你的不一样。

### 打开面板

浏览器访问终端里给的地址（缺省 `http://127.0.0.1:2536`），把令牌粘进去：

<Shot name="login" alt="面板登录页：输入访问令牌" url="127.0.0.1:2536">首次打开时要求填入访问令牌</Shot>

进去之后是概览页：

<Shot name="overview" alt="面板概览页" url="127.0.0.1:2536/#/overview">概览页：版本、运行时间、消息量与硬件状态（图中为演示数据）</Shot>

令牌抄丢了也不要紧：直接打开 `config/yunzai.yaml`，`server.token` 那一项就是；也可以把它改成自己记得住的值。令牌只走请求头，不会出现在网址里。

::: tip 在别的电脑或手机上打开面板
缺省只监听本机（`127.0.0.1`）。要从局域网访问，把 `config/yunzai.yaml` 里的 `server.host` 改成 `0.0.0.0` 并重启，再用这台机器的局域网 IP 访问。面板有全部写权限，暴露到公网前先读[配置项 · 安全姿态](/config#安全姿态)。
:::

</div>

## 为什么是 npx yzng

`yzng` 装在当前文件夹的 `node_modules/.bin/` 里，**不在系统的 PATH 上**，所以直接敲 `yzng` 会说找不到命令。[npx](https://docs.npmjs.com/cli/commands/npx) 的作用就是先去当前目录（及其上级）的 `node_modules/.bin/` 里找：

<Terminal title="终端" :text="WRONG" />

::: warning 要在机器人的文件夹里执行
在别的目录敲 `npx yzng`，npx 找不到本地的 yzng，会问你「Need to install the following packages: yzng」。**这时按 `n` 拒绝**，回到机器人的文件夹再执行 —— 那个同名的包与本项目无关。
:::

::: details 想直接敲 yzng？
可以全局安装：`npm install -g @yunzai-ng/cli`，此后任何目录都能直接 `yzng`。代价是框架与实例目录分开了，`yzng update` 不再适用（要改用 `npm install -g @yunzai-ng/cli@latest` 升级）。一台机器跑多个实例时，更推荐本页的目录内安装。
:::

## 下一步

<LinkCards :items="NEXT" />
