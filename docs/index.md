---
layout: home
markdownStyles: false
title: Yunzai NG
titleTemplate: 可插拔的机器人运行时内核
---

<HomePage>
<template #code>

```ts
import { definePlugin, s } from "@yunzai-ng/core"

export default definePlugin({
  name: "hello",
  // 一份 schema = 输入校验 + 面板表单 + 带注释的 YAML
  configSchema: s.object({
    greeting: s.string().default("你好").title("问候语")
  }),
  setup(ctx) {
    ctx.command("#你好", { desc: "发送问候", cooldown: "3s" })
      .action(async e => { await e.reply(ctx.config.get().greeting) })

    // 上一轮没跑完时缺省跳过本轮，不会堆积
    ctx.cron("0 0 8 * * *", () => ctx.logger.info("早上好"))
  }
})
```

</template>
</HomePage>
