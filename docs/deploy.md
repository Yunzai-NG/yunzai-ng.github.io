---
title: 部署与长期运行
---

# 部署与长期运行

让机器人一直跑着、掉线能自动回来，有三条路。**多数人用缺省的自带守护即可**，不必装任何东西；要开机自启、集中管理多实例，再交给 pm2 或 systemd。

| 方式 | 适合 | 重启 / 关机 | 备注 |
|---|---|---|---|
| 自带守护（缺省） | 单机、手边有终端 | 开箱即用 | Windows 上不弹[浏览器黑框](#浏览器黑框-windows) |
| pm2 | 要开机自启、跨平台集中管理 | 需配 `stop_exit_codes` | 无 TTY，标准输入适配器用不了 |
| systemd | Linux 服务器 | 需配 `RestartPreventExitStatus` | —— |

三者都要让内核找得到主目录：以服务 / 开机自启方式启动时工作目录不是项目目录，**务必显式给 `YZNG_HOME`**（或 `--home`），否则数据会落在启动器所在之处。

## 自带守护（缺省，推荐）

从 CLI 0.6.0 起 `yzng start` 自带进程守护，裸起也能 `#重启` / `#关机`，无须外挂。细节见 [CLI · 自带进程守护](/cli#自带进程守护)。

开机自启只需把 `yzng start` 交给系统的启动项 / 计划任务即可。但那样启动它就**没有控制台**了，Windows 上出图会弹黑框 —— 见[下文](#浏览器黑框-windows)。

## 用 pm2

```powershell
pnpm add -g pm2        # 或 npm i -g pm2
```

在实例目录写 `ecosystem.config.cjs`：

<!-- APPEND-PM2 -->
```js
// ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: "yunzai-ng",
      script: "node_modules/@yunzai-ng/cli/dist/bin.js",
      args: "start",
      cwd: "C:\\path\\to\\instance",
      autorestart: true,
      stop_exit_codes: [0], // #关机 以退出码 0 退出，配了它 pm2 才不把关机当崩溃拉起
      restart_delay: 3000,
      max_memory_restart: "1G",
      env: { YZNG_HOME: "C:\\path\\to\\instance" }
    }
  ]
}
```

```powershell
pm2 start ecosystem.config.cjs
pm2 logs yunzai-ng
pm2 save                 # 记住进程列表，配合 pm2 startup 开机自启
```

要点：

- **不会套两层守护。** `yzng start` 探测到 pm2 注入的 `pm_id` 会自动退回单进程，把守护交给 pm2，故 `args` 写 `start` 即可；想显式关掉自带那层也可写 `"start --no-supervise"`。
- **`stop_exit_codes: [0]` 必配**，否则 `#关机` 关掉后会被 pm2 立刻拉起来（pm2 默认对任何退出码都重启）。`#重启` 走退出码 75，非零，照常触发重启。
- **标准输入适配器（adapter-stdin）在 pm2 之下用不了** —— pm2 没有 TTY。托管前在面板里停用它。
- Windows 上会弹[浏览器黑框](#浏览器黑框-windows)。

## 用 systemd

```ini
# /etc/systemd/system/yunzai-ng.service
[Unit]
Description=Yunzai NG
After=network.target

[Service]
Type=simple
User=yunzai
WorkingDirectory=/home/yunzai
Environment=YZNG_HOME=/home/yunzai
ExecStart=/usr/bin/yzng start --no-supervise
Restart=always
RestartPreventExitStatus=0

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now yunzai-ng
journalctl -u yunzai-ng -f
```

要点：

- **`--no-supervise`**：systemd 就是守护，不必再套自带那层。
- **`Restart=always` + `RestartPreventExitStatus=0`**：`#重启` 退 75（非零）会被拉起；`#关机` 退 0，被这一行拦住不再拉起。若用 `Restart=on-failure` 则天然不拉零退出，可不写这一行。

## 浏览器黑框（Windows）

**现象**：以 pm2 / Windows 服务 / 计划任务这类**没有控制台**的方式启动时，出图会弹出一个黑色终端窗口（渲染器的 `chrome-headless-shell`）。而在终端里 `yzng start` 不会。

**原因**：是 Windows 的控制台继承，不是缺陷。`chrome-headless-shell` 是控制台子系统程序，要不要自己的窗口只看**拉起它的进程有没有控制台**：终端里启动时它继承终端的控制台，不弹新窗口；无控制台启动时（pm2 / 服务），系统给它新开一个控制台，那就是黑框。

**规避**（任选其一）：

1. **从终端用 `yzng start`**（缺省自带守护）—— 父进程有控制台，子进程与浏览器一路继承，不弹框。这是最省事的一条。
2. **把 pm2 装成 Windows 服务**（如 `pm2-installer`）—— 进程跑在会话 0，窗口不显示在桌面上。
3. **进阶：外接浏览器。** 自己用隐藏窗口的方式起一个带远程调试端口的 Chromium，再在 renderer-puppeteer 的 `wsEndpoint` 里连它（见[渲染器](/plugins/renderer-puppeteer)）。

::: tip 一句话
黑框只出现在「拉起链顶端没有控制台」时。自带守护从终端起 = 有控制台 = 不弹；pm2 / 服务 = 无控制台 = 弹。
:::
