# adapter-stdin

把运行框架的**终端本身当作一个账号**：在终端里敲一行就是一条私聊消息，机器人的回复直接打印回终端。

## 它做什么

用于没有 QQ、没有 NapCat 的环境下调试插件 —— 改完代码敲一条命令，就能看到整条链路（事件 → 中间件 → 命令匹配 → `e.reply()` → 适配器）通没通，不必先接一个真号。

只实现私聊：终端里不存在群，故 `bot.caps` 不含任何群能力，插件用 `bot.caps.has("groupMute")` 一类判定会如实得到 `false`，不会误以为自己在群里。

## 怎么装

插件市场装完即用（索引声明了 `setup.scripts: ["build"]`，装依赖与编译由内核代跑）。装完在**面板的账号页**添加账号、适配器选 `stdin`，或在 `config/adapter-stdin.yaml` 里加：

```yaml
accounts:
  - label: 终端
    uid: console
    enable: true
```

随后在运行内核的那个终端里直接输入即可对话。直接敲回车会打出一行 `系统消息: (空行)` —— 那是「输入这条路通了」的凭据：排查「敲命令没反应」时，有这行说明问题在命令匹配，没有则在终端或适配器。

::: warning 主人权限填的是发件人 id
终端里那个人的 id 固定为 **`console-user`**，与账号自己的 `uid`（默认 `console`）**不是同一个值**，且必须不同 —— 内核的 `bot.ignoreSelf` 会把「发件人 id 等于机器人自身」的消息当自言自语丢掉。要用 `#重启` 一类主人指令，`config/yunzai.yaml` 的 `bot.masterQQ` 里填的是 `console-user`。
:::

## 几处已知行为

- **日志与回复分流**：内核日志走标准输出，本适配器的回复走标准错误。想让终端只剩对话，把标准输出重定向掉（`yzng start > logs/console.log`）。
- **标准输入被重定向时账号报错**：判据是 `process.stdin.isTTY`；管道、`< file`、CI 下不成立，账号进入 `error` 周期重连。出路是 `FORCE_TTY=1` 强制启用，或把该账号 `enable: false`。
- **`Ctrl+C` 是停机不是清行**：它转交给内核的信号处理走优雅停机。想只退出账号用 `Ctrl+D`。
- **pm2 之下用不了**：pm2 没有 TTY，那个「终端账号」连不上。托管前先在面板里停用它。

历史输入的格式与 TRSS-Yunzai 的 `data/stdin/history` 一致，从旧框架迁移可把旧文件用 `historyFile` 指过来。

## 源码在哪

[Yunzai-NG/adapter-stdin](https://github.com/Yunzai-NG/adapter-stdin)
