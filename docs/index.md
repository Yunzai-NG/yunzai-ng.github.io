---
layout: home

hero:
  name: Yunzai NG
  text: 可插拔的机器人运行时内核
  tagline: 内核只承担一项职责：接收消息、交由插件处理、发出结果。除此之外的一切均由插件实现。
  actions:
    - theme: brand
      text: 快速开始
      link: /getting-started
    - theme: alt
      text: 插件开发
      link: /plugin-api
    - theme: alt
      text: 框架说明
      link: /architecture

features:
  - title: 内核不依赖任何插件
    details: 内核代码中不存在指向 plugins 目录的模块引用。该不变量由 CI 门禁（pnpm check:layering）在每次提交时校验，不依赖开发约定维持。
  - title: 平台接入由插件承担
    details: 适配器、渲染器、存储驱动与业务功能均位于内核之外。内核不感知任何聊天平台，亦不内置任何命令。
  - title: 注册资源可确定性回收
    details: ctx 上的每一项注册均返回 Disposer。卸载插件时，内核据此回收其注册的命令、定时任务、路由与中间件。
  - title: 配置声明的三重用途
    details: configSchema 同时用于校验用户输入、生成面板表单与输出带注释的 YAML。插件新增配置项后，面板中的对应控件随之出现。
  - title: 面板表单由 schema 生成
    details: 配置表单并非手工编写。插件声明 configSchema 后即获得对应表单，无须改动前端代码。
  - title: 覆盖移动端部署
    details: Windows 与 Android（Termux）均在支持范围内。面板采用移动优先布局，存储与渲染在低内存设备上提供对应的降级路径。
---

## 文档索引

| 需求 | 文档 |
|---|---|
| 安装并启动 | [快速开始](./getting-started) |
| 安装官方适配器与渲染器 | [官方插件](./official-plugins) |
| 调整配置、启用面板、加固安全 | [配置与面板](./config) |
| 开发插件 | [插件开发](./plugin-api) |
| 为面板添加组件或页签 | [面板插件](./panel-plugin) |
| 接入新的聊天平台 | [适配器开发](./adapter) |
| 更换渲染方式或编写模板 | [渲染与模板](./renderer) |
| 发布插件或自建插件索引 | [插件市场](./market) |
| 了解重写动因与内核分层 | [框架说明](./architecture) |
| 迁移既有 Miao-Yunzai 插件 | [从 Miao-Yunzai 迁移](./migration) |
| 了解内存占用 | [性能基线](./perf) |

## 插件结构示例

```ts
import { definePlugin, s } from "@yunzai-ng/core"

export default definePlugin({
  name: "hello",
  configSchema: s.object({
    greeting: s.string().default("你好").title("问候语")
  }),
  setup(ctx) {
    // 命令：字符串为前缀匹配，内核按首字符分桶，不逐条尝试正则
    ctx.command("#你好", { desc: "发送问候", cooldown: "3s" })
      .action(async e => { await e.reply(ctx.config.get().greeting) })

    // 中间件：Koa 语义。游戏前缀识别一类的处理属插件职责，不属内核
    ctx.middleware(async (e, next) => { await next() }, { kind: "message" })

    // 定时任务：上一轮未完成时缺省跳过本轮，不会堆积
    ctx.cron("0 0 8 * * *", () => { ctx.logger.info("早上好") })

    // 存储：已按插件名隔离，无须自行拼接键前缀
    return async () => { await ctx.kv.set("bye", Date.now()) }
  }
})
```

插件可执行的每项操作均为 `ctx` 上的一个方法，**每项注册均返回 Disposer**，因此卸载插件时
内核能够确定性地回收其占用的全部资源。框架不提供 `global.Bot`、`global.plugin` 与
`global.segment` 等全局对象。
