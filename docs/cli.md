# CLI 命令

装好之后 `yzng` 位于 `node_modules/.bin/`，用 `pnpm exec yzng <命令>` 或 `npx yzng <命令>` 执行；
全局安装则直接 `yzng <命令>`。从源码构建的仓库里写作 `node packages\cli\dist\bin.js <命令>`。

不带命令、`yzng help`、`yzng -h` 都输出帮助并以 0 退出。命令名写错时输出「未知命令」并以 1 退出。

## 命令一览

| 命令 | 做什么 |
|---|---|
| [`init`](#init) | 生成主目录与缺省配置，不启动 |
| [`start`](#start) | 启动机器人与面板 |
| [`dev`](#dev) | 同 `start`，日志级别为 debug |
| [`doctor`](#doctor) | 环境自检：版本、目录、原生模块、端口 |
| [`update`](#update) | 把四个框架包整套升到同一版本 |
| [`plugin new`](#plugin-new) | 生成一份可直接运行的插件骨架 |

## 全局选项

| 选项 | 说明 |
|---|---|
| `-c, --home <目录>` | 指定主目录，等价于环境变量 `YZNG_HOME` |
| `-d, --debug` | 启动期日志级别设为 debug；出错时额外打印完整调用栈 |
| `-v, --version` | 输出 CLI 版本号 |
| `-h, --help` | 输出帮助 |

主目录的选取顺序：`--home` > `YZNG_HOME` > 便携模式（安装目录下有 `.portable` 文件）>
自当前目录向上找到的实例 > 当前工作目录。嵌套时就近者胜。

::: warning 以服务、开机自启或 pm2 启动时必须显式给 YZNG_HOME
那些场景下工作目录不是项目目录，不指定的话数据会落在启动器所在之处。
:::

要在一个实例的子目录里另开一个实例，得显式写 `--home .` 或设 `YZNG_HOME`，否则会被认作上层那一个。

### 参数书写的两条规则

只有 `--home` `--plugins` `--port` `--host` `--to` 会把下一个词当成自己的值，其余选项一律是布尔开关。
给清单外的选项传值要用等号：

```powershell
yzng start --some-flag=值
```

`--no-` 前缀把开关置为 false（`--no-console`、`--no-prune`）。`--` 之后的内容原样透传给下游，不解析：

```powershell
yzng plugin new demo -- --raw
```

短选项可合并写成 `-dv`，合并时只有最后一个字母可能带值。以横杠开头的值要写成 `--home=-x`。

## init

生成主目录、配置、数据、日志、插件、临时六个位置并把它们打印出来，不启动运行时。

```powershell
yzng init
```

**幂等**：对已长期运行的实例重复执行同样安全，已存在的文件不会被覆盖。

选项：`--home`。

## start

启动机器人与面板，终端输出面板地址与访问令牌。

```powershell
yzng start
yzng start --plugins .\plugins            # 追加扫描目录
yzng start --plugins .\a,.\b              # 多个目录用逗号分隔
yzng start --no-console                   # 只写日志文件，不输出到终端
```

| 选项 | 说明 |
|---|---|
| `--plugins <目录>` | 在内置扫描目录之外追加，多个以逗号分隔 |
| `--no-console` | 仅写入日志文件，以服务方式运行时用 |
| `-d, --debug` | 启动期日志级别设为 debug |

内核扫描 `<home>/plugins` 与安装包预置的插件目录。全新安装后插件页为空是预期状态 ——
内核不预装任何插件，包括面板。

::: tip 首次启动的令牌
内核自动生成一份访问令牌，写入 `config/yunzai.yaml` 的 `server.token` 并在日志里打印一次。
抄丢了不必翻日志：面板令牌页有一枚「发送到日志」可重新打印一遍，也可以直接把 `server.token`
改成自己记得住的值。
:::

## dev

同 `start`，日志级别固定为 debug。

```powershell
yzng dev
```

**不含文件监听自动重载。** 改完插件代码在面板的插件页点重载，无须重启整个进程。

## doctor

新部署一台主机时先跑这条。它检查运行环境版本、主目录与配置、数据三个目录的可写性、
原生模块（`classic-level` / `better-sqlite3`）能否加载、面板端口是否被占用，并输出系统、
CPU 与当前常驻内存。

```powershell
yzng doctor
yzng doctor --port 3000
```

| 选项 | 说明 |
|---|---|
| `--port <端口>` | 改探测的端口 |
| `--host <地址>` | 改探测的监听地址 |
| `--home <目录>` | 检查指定主目录 |

插件自身的依赖不在检查范围内，那属各插件职责，启动后看它们的日志。

## update

把 `cli` 升级一次，另外三个包由它的精确依赖带上来，随后打印四个包升级前后的版本对照。

```powershell
yzng update                # 升到最新
yzng update --to 0.4.2     # 升到指定版本
yzng update --to next      # dist-tag
```

| 选项 | 说明 |
|---|---|
| `--to <版本>` | 目标版本或 dist-tag，缺省 `latest` |
| `--no-prune` | 保留 `package.json` 里单列的框架依赖 |

::: warning --to 收的是 cli 的版本号
四个包各自独立编号，`cli` 现为 0.5.0 而内核是 0.6.0。该选项**只接受 dist-tag
（`latest` / `next`）与具体版本，不接受 `^` `~` `>` 一类范围** —— Windows 上 `pnpm` / `npm`
是 `.cmd`，那几个字符会被 shell 当成转义与重定向。
:::

它自当前目录逐级向上找到装着 `@yunzai-ng/cli` 的目录，在那里升级。若根 `package.json` 的
`dependencies` 里单列了 `core` / `types` / `jsx`，会先把它们剪掉并说明原因；要保留原样加
`--no-prune`。`devDependencies` 里的一律不动 —— 本地写 TypeScript 插件时那是给编译器用的。

**升级后须重新 `yzng start`**：主目录里指向框架的链接在启动时按新版本重建。用 TypeScript
写的插件也要各自重新编译，否则仍是编译于旧类型、运行于新内核。

以下两种情形不适用本命令，它会给出对应提示：

| 安装方式 | 改用 |
|---|---|
| 从源码构建 | `git pull` 后 `pnpm install && pnpm run build` |
| 全局安装 | `pnpm add -g @yunzai-ng/cli@latest` |

::: tip 报「已是 latest 对应的版本」而你确知有新内核
多半是发布方只发了 `core` 没发 `cli`，那种版本装不到。这一条现由框架的发布流水线拦着。
:::

## plugin new

在 `<home>/plugins/<名称>` 下生成一份可直接运行的插件骨架（`index.js` + `package.json`）。

```powershell
yzng plugin new my-plugin
```

生成的是 **JavaScript**，带注释，含一条 `#ping` 命令与一份配置 schema。文件末尾注明了改用
TypeScript 的方式（编译至 `dist/index.js`）。

名称须以字母开头，只含字母、数字与 `.` `-` `_` —— 它同时是配置文件名与存储命名空间，
所以约束比目录名严。

**绝不覆盖已存在的目录**：目标已存在时报错退出，不动其中任何文件。

选项：`--home`。

生成后 `yzng dev`，向机器人发送 `#ping` 即可看到回复。接着读[插件开发](/plugin-api)。

## 退出码

| 码 | 含义 |
|---|---|
| 0 | 成功，含 `--help` 与 `--version` |
| 1 | 未知命令、参数用法错误，或命令自身失败 |

出错时只打印一行消息；加 `--debug` 才输出完整调用栈。
