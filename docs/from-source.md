# 从源码构建

这条路适用于两种人：要改框架自身，或者想跑在某个尚未发布的提交上。
只是要部署一个机器人的话走[快速开始](getting-started.md)，不必编译。

## 取源码并构建

```powershell
git clone https://github.com/Yunzai-NG/yunzai-ng.git
cd yunzai-ng
pnpm install
pnpm run build          # 构建内核、CLI、JSX 运行时与类型包
```

框架仓库**不包含任何插件，面板也是插件**。构建完成后可以启动并打开 `/api`，但站点根路径还没人提供 ——
要先装 `webui`，见[官方插件](official-plugins.md)。

此后各命令写作 `node packages\cli\dist\bin.js <命令>`，与 [CLI 命令](cli.md)里的 `yzng <命令>` 等价：

```powershell
node packages\cli\dist\bin.js init
node packages\cli\dist\bin.js start --plugins .\plugins
```

## 提交前的校验

```powershell
pnpm run verify
```

它依次跑 `build` → `check:layering` → `check:firstrun` → `typecheck:test` → `lint` → `test`。

| 脚本 | 做什么 |
|---|---|
| `pnpm run build` | `tsc -b`，增量构建 |
| `pnpm run watch` | 监听并增量构建 |
| `pnpm run typecheck` | 只做类型检查，不产出文件 |
| `pnpm run test` | vitest 跑一遍 |
| `pnpm run test:watch` | vitest 监听模式 |
| `pnpm run lint` | ESLint；`lint:fix` 自动修 |
| `pnpm run check:layering` | 校验包之间的依赖方向没被破坏 |
| `pnpm run check:firstrun` | 全新目录冷启动一次，确认首次运行可用 |
| `pnpm run bench:memory` | 内存基线，见[性能基线](perf.md) |

## 包之间的关系

| 包 | 作用 |
|---|---|
| `@yunzai-ng/types` | 纯类型，零依赖的叶子包 |
| `@yunzai-ng/core` | 内核 |
| `@yunzai-ng/jsx` | TSX 模板的运行时 |
| `@yunzai-ng/cli` | `yzng` 命令 |

四个包各自独立编号。仓库根 `package.json` 的 `version` 是**发布编号**（tag 上的那个号），
跟随内核版本，与包版本号不必相同。

## 构建产物过期时的症状

`tsc -b` 是增量构建，**无需重建时什么都不输出** —— 这与「构建完成」在终端上看起来一模一样。
出现下面任一种情形时先比对 `dist` 与 `src` 的修改时间，别急着去追代码：

- 改完代码部署出去，行为仍是旧的
- 日志里出现源码里搜不到的字符串
- 出现一个「按代码不该发生」的缺陷

```powershell
pnpm run build:clean     # 清掉产物
pnpm run build           # 重新完整构建
```

## 在源码树上开发插件

插件放进 `<home>/plugins`，或用 `--plugins` 追加扫描目录：

```powershell
node packages\cli\dist\bin.js dev --plugins .\plugins
```

插件依赖 `@yunzai-ng/core` 与 `@yunzai-ng/types`，两者应声明为 `peerDependencies` ——
运行期由宿主内核提供，插件目录里不该再装一份。插件的 `tsc` 读的是框架的 `dist/*.d.ts`，
所以**框架必须先 `pnpm run build`**，否则插件编译会报一堆凭空缺失的类型。

写插件本身见[插件开发](plugin-api.md)。

## 与 npm 安装的差异

| | npm 安装 | 从源码构建 |
|---|---|---|
| 升级 | `yzng update` | `git pull` + `pnpm install && pnpm run build` |
| 命令 | `yzng <命令>` | `node packages\cli\dist\bin.js <命令>` |
| 框架代码 | `node_modules` 里的发布版 | 工作区里的源码 |

`yzng update` 在源码仓库里不适用，它会给出提示。
