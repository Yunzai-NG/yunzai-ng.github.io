<script setup lang="ts">
/**
 * 插件商店 —— 版式仿 NoneBot 插件商店（大标题 + 计数 + 搜索 + 筛选栏 + 卡片网格），
 * 皮肤换成本站主题：强调色走 `--vp-c-brand-*`，卡片走 `--vp-c-bg-soft` 与分隔线。
 *
 * 数据直接读[插件索引](plugin-index 仓库)，与面板内的插件市场同源。客户端拉取，
 * jsDelivr → GitHub raw 顺序回退；SSR 期只渲染骨架，fetch 在 onMounted。
 */
import { ref, onMounted, computed } from "vue"

interface Entry {
  name: string
  title?: string
  description?: string
  author?: string
  version?: string
  homepage?: string
  tags?: string[]
  official?: boolean
  minCore?: string
  minWebui?: string
  widgets?: number
}

/** 索引所在仓库；两个 JSON 都在其根部 */
const REPO = "yunzai-ng/plugin-index"
/** 取源候选，按序回退 */
const bases = [`https://cdn.jsdelivr.net/gh/${REPO}@main`, `https://raw.githubusercontent.com/${REPO}/main`]

const loading = ref(true)
const failed = ref(false)
const plugins = ref<Entry[]>([])
const panels = ref<Entry[]>([])

/** 当前页签：内核插件 / 面板插件 */
const tab = ref<"core" | "panel">("core")
/** 搜索词 */
const query = ref("")
/** 已选标签（与搜索、仅官方叠加） */
const activeTags = ref<string[]>([])
/** 只看官方 */
const officialOnly = ref(false)
/** 排序：默认（官方在前按名） / 名称 */
const sort = ref<"default" | "name">("default")

/**
 * 依次尝试各取源，第一个成功的即返回
 * @param file 索引文件名
 * @returns 解析后的 JSON
 */
async function fetchJson(file: string): Promise<any> {
  let lastErr: unknown
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/${file}`, { cache: "no-cache" })
      if (res.ok) return await res.json()
      lastErr = new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

onMounted(async () => {
  try {
    const [idx, webui] = await Promise.all([fetchJson("index.json"), fetchJson("webui_index.json")])
    plugins.value = Array.isArray(idx?.plugins) ? idx.plugins : []
    panels.value = Array.isArray(webui?.panels) ? webui.panels : []
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})

/** 切页签时清掉只对上一份有意义的标签筛选 */
function switchTab(next: "core" | "panel"): void {
  tab.value = next
  activeTags.value = []
}

/** 切换一个标签的选中态 */
function toggleTag(t: string): void {
  activeTags.value = activeTags.value.includes(t) ? activeTags.value.filter(x => x !== t) : [...activeTags.value, t]
}

/** 当前页签的原始列表 */
const source = computed(() => (tab.value === "core" ? plugins.value : panels.value))

/** 当前页签里出现过的标签，按出现次数降序 */
const allTags = computed(() => {
  const count = new Map<string, number>()
  for (const p of source.value) for (const t of p.tags ?? []) count.set(t, (count.get(t) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
})

/** 过滤 + 排序后的列表 */
const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  let list = source.value.filter(p => {
    if (officialOnly.value && p.official !== true) return false
    if (activeTags.value.length > 0 && !activeTags.value.every(t => (p.tags ?? []).includes(t))) return false
    if (q === "") return true
    const hay = `${p.name} ${p.title ?? ""} ${p.description ?? ""} ${p.author ?? ""} ${(p.tags ?? []).join(" ")}`
    return hay.toLowerCase().includes(q)
  })
  list = [...list].sort((a, b) =>
    sort.value === "name"
      ? a.name.localeCompare(b.name)
      : Number(b.official) - Number(a.official) || a.name.localeCompare(b.name)
  )
  return list
})

const total = computed(() => plugins.value.length + panels.value.length)
</script>

<template>
  <div class="store">
    <p v-if="loading" class="hint">正在从插件索引加载…</p>

    <p v-else-if="failed" class="hint err">
      加载失败 —— 可能是网络限制。可在
      <a href="https://github.com/Yunzai-NG/plugin-index" target="_blank" rel="noreferrer">plugin-index 仓库</a>
      查看，或到面板内的插件市场浏览。
    </p>

    <template v-else>
      <p class="count">
        当前共有 <b>{{ total }}</b> 个插件，数据取自
        <a href="https://github.com/Yunzai-NG/plugin-index" target="_blank" rel="noreferrer">插件索引</a>，
        与面板内的插件市场同源
      </p>

      <div class="tabs">
        <button class="tab" :class="{ on: tab === 'core' }" @click="switchTab('core')">内核插件 · {{ plugins.length }}</button>
        <button class="tab" :class="{ on: tab === 'panel' }" @click="switchTab('panel')">面板插件 · {{ panels.length }}</button>
      </div>

      <div class="toolbar">
        <div class="search">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
          </svg>
          <input v-model="query" type="search" placeholder="搜索名称、描述、作者、标签" />
        </div>
        <label class="toggle"><input type="checkbox" v-model="officialOnly" /> 仅官方</label>
        <select v-model="sort" class="sort">
          <option value="default">默认顺序</option>
          <option value="name">按名称</option>
        </select>
        <a class="publish" href="https://github.com/Yunzai-NG/plugin-index" target="_blank" rel="noreferrer">＋ 上架插件</a>
      </div>

      <div v-if="allTags.length" class="tagbar">
        <button
          v-for="t in allTags"
          :key="t"
          class="chip"
          :class="{ on: activeTags.includes(t) }"
          @click="toggleTag(t)"
        >{{ t }}</button>
      </div>

      <!-- APPEND-GRID -->
      <div class="grid">
        <a
          v-for="p in shown"
          :key="p.name"
          class="card"
          :href="p.homepage"
          target="_blank"
          rel="noreferrer"
        >
          <div class="c-top">
            <span class="c-title">{{ p.title || p.name }}</span>
            <span v-if="p.official" class="badge">官方</span>
            <svg class="ext" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 3h7v7M21 3l-9 9M5 5v14h14v-6" />
            </svg>
          </div>
          <code class="c-name">{{ p.name }}</code>
          <p class="c-desc">{{ p.description }}</p>
          <div v-if="p.tags?.length" class="c-tags">
            <span v-for="t in p.tags" :key="t" class="tag">{{ t }}</span>
          </div>
          <div class="c-foot">
            <svg class="gh" viewBox="0 0 16 16" width="15" height="15" fill="currentColor" aria-label="仓库">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 014 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span class="spacer" />
            <span v-if="p.version" class="ver">v{{ p.version }}</span>
            <span v-if="p.author" class="author">{{ p.author }}</span>
          </div>
        </a>
        <p v-if="shown.length === 0" class="hint empty">没有匹配的插件</p>
      </div>

    </template>
  </div>
</template>

<style scoped>
.hint {
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
.hint.err {
  color: var(--vp-c-danger-1);
}
.hint.empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 32px 0;
}
.count {
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
  margin: 4px 0 16px;
}
.count b {
  color: var(--vp-c-brand-1);
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.tab {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.tab.on {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.search {
  flex: 1 1 240px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 40px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-3);
}
.search:focus-within {
  border-color: var(--vp-c-brand-1);
}
.search input {
  flex: 1;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: 0.9rem;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  cursor: pointer;
  user-select: none;
}
.sort {
  height: 40px;
  padding: 0 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 0.85rem;
  cursor: pointer;
}
.publish {
  height: 40px;
  display: inline-flex;
  align-items: center;
  padding: 0 16px;
  border-radius: 10px;
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white, #fff);
  font-size: 0.85rem;
  font-weight: 600;
  text-decoration: none !important;
  transition: background 0.15s;
}
.publish:hover {
  background: var(--vp-c-brand-2);
}

.tagbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.chip {
  padding: 3px 10px;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}
.chip.on {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

/* APPEND-STYLE-2 */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}
.card {
  display: flex;
  flex-direction: column;
  padding: 16px 18px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  text-decoration: none !important;
  color: inherit;
  transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
}
.card:hover {
  border-color: var(--vp-c-brand-1);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
}
.c-top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.c-title {
  font-weight: 600;
  font-size: 1.02rem;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.badge {
  flex: none;
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
.ext {
  margin-left: auto;
  flex: none;
  color: var(--vp-c-text-3);
}
.card:hover .ext {
  color: var(--vp-c-brand-1);
}
.c-name {
  margin-top: 3px;
  font-size: 0.74rem;
  color: var(--vp-c-text-3);
}
.c-desc {
  margin: 10px 0 12px;
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.c-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.tag {
  font-size: 0.7rem;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
}
.c-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-3);
  font-size: 0.75rem;
}
.c-foot .spacer {
  flex: 1;
}
.c-foot .author {
  color: var(--vp-c-text-2);
  max-width: 45%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>


