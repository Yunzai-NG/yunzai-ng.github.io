<script setup lang="ts">
/**
 * 首页：英雄区（核心 + 环绕的插件）、性能数字、三步上手、消息流水线、特性、截图、代码、两条路径
 *
 * 动效只用 transform / opacity，进入视口才播；SSR 输出的是终态（数字是真值、区块可见），
 * 挂载后才「藏起来再放出来」，故关掉 JS 或开了「减少动态效果」时看到的是完整静态页。
 * 性能数字取自 perf.md，改那边的基线时同步这里。
 */
import { onMounted, onUnmounted, ref } from "vue"
import Icon from "./Icon.vue"
import Terminal from "./Terminal.vue"
import Flow, { type FlowStep } from "./Flow.vue"
import Shot from "./Shot.vue"

const INSTALL = "npm install @yunzai-ng/cli"

const DEMO = `
# 新建一个文件夹给机器人住
$ mkdir my-bot; cd my-bot
$ npm init -y; npm install @yunzai-ng/cli
added 126 packages in 9s
$ npx yzng init
  已就绪 目录与缺省配置均已建立
? 是否安装官方面板 webui？ 推荐，直接回车即安装 [Y/n]
> Y
✓ 官方面板 webui 已安装
$ npx yzng start
  Yunzai NG 已启动
  面板   http://127.0.0.1:2536/
  令牌   ****************
`

/** 环绕核心的是内核自身的特性，不是插件 —— 插件能做什么由装了谁决定，不是核心的卖点 */
const ORBIT = [
  { icon: "zap", label: "毫秒冷启动" },
  { icon: "layers", label: "一切皆插件" },
  { icon: "replay", label: "确定性回收" },
  { icon: "gauge", label: "零驻留" },
  { icon: "panel", label: "Schema 即表单" },
  { icon: "shield", label: "默认安全" }
]

const STATS = [
  { value: 328, digits: 0, unit: "ms", label: "冷启动（带面板）", note: "0.6.5 时为 2235 ms" },
  { value: 18.0, digits: 1, unit: "MB", label: "启动后 heap（带面板）", note: "纯内核仅 141 ms 启动" },
  { value: 5.3, digits: 1, unit: "万条/秒", label: "纯内核消息吞吐", note: "带四个官方插件约 4.2 万" },
  { value: 0.6, digits: 1, unit: "MB", label: "1 万条消息后的驻留", note: "GC 后 heap 几乎不涨" }
]

const PIPELINE: FlowStep[] = [
  { icon: "qq", title: "聊天平台", sub: "QQ / 官方机器人 / 终端" },
  { icon: "plug", title: "适配器", sub: "翻译成通用事件", tone: "ext" },
  { icon: "filter", title: "中间件", sub: "权限、黑名单、前缀", tone: "core" },
  { icon: "route", title: "命令路由", sub: "按首字分桶匹配", tone: "core" },
  { icon: "box", title: "插件", sub: "你的业务逻辑", tone: "ext" },
  { icon: "image", title: "渲染器", sub: "模板出图", tone: "ext" },
  { icon: "send", title: "回复", sub: "原路发回会话" }
]

const FEATURES = [
  { icon: "zap", title: "毫秒级冷启动", desc: "发布产物由 esbuild 打包，用不到的模块不加载。带面板 328 ms，比 0.6.5 快六倍。" },
  { icon: "layers", title: "一切皆插件", desc: "内核不认识任何聊天平台、不内置任何命令。适配器、面板、渲染器都可以换、可以不装。" },
  { icon: "replay", title: "卸得干干净净", desc: "ctx 上每一项注册都返回 Disposer，卸载插件时命令、定时任务、路由、中间件一并回收。" },
  { icon: "panel", title: "配置即表单", desc: "插件声明一份 configSchema，就同时得到输入校验、面板表单与带注释的 YAML。" },
  { icon: "store", title: "两个商店", desc: "插件市场装内核插件，面板商店装面板组件。国内网络可配镜像前缀。" },
  { icon: "phone", title: "跑在手机上", desc: "Windows、macOS、Linux 与安卓 Termux 都在支持范围，面板移动优先。" },
  { icon: "gauge", title: "不留驻留对象", desc: "1 万条消息处理完、GC 之后 heap 只差 0.5 MB 以内，长跑不涨内存。" },
  { icon: "shield", title: "缺省就安全", desc: "首次启动自动生成访问令牌，只认请求头，不读查询串与 Cookie。" }
]

/** 背景星点：固定种子，SSR 与客户端得到同一组坐标 */
const STARS = (() => {
  let seed = 7
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  return Array.from({ length: 26 }, () => ({
    x: (rand() * 100).toFixed(2),
    y: (rand() * 100).toFixed(2),
    d: (rand() * 6).toFixed(2),
    s: (1 + rand() * 1.6).toFixed(2)
  }))
})()

const root = ref<HTMLElement>()
const shown = ref(STATS.map(s => s.value.toFixed(s.digits)))
const copied = ref(false)
const motion = ref(true)
let io: IntersectionObserver | undefined
const frames: number[] = []

async function copyInstall() {
  try {
    await navigator.clipboard.writeText(INSTALL)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    copied.value = false
  }
}

function countUp() {
  const start = performance.now()
  const tick = (now: number) => {
    const t = Math.min((now - start) / 1500, 1)
    const k = 1 - Math.pow(1 - t, 3)
    shown.value = STATS.map(s => (s.value * k).toFixed(s.digits))
    if (t < 1) frames.push(requestAnimationFrame(tick))
  }
  frames.push(requestAnimationFrame(tick))
}

/** 特性卡片的光斑跟着指针走 */
function glow(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement
  const r = el.getBoundingClientRect()
  el.style.setProperty("--mx", `${e.clientX - r.left}px`)
  el.style.setProperty("--my", `${e.clientY - r.top}px`)
}

onMounted(() => {
  const el = root.value
  if (el === undefined) return
  motion.value = !matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!motion.value || typeof IntersectionObserver === "undefined") return
  el.classList.add("armed")
  io = new IntersectionObserver(
    entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const target = entry.target as HTMLElement
        target.classList.add("in")
        if (target.dataset.count !== undefined) countUp()
        io?.unobserve(target)
      }
    },
    { threshold: 0.18 }
  )
  el.querySelectorAll<HTMLElement>(".rv").forEach(n => io?.observe(n))
})

onUnmounted(() => {
  io?.disconnect()
  frames.forEach(cancelAnimationFrame)
})
</script>

<template>
  <div ref="root" class="yz-home">
    <section class="hero">
      <div class="aurora" aria-hidden="true"><i /><i /><i /></div>
      <div class="floor" aria-hidden="true"><div class="floor-grid" /></div>
      <div class="stars" aria-hidden="true">
        <i v-for="(s, i) in STARS" :key="i" :style="{ left: `${s.x}%`, top: `${s.y}%`, animationDelay: `${s.d}s`, width: `${s.s}px`, height: `${s.s}px` }" />
      </div>

      <div class="hero-in">
        <div class="hero-text">
          <a class="pill" href="/perf">
            <span class="live" />
            0.7 内核 · 冷启动 328 ms
            <Icon name="arrow" :size="14" />
          </a>
          <h1 class="title">
            <span class="brand">Yunzai NG</span>
            <span class="rot" aria-label="可插拔的机器人运行时内核">
              <span class="rot-track" aria-hidden="true">
                <span>可插拔的机器人内核</span>
                <span>毫秒级冷启动</span>
                <span>一切皆插件</span>
                <span>长跑不涨内存</span>
                <span>可插拔的机器人内核</span>
              </span>
            </span>
          </h1>
          <p class="lead">
            内核只做一件事：接收消息、交给插件、发出结果。接入 QQ、面板、出图、业务功能，全都是可以换、可以不装的插件。
          </p>
          <div class="actions">
            <a class="btn primary" href="/getting-started"><Icon name="rocket" :size="18" />快速上手</a>
            <a class="btn ghost" href="/store"><Icon name="store" :size="18" />逛插件商店</a>
            <a class="btn ghost" href="/plugin-api"><Icon name="code" :size="18" />写插件</a>
          </div>
          <button type="button" class="install" :title="copied ? '已复制' : '复制安装命令'" @click="copyInstall">
            <span class="ps">$</span>
            <code>{{ INSTALL }}</code>
            <Icon :name="copied ? 'check' : 'copy'" :size="16" />
          </button>
        </div>

        <div class="visual" aria-hidden="true">
          <div class="halo" />
          <svg class="rings" viewBox="0 0 560 560">
            <circle class="ring r0" cx="280" cy="280" r="250" />
            <g class="spin slow">
              <circle class="ring r1" cx="280" cy="280" r="210" />
            </g>
            <g class="spin rev">
              <circle class="ring r2" cx="280" cy="280" r="150" />
              <circle class="tick" cx="280" cy="130" r="4" />
              <circle class="tick" cx="430" cy="280" r="3" />
              <circle class="tick" cx="130" cy="280" r="3" />
            </g>
            <template v-if="motion">
              <circle class="packet" r="4">
                <animateMotion dur="7s" repeatCount="indefinite" path="M280 70 a210 210 0 1 1 -0.1 0" />
              </circle>
              <circle class="packet cy" r="3.5">
                <animateMotion dur="5s" begin="-2s" repeatCount="indefinite" path="M280 430 a150 150 0 1 1 0.1 0" />
              </circle>
              <circle class="packet" r="3">
                <animateMotion dur="9s" begin="-4s" repeatCount="indefinite" path="M490 280 a210 210 0 1 1 0 0.1" />
              </circle>
            </template>
          </svg>
          <!-- 品牌图形放在内环里；logo-mark 是方形画幅 -->
          <img class="hero-mark" src="/brand/logo-mark.webp" alt="" width="768" height="768" />
          <div class="orbit">
            <span v-for="(c, i) in ORBIT" :key="c.label" class="spoke" :style="{ '--a': `${i * 60}deg`, '--d': `${i * -0.6}s` }" />
            <span v-for="(c, i) in ORBIT" :key="c.icon" class="chip" :style="{ '--a': `${i * 60}deg`, '--d': `${i * -0.4}s` }">
              <span class="chip-in"><Icon :name="c.icon" :size="15" />{{ c.label }}</span>
            </span>
          </div>
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="stats rv" data-count>
        <div v-for="(s, i) in STATS" :key="s.label" class="stat" :style="{ '--i': i }">
          <div class="num"><b>{{ shown[i] }}</b><small>{{ s.unit }}</small></div>
          <div class="lbl">{{ s.label }}</div>
          <div class="note">{{ s.note }}</div>
        </div>
      </div>
      <div class="bench rv">
        <div class="bench-row">
          <span class="bench-k">0.6.5</span>
          <span class="bar old"><i style="--w: 100%" /></span>
          <span class="bench-v">2235 ms</span>
        </div>
        <div class="bench-row">
          <span class="bench-k">0.7.0</span>
          <span class="bar"><i style="--w: 14.7%" /></span>
          <span class="bench-v hi">328 ms</span>
        </div>
        <p class="bench-note">从进程启动到就绪的 CPU 时间中位数，带面板。<a href="/perf">测量方式与复现脚本 →</a></p>
      </div>
    </section>

    <section class="sec">
      <div class="head rv">
        <span class="eyebrow">01 · 上手</span>
        <h2>三条命令，跑起来</h2>
        <p>不用克隆仓库、不用改配置文件。装好 Node.js 与 Git 之后，下面这几行就是全部。</p>
      </div>
      <div class="start rv">
        <ol class="start-steps">
          <li>
            <span class="no">1</span>
            <div><strong>准备环境</strong><p>装 <a href="https://nodejs.org/zh-cn/download" target="_blank" rel="noreferrer">Node.js</a> LTS 与 <a href="https://git-scm.com/downloads" target="_blank" rel="noreferrer">Git</a>，各系统的做法见<a href="/getting-started#准备环境">快速上手</a>。</p></div>
          </li>
          <li>
            <span class="no">2</span>
            <div><strong>装 CLI、初始化</strong><p>一个包带齐内核；<code>init</code> 时直接回车，顺手装上官方面板。</p></div>
          </li>
          <li>
            <span class="no">3</span>
            <div><strong>启动、打开面板</strong><p>浏览器打开终端里给的地址，填入令牌，再去插件市场装上 QQ 适配器。</p></div>
          </li>
        </ol>
        <Terminal class="start-term" title="PowerShell · my-bot" :text="DEMO" animate :speed="1.3" />
      </div>
    </section>

    <section class="sec">
      <div class="head rv">
        <span class="eyebrow">02 · 管线</span>
        <h2>一条消息走过的路</h2>
        <p>橙色是内核，蓝色是插件。内核只负责把消息按顺序交下去，能做什么全看装了哪些插件。</p>
      </div>
      <div class="rv"><Flow :steps="PIPELINE" /></div>
    </section>

    <section class="sec">
      <div class="head rv">
        <span class="eyebrow">03 · 特性</span>
        <h2>为长期运行而设计</h2>
      </div>
      <div class="feats">
        <div v-for="(f, i) in FEATURES" :key="f.title" class="rv" :style="{ '--i': i % 4 }">
          <div class="feat" @pointermove="glow">
            <span class="feat-ic"><Icon :name="f.icon" :size="22" /></span>
            <h3>{{ f.title }}</h3>
            <p>{{ f.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="head rv">
        <span class="eyebrow">04 · 面板</span>
        <h2>点几下就能管好</h2>
        <p>装插件、加账号、改配置、看日志都在浏览器里完成，手机上也一样好用。主题色随你调。</p>
      </div>
      <div class="show rv">
        <div class="show-desk"><Shot name="overview" alt="面板概览页" /></div>
        <div class="show-phone"><Shot name="phone" alt="手机上的面板" frame="phone" /></div>
      </div>
    </section>

    <section class="sec">
      <div class="code rv">
        <div class="code-text">
          <span class="eyebrow">05 · 开发</span>
          <h2>写插件，就是写一个 setup</h2>
          <ul>
            <li><Icon name="check" :size="16" />命令、中间件、定时任务、存储都在 <code>ctx</code> 上</li>
            <li><Icon name="check" :size="16" />声明 schema 即得配置表单，不写前端</li>
            <li><Icon name="check" :size="16" />卸载时内核替你回收全部注册</li>
            <li><Icon name="check" :size="16" />JS 直接跑，TS 编译到 <code>dist/</code></li>
          </ul>
          <a class="btn ghost" href="/plugin-api"><Icon name="book" :size="18" />读插件开发</a>
        </div>
        <div class="code-win">
          <div class="code-bar"><span class="dots"><i /><i /><i /></span><span>plugins/hello/index.ts</span></div>
          <div class="vp-doc code-body"><slot name="code" /></div>
        </div>
      </div>
    </section>

    <section class="sec">
      <div class="paths rv">
        <a class="path" href="/getting-started">
          <span class="path-ic"><Icon name="rocket" :size="24" /></span>
          <span class="eyebrow">我要搭一个机器人</span>
          <strong>快速上手 → 接入 QQ → 装插件</strong>
          <span class="path-desc">按系统一步步来，每一步都有截图与终端示意。半小时内看到机器人回你第一句话。</span>
          <span class="path-go">开始 <Icon name="arrow" :size="16" /></span>
        </a>
        <a class="path dev" href="/plugin-api">
          <span class="path-ic"><Icon name="code" :size="24" /></span>
          <span class="eyebrow">我要写插件</span>
          <strong>插件开发 → 面板插件 → 发布上架</strong>
          <span class="path-desc">从一份可运行的骨架开始，命令、存储、出图、面板组件，一路写到上架插件商店。</span>
          <span class="path-go">开始 <Icon name="arrow" :size="16" /></span>
        </a>
      </div>
    </section>

    <section class="sec">
      <div class="cta rv">
        <div class="cta-in">
          <h2>五分钟，跑起你的第一个机器人</h2>
          <p>Windows、macOS、Linux、安卓手机都行。卡住了先看常见问题。</p>
          <div class="actions center">
            <a class="btn primary" href="/getting-started"><Icon name="rocket" :size="18" />快速上手</a>
            <a class="btn ghost" href="/faq"><Icon name="book" :size="18" />常见问题</a>
            <a class="btn ghost" href="https://github.com/Yunzai-NG" target="_blank" rel="noreferrer"><Icon name="github" :size="18" />GitHub</a>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style>
/* 不加 scoped：首页的选择器都挂在 .yz-home 下，深色要读 html.dark，scoped 写起来全是 :global */
.yz-home {
  --h-a1: rgb(16 186 245 / 16%);
  --h-a2: rgb(74 95 240 / 14%);
  --h-a3: rgb(160 70 247 / 12%);
  --h-grid: rgb(40 50 140 / 14%);
  --h-glass: rgb(255 255 255 / 66%);
  --h-glass-line: rgb(40 50 140 / 12%);
  --h-ring: rgb(74 95 240 / 28%);
  --h-star: rgb(60 70 170 / 45%);
  overflow-x: hidden;
  overflow-x: clip;
}

.dark .yz-home {
  --h-a1: rgb(79 211 251 / 14%);
  --h-a2: rgb(138 155 255 / 15%);
  --h-a3: rgb(196 141 255 / 15%);
  --h-grid: rgb(140 170 255 / 12%);
  --h-glass: rgb(18 24 44 / 62%);
  --h-glass-line: rgb(255 255 255 / 8%);
  --h-ring: rgb(138 155 255 / 26%);
  --h-star: rgb(220 235 255 / 70%);
}

.yz-home a {
  text-decoration: none;
}

.yz-home .eyebrow {
  display: inline-block;
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  font-weight: 600;
  letter-spacing: 0.12em;
  color: var(--yz-sky);
}

/* ─────────────── HERO ─────────────── */

.yz-home .hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  padding: 40px 24px 56px;
}

@media (min-width: 960px) {
  /* 桌面端页头是 fixed 且在首页顶部透明：英雄区上提到页头底下，极光一直铺到窗口顶 */
  .yz-home .hero {
    margin-top: calc(var(--vp-nav-height) * -1);
    padding: calc(var(--vp-nav-height) + 40px) 32px 72px;
  }
}

.yz-home .aurora {
  position: absolute;
  inset: -20% -10% 0;
  z-index: -2;
  pointer-events: none;
}

.yz-home .aurora i {
  position: absolute;
  width: 62vmax;
  height: 62vmax;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--h-a1), transparent);
  left: -12%;
  top: -18%;
  animation: yz-drift 22s ease-in-out infinite alternate;
}

.yz-home .aurora i:nth-child(2) {
  background: radial-gradient(closest-side, var(--h-a2), transparent);
  left: auto;
  right: -16%;
  top: -6%;
  animation-duration: 26s;
  animation-delay: -8s;
}

.yz-home .aurora i:nth-child(3) {
  background: radial-gradient(closest-side, var(--h-a3), transparent);
  left: 26%;
  top: 30%;
  width: 46vmax;
  height: 46vmax;
  animation-duration: 30s;
  animation-delay: -14s;
}

@keyframes yz-drift {
  0% { transform: translate3d(0, 0, 0) scale(1); }
  50% { transform: translate3d(6%, 4%, 0) scale(1.08); }
  100% { transform: translate3d(-4%, 8%, 0) scale(0.96); }
}

/* 透视网格地面：内层比外层高一格，平移一格后回到原位，循环无缝 */
.yz-home .floor {
  position: absolute;
  left: -30%;
  right: -30%;
  bottom: 0;
  height: 46%;
  z-index: -1;
  perspective: 320px;
  overflow: hidden;
  pointer-events: none;
  mask-image: linear-gradient(to top, transparent 0, #000 30%, #000 45%, transparent 92%);
  -webkit-mask-image: linear-gradient(to top, transparent 0, #000 30%, #000 45%, transparent 92%);
}

.yz-home .floor-grid {
  position: absolute;
  inset: -60px 0 0;
  transform: rotateX(62deg);
  transform-origin: 50% 100%;
  background-image:
    linear-gradient(var(--h-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--h-grid) 1px, transparent 1px);
  background-size: 60px 60px;
  animation: yz-floor 4s linear infinite;
}

@keyframes yz-floor {
  from { transform: rotateX(62deg) translateY(0); }
  to { transform: rotateX(62deg) translateY(60px); }
}

.yz-home .stars {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
}

.yz-home .stars i {
  position: absolute;
  border-radius: 50%;
  background: var(--h-star);
  animation: yz-twinkle 4.5s ease-in-out infinite;
}

@keyframes yz-twinkle {
  0%, 100% { opacity: 0.15; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

.yz-home .hero-in {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  align-items: center;
  gap: 32px;
  max-width: 1200px;
  min-height: min(680px, calc(100vh - var(--vp-nav-height) - 80px));
  margin: 0 auto;
}

.yz-home .hero-text {
  animation: yz-rise 0.9s cubic-bezier(0.2, 0.7, 0.2, 1) both;
}

@keyframes yz-rise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: none; }
}

.yz-home .pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 10px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-1);
  background: var(--h-glass);
  border: 1px solid var(--h-glass-line);
  backdrop-filter: blur(10px);
  transition: border-color 0.25s;
}

.yz-home .pill:hover {
  border-color: var(--yz-sky);
}

.yz-home .live {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2fd38a;
  box-shadow: 0 0 0 0 rgb(47 211 138 / 60%);
  animation: yz-ping 2s ease-out infinite;
}

@keyframes yz-ping {
  0% { box-shadow: 0 0 0 0 rgb(47 211 138 / 55%); }
  100% { box-shadow: 0 0 0 10px rgb(47 211 138 / 0%); }
}

.yz-home .title {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 22px 0 18px;
  line-height: 1.1;
  font-weight: 800;
  letter-spacing: -0.02em;
}

.yz-home .brand {
  font-size: clamp(46px, 7vw, 80px);
  /* 沿图标那朵云从青走到紫再回到青，首尾同色才能无缝滚动 */
  background: linear-gradient(110deg, #10b9f5, #4a5ff0 30%, #a046f7 55%, #4a5ff0 80%, #10b9f5);
  background-size: 220% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: yz-sheen 9s linear infinite;
}

@keyframes yz-sheen {
  to { background-position: -220% 0; }
}

.yz-home .rot {
  display: block;
  height: 1.3em;
  overflow: hidden;
  font-size: clamp(24px, 3.4vw, 40px);
  line-height: 1.3;
  color: var(--vp-c-text-1);
}

.yz-home .rot-track {
  display: flex;
  flex-direction: column;
  animation: yz-rot 11s cubic-bezier(0.7, 0, 0.3, 1) infinite;
}

@keyframes yz-rot {
  0%, 18% { transform: translateY(0); }
  22%, 40% { transform: translateY(-20%); }
  44%, 62% { transform: translateY(-40%); }
  66%, 84% { transform: translateY(-60%); }
  88%, 100% { transform: translateY(-80%); }
}

.yz-home .lead {
  max-width: 34em;
  margin: 0 0 28px;
  font-size: clamp(15.5px, 1.5vw, 18px);
  line-height: 1.75;
  color: var(--vp-c-text-2);
}

.yz-home .actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.yz-home .actions.center {
  justify-content: center;
}

.yz-home .btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 46px;
  padding: 0 20px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  transition: transform 0.2s, box-shadow 0.25s, border-color 0.25s, background-color 0.25s;
}

.yz-home .btn:hover {
  transform: translateY(-2px);
}

.yz-home .btn.primary {
  color: #1f0f04;
  background: var(--yz-ember);
  box-shadow: 0 10px 30px -12px rgb(255 151 60 / 70%);
}

.yz-home .btn.primary:hover {
  box-shadow: 0 14px 36px -10px rgb(252 90 79 / 55%);
}

.yz-home .btn.ghost {
  color: var(--vp-c-text-1);
  background: var(--h-glass);
  border: 1px solid var(--h-glass-line);
  backdrop-filter: blur(10px);
}

.yz-home .btn.ghost:hover {
  border-color: var(--vp-c-brand-2);
}

.yz-home .install {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  max-width: 100%;
  margin-top: 22px;
  padding: 10px 14px;
  border-radius: 12px;
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  color: var(--vp-c-text-2);
  background: var(--h-glass);
  border: 1px dashed var(--h-glass-line);
  transition: color 0.2s, border-color 0.2s;
}

.yz-home .install:hover {
  color: var(--vp-c-text-1);
  border-color: var(--yz-sky);
}

.yz-home .install code {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: inherit;
  color: var(--vp-c-text-1);
  background: none;
  padding: 0;
}

.yz-home .install .ps {
  color: var(--yz-brand-2);
}

/* 核心视觉：SVG 画环与核心，HTML 画环上的特性标签；两者同心、同周期旋转，标签就骑在外环上 */
.yz-home .visual {
  position: relative;
  container-type: inline-size;
  width: min(100%, 540px);
  aspect-ratio: 1;
  margin: 0 auto;
  animation: yz-fade 1.2s 0.15s ease-out both;
}

@keyframes yz-fade {
  from { opacity: 0; transform: scale(0.94); }
  to { opacity: 1; transform: none; }
}

.yz-home .halo {
  position: absolute;
  inset: 22%;
  border-radius: 50%;
  background: radial-gradient(closest-side, rgb(255 151 60 / 30%), rgb(74 95 240 / 16%) 58%, transparent);
  animation: yz-breathe 5s ease-in-out infinite;
}

@keyframes yz-breathe {
  0%, 100% { transform: scale(0.92); opacity: 0.75; }
  50% { transform: scale(1.06); opacity: 1; }
}

.yz-home .rings {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.yz-home .ring {
  fill: none;
  stroke: var(--h-ring);
  stroke-width: 1.2;
}

.yz-home .ring.r0 {
  stroke-dasharray: 1 7;
  stroke-width: 2;
  opacity: 0.6;
}

.yz-home .ring.r1 {
  stroke-dasharray: 10 8;
}

.yz-home .ring.r2 {
  stroke-dasharray: 2 6;
  stroke: rgb(16 186 245 / 40%);
  stroke-width: 1.6;
}

.yz-home .tick {
  fill: var(--yz-sky);
}

.yz-home .spin {
  transform-box: view-box;
  transform-origin: 50% 50%;
  animation: yz-spin 60s linear infinite;
}

.yz-home .spin.rev {
  animation-duration: 40s;
  animation-direction: reverse;
}

@keyframes yz-spin {
  to { transform: rotate(360deg); }
}

/*
 * 品牌图形：占内环（直径 300/560）略多一点，上下轻轻浮动
 *
 * 类名别叫 core：本文件的样式不带 scoped，Flow 里 tone="core" 的节点也挂着 core，会被一并抓走。
 */
.yz-home .visual .hero-mark {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 46%;
  height: auto;
  transform: translate(-50%, -50%);
  filter: drop-shadow(0 18px 30px rgb(0 0 0 / 28%));
  animation: yz-float 6s ease-in-out infinite;
}

@keyframes yz-float {
  0%, 100% { transform: translate(-50%, -50%); }
  50% { transform: translate(-50%, calc(-50% - 8px)); }
}

.yz-home .packet {
  fill: #ff973c;
}

.yz-home .packet.cy {
  fill: #10b9f5;
}

.yz-home .orbit {
  position: absolute;
  inset: 0;
  animation: yz-spin 60s linear infinite;
}

.yz-home .spoke {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 37.5cqw;
  height: 1px;
  transform-origin: 0 50%;
  transform: rotate(calc(var(--a) - 90deg));
  background: linear-gradient(90deg, transparent 42%, rgb(16 186 245 / 32%) 80%, transparent);
}

/* 光点沿辐条从外环流向核心 */
.yz-home .spoke::after {
  content: "";
  position: absolute;
  right: 6cqw;
  top: -1.5px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #ff973c;
  box-shadow: 0 0 8px #ff973c;
  animation: yz-inflow 3.6s ease-in infinite;
  animation-delay: var(--d);
}

@keyframes yz-inflow {
  0% { transform: translateX(0); opacity: 0; }
  15% { opacity: 1; }
  85% { opacity: 1; }
  100% { transform: translateX(-15cqw); opacity: 0; }
}

/* 标签：先转到自己的角度、推到外环上，再反转回来；反转量含整圈的旋转，故始终正立 */
.yz-home .chip {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  /* 与关键帧起点相同：动画接管之前（含关掉动画时）标签已经在环上 */
  transform: rotate(var(--a)) translateY(-37.5cqw) rotate(calc(var(--a) * -1));
  animation: yz-chip 60s linear infinite;
}

@keyframes yz-chip {
  from { transform: rotate(var(--a)) translateY(-37.5cqw) rotate(calc(var(--a) * -1)); }
  to { transform: rotate(var(--a)) translateY(-37.5cqw) rotate(calc(var(--a) * -1 - 360deg)); }
}

.yz-home .chip-in {
  position: absolute;
  left: 0;
  top: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0.5em 0.85em;
  border-radius: 999px;
  white-space: nowrap;
  font-size: clamp(11px, 2.5cqw, 13.5px);
  font-weight: 700;
  color: var(--vp-c-text-1);
  background: var(--h-glass);
  border: 1px solid var(--h-glass-line);
  box-shadow: 0 8px 24px -12px rgb(0 0 0 / 40%), 0 0 0 1px rgb(255 255 255 / 4%) inset;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  /*
   * 居中的位移写在静态样式里，延迟取负值
   *
   * 居中只靠 yz-bob 的关键帧时，延迟期间标签没有这层位移，左上角钉在环上、整块偏到右下，
   * 等各自的动画开始才跳回去；负延迟让每个标签一上来就处在浮动周期的中途。
   */
  transform: translate(-50%, -50%);
  animation: yz-bob 4s ease-in-out infinite;
  animation-delay: var(--d);
}

.yz-home .chip-in .yz-icon {
  color: var(--yz-sky);
}

@keyframes yz-bob {
  0%, 100% { transform: translate(-50%, -50%); }
  50% { transform: translate(-50%, calc(-50% - 5px)); }
}

@media (max-width: 959px) {
  .yz-home .hero-in {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    min-height: 0;
    text-align: center;
  }

  .yz-home .visual {
    order: -1;
    width: min(78vw, 400px);
  }

  .yz-home .title {
    align-items: center;
  }

  .yz-home .lead {
    margin-left: auto;
    margin-right: auto;
  }

  .yz-home .actions {
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .yz-home .hero {
    padding: 20px 16px 40px;
  }

  .yz-home .btn {
    height: 44px;
    padding: 0 16px;
    font-size: 14.5px;
  }

  .yz-home .hero .actions .btn {
    flex: 1 1 40%;
    justify-content: center;
  }

  .yz-home .hero .actions .btn.primary {
    flex-basis: 100%;
  }
}

/* ─────────────── 区块通用 ─────────────── */

.yz-home .sec {
  max-width: 1200px;
  margin: 0 auto;
  padding: 56px 24px;
}

.yz-home .head {
  max-width: 720px;
  margin: 0 auto 36px;
  text-align: center;
}

.yz-home h2 {
  margin: 10px 0 12px;
  font-size: clamp(26px, 3.6vw, 38px);
  line-height: 1.25;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: var(--vp-c-text-1);
  border: none;
  padding: 0;
}

.yz-home .head p {
  margin: 0;
  font-size: 16px;
  line-height: 1.75;
  color: var(--vp-c-text-2);
}

/* ─────────────── 性能数字 ─────────────── */

.yz-home .stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-radius: 20px;
  border: 1px solid var(--h-glass-line);
  background: var(--h-glass);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.yz-home .stat {
  padding: 26px 22px 22px;
  border-left: 1px solid var(--h-glass-line);
}

.yz-home .stat:first-child {
  border-left: none;
}

.yz-home .num {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-family: var(--vp-font-family-mono);
}

.yz-home .num b {
  font-size: clamp(34px, 4.4vw, 48px);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  background: linear-gradient(120deg, var(--yz-brand-1), var(--yz-sky));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-variant-numeric: tabular-nums;
}

.yz-home .num small {
  font-size: 14px;
  font-weight: 700;
  color: var(--vp-c-text-2);
}

.yz-home .lbl {
  margin-top: 12px;
  font-size: 15px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.yz-home .note {
  margin-top: 4px;
  font-size: 13px;
  color: var(--vp-c-text-3);
}

.yz-home .bench {
  max-width: 760px;
  margin: 28px auto 0;
}

.yz-home .bench-row {
  display: grid;
  grid-template-columns: 52px 1fr 76px;
  align-items: center;
  gap: 14px;
  margin-bottom: 10px;
  font-family: var(--vp-font-family-mono);
  font-size: 13.5px;
}

.yz-home .bench-k {
  color: var(--vp-c-text-2);
}

.yz-home .bench-v {
  text-align: right;
  color: var(--vp-c-text-2);
}

.yz-home .bench-v.hi {
  font-weight: 800;
  color: var(--yz-sky);
}

.yz-home .bar {
  height: 10px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  overflow: hidden;
}

.yz-home .bar i {
  display: block;
  width: var(--w);
  height: 100%;
  border-radius: inherit;
  background: var(--yz-cloud);
  box-shadow: 0 0 14px rgb(74 95 240 / 45%);
  transform-origin: 0 50%;
}

.yz-home .bar.old i {
  background: var(--vp-c-text-3);
  box-shadow: none;
  opacity: 0.55;
}

.yz-home .bench-note {
  margin: 12px 0 0;
  font-size: 13px;
  text-align: center;
  color: var(--vp-c-text-3);
}

.yz-home .bench-note a,
.yz-home .start-steps a {
  color: var(--vp-c-brand-1);
}

/* ─────────────── 三步上手 ─────────────── */

.yz-home .start {
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  align-items: center;
  gap: 40px;
}

.yz-home .start-steps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.yz-home .start-steps li {
  position: relative;
  display: flex;
  gap: 16px;
  padding-bottom: 26px;
}

.yz-home .start-steps li:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 17px;
  top: 40px;
  bottom: 4px;
  width: 2px;
  background: linear-gradient(var(--yz-brand-2), transparent);
  opacity: 0.5;
}

.yz-home .no {
  display: grid;
  place-items: center;
  flex: none;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-weight: 800;
  color: #ffffff;
  background: var(--yz-cloud);
  box-shadow: 0 0 18px rgb(74 95 240 / 40%);
}

.yz-home .start-steps strong {
  display: block;
  margin-top: 6px;
  font-size: 17px;
  color: var(--vp-c-text-1);
}

.yz-home .start-steps p {
  margin: 6px 0 0;
  font-size: 14.5px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

.yz-home .start-steps code,
.yz-home .code-text code {
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 0.88em;
  background: var(--vp-c-default-soft);
}

.yz-home .start-term {
  margin: 0;
}

/* ─────────────── 特性 ─────────────── */

.yz-home .feats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.yz-home .feat {
  position: relative;
  padding: 24px 22px;
  border-radius: 18px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  overflow: hidden;
  transition: border-color 0.3s, transform 0.3s;
}

/* 指针处的一团光，位置由 pointermove 写进 --mx / --my */
.yz-home .feat::before {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(260px circle at var(--mx, 50%) var(--my, 0%), var(--yz-glow), transparent 65%);
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.yz-home .feat:hover {
  border-color: color-mix(in srgb, var(--yz-brand-2) 55%, var(--vp-c-divider));
  transform: translateY(-3px);
}

.yz-home .feat:hover::before {
  opacity: 1;
}

.yz-home .feat-ic {
  position: relative;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 13px;
  color: var(--yz-brand-1);
  background: linear-gradient(135deg, var(--yz-brand-soft), var(--yz-sky-soft));
  box-shadow: 0 0 0 1px var(--h-glass-line) inset;
}

.yz-home .feat h3 {
  position: relative;
  margin: 16px 0 8px;
  font-size: 17px;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.yz-home .feat p {
  position: relative;
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

/* ─────────────── 截图 ─────────────── */

.yz-home .show {
  position: relative;
  perspective: 1400px;
  padding-bottom: 40px;
}

.yz-home .show-desk {
  width: 86%;
  transform: rotateX(8deg) rotateY(-9deg) rotateZ(1deg);
  transform-origin: 30% 50%;
  transition: transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
}

.yz-home .show:hover .show-desk {
  transform: none;
}

.yz-home .show-desk .shot,
.yz-home .show-phone .shot {
  margin: 0;
}

.yz-home .show-phone {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 25%;
  transform: translateZ(60px) rotateY(-6deg);
  transition: transform 0.7s cubic-bezier(0.2, 0.7, 0.2, 1);
}

.yz-home .show:hover .show-phone {
  transform: translateY(-10px);
}

.yz-home .show-phone .shot.phone .shot-frame {
  width: 100%;
  padding: 7px;
  border-radius: 30px;
}

.yz-home .show-phone .shot.phone .shot-img {
  border-radius: 23px;
}

.yz-home .show::after {
  content: "";
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: 0;
  height: 60px;
  z-index: -1;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--yz-glow), transparent);
  filter: blur(6px);
}

/* ─────────────── 代码 ─────────────── */

.yz-home .code {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  align-items: center;
  gap: 44px;
}

.yz-home .code-text ul {
  margin: 0 0 26px;
  padding: 0;
  list-style: none;
}

.yz-home .code-text li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 12px 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.yz-home .code-text li .yz-icon {
  margin-top: 4px;
  color: #2fd38a;
}

.yz-home .code-win {
  border-radius: 16px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-code-block-bg);
  box-shadow: 0 30px 60px -36px rgb(0 0 0 / 60%), 0 0 50px -30px var(--yz-glow);
  overflow: hidden;
}

.yz-home .code-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 38px;
  padding: 0 14px;
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  color: var(--vp-c-text-3);
  border-bottom: 1px solid var(--vp-c-divider);
}

.yz-home .dots {
  display: inline-flex;
  gap: 7px;
}

.yz-home .dots i {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #ff5f57;
}

.yz-home .dots i:nth-child(2) { background: #febc2e; }
.yz-home .dots i:nth-child(3) { background: #28c840; }

.yz-home .code-body div[class*="language-"] {
  margin: 0 !important;
  border: none !important;
  border-radius: 0 !important;
}

/* ─────────────── 两条路径 ─────────────── */

.yz-home .paths {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.yz-home .path {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 30px 28px 26px;
  border-radius: 20px;
  border: 1px solid var(--vp-c-divider);
  background:
    radial-gradient(120% 90% at 100% 0%, var(--yz-brand-soft), transparent 60%),
    var(--vp-c-bg-soft);
  color: inherit;
  overflow: hidden;
  transition: transform 0.3s, border-color 0.3s, box-shadow 0.3s;
}

.yz-home .path.dev {
  background:
    radial-gradient(120% 90% at 100% 0%, var(--yz-sky-soft), transparent 60%),
    var(--vp-c-bg-soft);
}

.yz-home .path:hover {
  transform: translateY(-4px);
  border-color: var(--yz-brand-2);
  box-shadow: 0 24px 50px -30px var(--yz-glow);
}

.yz-home .path.dev:hover {
  border-color: var(--yz-sky);
}

.yz-home .path-ic {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 15px;
  color: var(--yz-brand-1);
  background: var(--yz-brand-soft);
}

.yz-home .path.dev .path-ic {
  color: var(--yz-sky);
  background: var(--yz-sky-soft);
}

.yz-home .path strong {
  font-size: 20px;
  line-height: 1.4;
  color: var(--vp-c-text-1);
}

.yz-home .path-desc {
  font-size: 14.5px;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

.yz-home .path-go {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-weight: 700;
  color: var(--vp-c-brand-1);
}

/* ─────────────── 收尾 CTA：一圈转动的渐变描边 ─────────────── */

.yz-home .cta {
  position: relative;
  padding: 1.5px;
  border-radius: 24px;
  overflow: hidden;
  isolation: isolate;
}

.yz-home .cta::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 200vmax;
  height: 200vmax;
  margin: -100vmax 0 0 -100vmax;
  z-index: -1;
  background: conic-gradient(from 0deg, transparent 0 55%, #10b9f5 68%, #4a5ff0 78%, #a046f7 88%, transparent 100%);
  animation: yz-spin 7s linear infinite;
}

.yz-home .cta-in {
  padding: 52px 28px;
  border-radius: 23px;
  text-align: center;
  background:
    radial-gradient(70% 120% at 50% 0%, var(--yz-brand-soft), transparent 70%),
    var(--vp-c-bg-soft);
}

.yz-home .cta-in h2 {
  margin-top: 0;
}

.yz-home .cta-in p {
  margin: 0 0 26px;
  font-size: 16px;
  color: var(--vp-c-text-2);
}

/* ─────────────── 进场：SSR 时全显，挂载后（.armed）才先藏起来 ─────────────── */

.yz-home.armed .rv {
  opacity: 0;
  transform: translateY(26px);
  transition: opacity 0.8s cubic-bezier(0.2, 0.7, 0.2, 1), transform 0.8s cubic-bezier(0.2, 0.7, 0.2, 1);
  transition-delay: calc(var(--i, 0) * 90ms);
}

.yz-home.armed .rv.in {
  opacity: 1;
  transform: none;
}

.yz-home.armed .bench .bar i {
  transform: scaleX(0);
  transition: transform 1.4s 0.2s cubic-bezier(0.2, 0.7, 0.2, 1);
}

.yz-home.armed .bench.in .bar i {
  transform: scaleX(1);
}

/* ─────────────── 窄屏 ─────────────── */

@media (max-width: 1100px) {
  .yz-home .feats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 860px) {
  .yz-home .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .yz-home .stat:nth-child(3) {
    border-left: none;
  }

  .yz-home .stat:nth-child(n + 3) {
    border-top: 1px solid var(--h-glass-line);
  }

  .yz-home .start,
  .yz-home .code,
  .yz-home .paths {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
  }

  .yz-home .code-text {
    order: 2;
  }
}

@media (max-width: 640px) {
  .yz-home .sec {
    padding: 40px 16px;
  }

  .yz-home .head {
    margin-bottom: 26px;
  }

  .yz-home .stat {
    padding: 18px 14px 16px;
  }

  .yz-home .num b {
    font-size: 30px;
  }

  .yz-home .num small {
    font-size: 12px;
  }

  .yz-home .lbl {
    font-size: 13.5px;
  }

  .yz-home .note {
    display: none;
  }

  .yz-home .bench-row {
    grid-template-columns: 44px 1fr 64px;
    gap: 10px;
    font-size: 12.5px;
  }

  .yz-home .feats {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }

  .yz-home .feat {
    display: grid;
    grid-template-columns: 46px 1fr;
    column-gap: 14px;
    padding: 18px 16px;
  }

  .yz-home .feat-ic {
    grid-row: span 2;
  }

  .yz-home .feat h3 {
    margin: 2px 0 4px;
    font-size: 16px;
  }

  .yz-home .show-desk {
    width: 100%;
    transform: none;
  }

  .yz-home .show-phone {
    display: none;
  }

  .yz-home .path {
    padding: 24px 20px 22px;
  }

  .yz-home .cta-in {
    padding: 38px 18px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .yz-home .rot-track {
    animation: none;
  }


  .yz-home .show-desk {
    transform: none;
  }
}
</style>
