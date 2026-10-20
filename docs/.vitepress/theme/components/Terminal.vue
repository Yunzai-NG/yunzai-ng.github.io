<script setup lang="ts">
/**
 * 终端示意：一段文本，按行首记号区分角色
 *
 *   `$ ` 要敲的命令（复制按钮只复制这些行）  `# ` 注释  `✓ ` 成功  `! ` 警告
 *   `? ` 提问  `> ` 回车后的输入  其余为普通输出
 *
 * 正文写在页面的 <script setup> 里再传进来，免得多行属性被 markdown 拆开。
 * `animate` 时进入视口才逐字打出命令、逐行吐出输出；SSR 与减少动态效果时直接全显。
 */
import { computed, onMounted, onUnmounted, ref } from "vue"
import Icon from "./Icon.vue"

const props = withDefaults(
  defineProps<{ text: string; title?: string; prompt?: string; animate?: boolean; speed?: number }>(),
  { title: "终端", prompt: "$", animate: false, speed: 1 }
)

type Kind = "cmd" | "note" | "ok" | "warn" | "ask" | "input" | "out"
interface Row {
  kind: Kind
  body: string
}

const MARKS: [string, Kind][] = [
  ["$ ", "cmd"],
  ["# ", "note"],
  ["✓ ", "ok"],
  ["! ", "warn"],
  ["? ", "ask"],
  ["> ", "input"]
]

const rows = computed<Row[]>(() =>
  props.text
    .replace(/^\n+|\s+$/g, "")
    .split("\n")
    .map(line => {
      const hit = MARKS.find(([mark]) => line.startsWith(mark))
      return hit ? { kind: hit[1], body: line.slice(hit[0].length) } : { kind: "out", body: line }
    })
)

/** 输出里的网址单独着色 */
function pieces(text: string): { url: boolean; text: string }[] {
  return text
    .split(/(https?:\/\/[^\s，。）]+)/)
    .filter(p => p !== "")
    .map(p => ({ url: /^https?:\/\//.test(p), text: p }))
}

// shown：已出现的行数；typed：正在打的那行已打出的字数（-1 表示整行出现）
const shown = ref(Number.POSITIVE_INFINITY)
const typed = ref(-1)
const playing = ref(false)
const root = ref<HTMLElement>()
let timer: ReturnType<typeof setTimeout> | undefined
let io: IntersectionObserver | undefined

function stop() {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
}

function step(i: number) {
  if (i >= rows.value.length) {
    shown.value = Number.POSITIVE_INFINITY
    typed.value = -1
    playing.value = false
    return
  }
  const row = rows.value[i]
  shown.value = i
  if (row.kind === "cmd" || row.kind === "input") {
    typed.value = 0
    const tick = () => {
      typed.value += 1
      if (typed.value < row.body.length) timer = setTimeout(tick, (28 + Math.random() * 40) / props.speed)
      else timer = setTimeout(() => ((typed.value = -1), step(i + 1)), 380 / props.speed)
    }
    timer = setTimeout(tick, 260 / props.speed)
  } else {
    typed.value = -1
    timer = setTimeout(() => step(i + 1), (row.body === "" ? 60 : 120) / props.speed)
  }
}

function play() {
  stop()
  playing.value = true
  step(0)
}

function visible(i: number): boolean {
  return i < shown.value || (i === shown.value && typed.value >= 0) || shown.value === Number.POSITIVE_INFINITY
}

function textOf(row: Row, i: number): string {
  return i === shown.value && typed.value >= 0 ? row.body.slice(0, typed.value) : row.body
}

const copied = ref(false)
const commands = computed(() => rows.value.filter(r => r.kind === "cmd").map(r => r.body))

async function copy() {
  try {
    await navigator.clipboard.writeText(commands.value.join("\n"))
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    copied.value = false
  }
}

onMounted(() => {
  if (!props.animate || matchMedia("(prefers-reduced-motion: reduce)").matches || root.value === undefined) return
  shown.value = -1
  io = new IntersectionObserver(
    entries => {
      if (entries.some(e => e.isIntersecting)) {
        io?.disconnect()
        play()
      }
    },
    { threshold: 0.35 }
  )
  io.observe(root.value)
})

onUnmounted(() => {
  stop()
  io?.disconnect()
})
</script>

<template>
  <div ref="root" class="term" :class="{ playing }">
    <div class="term-bar">
      <span class="dots" aria-hidden="true"><i /><i /><i /></span>
      <span class="term-title">{{ title }}</span>
      <span class="term-tools">
        <button v-if="animate" type="button" class="term-btn" title="重放" aria-label="重放动画" @click="play">
          <Icon name="replay" :size="15" />
        </button>
        <button
          v-if="commands.length > 0"
          type="button"
          class="term-btn"
          :title="copied ? '已复制' : '复制命令'"
          :aria-label="copied ? '已复制' : '复制命令'"
          @click="copy"
        >
          <Icon :name="copied ? 'check' : 'copy'" :size="15" />
        </button>
      </span>
    </div>
    <pre class="term-body"><code><span
      v-for="(row, i) in rows"
      :key="i"
      class="row"
      :class="[row.kind, { hide: !visible(i) }]"
    ><span v-if="row.kind === 'cmd'" class="ps">{{ prompt }} </span><span v-else-if="row.kind === 'ok'" class="mk">✓ </span><span v-else-if="row.kind === 'warn'" class="mk">! </span><template v-if="row.kind === 'out'"><template v-for="(p, j) in pieces(textOf(row, i))" :key="j"><span v-if="p.url" class="url">{{ p.text }}</span><template v-else>{{ p.text }}</template></template></template><template v-else>{{ textOf(row, i) }}</template><span v-if="i === shown && typed >= 0" class="caret" /></span></code></pre>
  </div>
</template>

<style scoped>
.term {
  --t-bg: #0d111b;
  --t-bar: #141a28;
  --t-line: #232b3d;
  --t-text: #c9d1e3;
  --t-dim: #6f7a93;
  margin: 20px 0;
  border-radius: var(--yz-radius);
  overflow: hidden;
  background: var(--t-bg);
  border: 1px solid var(--t-line);
  box-shadow: 0 18px 40px -24px rgb(0 0 0 / 55%), 0 0 0 1px rgb(255 255 255 / 2%) inset;
  text-align: left;
}

.term-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 38px;
  padding: 0 10px 0 14px;
  background: var(--t-bar);
  border-bottom: 1px solid var(--t-line);
}

.dots {
  display: inline-flex;
  gap: 7px;
}

.dots i {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #ff5f57;
}

.dots i:nth-child(2) {
  background: #febc2e;
}

.dots i:nth-child(3) {
  background: #28c840;
}

.term-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 12.5px;
  color: var(--t-dim);
  font-family: var(--vp-font-family-mono);
}

.term-tools {
  display: inline-flex;
  gap: 2px;
}

.term-btn {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--t-dim);
  transition: color 0.2s, background-color 0.2s;
}

.term-btn:hover {
  color: #f0d8a8;
  background: rgb(255 255 255 / 6%);
}

.term-body {
  margin: 0;
  padding: 14px 18px 16px;
  overflow-x: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--t-text);
  white-space: pre-wrap;
  word-break: break-word;
  background: transparent;
}

.term-body code {
  display: block;
  padding: 0;
  font-size: inherit;
  color: inherit;
  background: none;
}

.row {
  display: block;
  min-height: 1.75em;
}

.row.hide {
  visibility: hidden;
}

.ps {
  color: #f0d8a8;
  user-select: none;
}

.cmd {
  color: #f4f6fb;
}

.note {
  color: var(--t-dim);
  font-style: italic;
}

.note::before {
  content: "# ";
}

.ok {
  color: #5ee2a0;
}

.warn {
  color: #f5c46b;
}

.ask {
  color: #8fd9ff;
}

.ask::before {
  content: "? ";
  color: #4fd6e8;
  font-weight: 700;
}

.input {
  color: #f4f6fb;
}

.input::before {
  content: "› ";
  color: #4fd6e8;
}

.mk {
  font-weight: 700;
}

.url {
  color: #4fd6e8;
  text-decoration: underline;
  text-decoration-color: rgb(79 214 232 / 40%);
  text-underline-offset: 3px;
}

.caret {
  display: inline-block;
  width: 0.55em;
  height: 1.15em;
  margin-left: 1px;
  vertical-align: -0.2em;
  background: #f0d8a8;
  animation: yz-caret 1s steps(1) infinite;
}

@keyframes yz-caret {
  50% {
    opacity: 0;
  }
}

@media (max-width: 640px) {
  .term-body {
    padding: 12px 14px 14px;
    font-size: 12.5px;
  }
}
</style>
