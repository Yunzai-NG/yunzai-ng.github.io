# 测试与发布

## 测试

`@yunzai-ng/core/testing` 是插件作者唯一可以 import 的内部子路径。不用起真内核就能测命令：

```ts
import { createMockAdapter } from "@yunzai-ng/core/testing"

const mock = createMockAdapter()
app.runtime.adapters.register(mock.provider, "test-plugin")
await app.runtime.accounts.create("mock", { selfId: "10000" })

mock.driver.receivePrivate("#ping")
await mock.waitForSend()
expect(mock.texts).toEqual(["pong"])
```

`createMockAdapter(opts?)` 的 opts：`id`、`platform`、`caps`、`failConnect`、`callApi`。
返回值：

| | |
|---|---|
| `provider` / `driver` / `drivers` | 注册用的提供方与驱动 |
| `sent` / `texts` / `recalled` / `calls` | 发出去了什么、撤回了什么、调了哪些 API |
| `waitForSend(条数?, 超时ms?)` | 等发送发生 |
| `last()` / `reset()` | 取最后一条 / 清空 |

更小粒度的单元测试另有 `fakeLogger`、`recordingHooks`、`fakeAppView`、`fakeHttp`。

::: tip 测试要钉时区
凡是按本地时区算日期键或小时桶的用例，本机全绿而 CI 必红（GitHub runner 是 UTC）。
在 `vitest.config.ts` 里钉住：`test: { env: { TZ: "Asia/Shanghai" } }`。
:::

TSX 模板是纯函数，可以直接快照测，不需要浏览器：

```ts
expect(Note(view).html).toMatchSnapshot()
```

## 用 TypeScript 写

编译到 `dist/index.js`，`package.json` 里声明 `"main": "dist/index.js"`。

`@yunzai-ng/core` 与 `@yunzai-ng/types` 声明为 `peerDependencies` —— 运行期由宿主内核提供，
插件目录里不该再装一份。

::: warning TS2742: The inferred type of 'default' cannot be named
仓库开了 `declaration` 时会遇到。给默认导出显式标注类型：

```ts
import type { PluginDefinition } from "@yunzai-ng/types"

const plugin: PluginDefinition<MyConfig> = definePlugin({ … })
export default plugin
```

`MyConfig` 就是 `configSchema` 推出来的类型（`Infer<typeof 你的 schema>`）；
没声明 `configSchema` 时写 `PluginDefinition<Record<string, never>>`。
:::

## 发布到插件市场

市场按索引文件找插件。往 [plugin-index](https://github.com/Yunzai-NG/plugin-index) 提一条：

```json
{
  "name": "my-plugin",
  "description": "一句话说明",
  "author": "你",
  "homepage": "https://github.com/你/my-plugin",
  "minCore": "0.4.0",
  "install": {
    "type": "git",
    "url": "https://github.com/你/my-plugin"
  }
}
```

几条硬约束：

| | |
|---|---|
| `name` | **就是安装目录名**，不必等于 `definePlugin` 里的声明名 |
| `install.url` | 只能是 `http://` 或 `https://`，SSH 地址填不得 |
| `minCore` | 填**真正必需**的那个版本，不是当前最新版 |

::: warning name 填错的后果
市场按 `plugins/<name>` 寻址，插件宿主按 `definePlugin({ name })` 寻址，两者本就常常不同。
把索引里的 `name` 「修」成声明名，会让市场装到一个新目录、同时不再认得已装的那些 ——
界面上表现为「已安装」变回「未安装」。
:::

TypeScript 插件的 `dist/` 通常不进 git，那就在索引里声明装后要跑的脚本：

```json
"setup": { "scripts": ["build"] }
```

内核会代跑包管理器与编译，使用者装完即可用。

改完在仓库目录内跑 `node scripts/validate.mjs` 校验。索引格式的全部字段见[插件市场](../market.md)。

## 手工安装

不进市场也能用。让使用者克隆到主目录的 `plugins/` 下：

```powershell
cd <主目录>\plugins
git clone https://github.com/你/my-plugin.git
cd my-plugin
pnpm install
pnpm run build
```

然后在面板的插件页重载，或重启内核。

## 注释规范

官方插件仓库统一这套口径，由 `eslint-plugin-jsdoc` 在 CI 强制。自己的插件不必照办，
但读官方插件源码时会看到：

- 每个文件开头四行块：模块职责 / 依赖方向 / 生命周期 / 注意事项
- 每个导出符号一句话 TSDoc，带 `@param` / `@returns` / `@throws`
- 非常规做法要写**原因**，而不是重复代码在做什么

## 下一步

- [插件市场](../market.md) —— 索引格式、镜像与自建索引
- [框架说明](../architecture.md) —— 分层约束与各子系统职责
