<script setup lang="ts">
/**
 * 按操作系统分页的说明：<OsTabs><template #win>…</template>…</OsTabs>
 *
 * 全站共用一份选择（存 localStorage），在一页选了 macOS，翻到下一页仍是 macOS；
 * 首次访问按 UA 猜一个。SSR 一律先渲 Windows，挂载后再切，免得水合不一致。
 */
import { computed, onMounted, onUnmounted, ref, useSlots } from "vue"
import Icon from "./Icon.vue"

type Os = "win" | "mac" | "linux" | "android"

const ALL: { id: Os; label: string; short: string; icon: string }[] = [
  { id: "win", label: "Windows", short: "Win", icon: "win" },
  { id: "mac", label: "macOS", short: "Mac", icon: "apple" },
  { id: "linux", label: "Linux", short: "Linux", icon: "linux" },
  { id: "android", label: "安卓 Termux", short: "安卓", icon: "android" }
]
const KEY = "yzng-docs-os"
const EVENT = "yzng-docs-os"

const slots = useSlots()
const tabs = computed(() => ALL.filter(t => slots[t.id] !== undefined))
const current = ref<Os>("win")

function guess(): Os {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return "android"
  if (/Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua)) return "mac"
  if (/Linux|X11/i.test(ua)) return "linux"
  return "win"
}

function apply(os: string | null) {
  if (os !== null && tabs.value.some(t => t.id === os)) current.value = os as Os
}

function pick(os: Os) {
  current.value = os
  try {
    localStorage.setItem(KEY, os)
  } catch {
    // 隐私模式下写不进去，只影响「记住选择」
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: os }))
}

function onSync(e: Event) {
  apply((e as CustomEvent<string>).detail)
}

onMounted(() => {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(KEY)
  } catch {
    saved = null
  }
  apply(saved ?? guess())
  window.addEventListener(EVENT, onSync)
})
onUnmounted(() => window.removeEventListener(EVENT, onSync))
</script>

<template>
  <div class="os-tabs">
    <div class="os-bar" role="tablist" aria-label="选择你的系统">
      <button
        v-for="t in tabs"
        :key="t.id"
        type="button"
        role="tab"
        class="os-tab"
        :class="{ on: current === t.id }"
        :aria-selected="current === t.id"
        @click="pick(t.id)"
      >
        <Icon :name="t.icon" :size="17" />
        <span class="long">{{ t.label }}</span>
        <span class="short">{{ t.short }}</span>
      </button>
    </div>
    <div v-for="t in tabs" v-show="current === t.id" :key="t.id" class="os-body" role="tabpanel">
      <slot :name="t.id" />
    </div>
  </div>
</template>

<style scoped>
.os-tabs {
  margin: 20px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: var(--yz-radius);
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.os-bar {
  display: flex;
  gap: 4px;
  padding: 6px;
  overflow-x: auto;
  scrollbar-width: none;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}

.os-bar::-webkit-scrollbar {
  display: none;
}

.os-tab {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  flex: none;
  padding: 7px 14px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  transition: color 0.2s, background-color 0.2s, box-shadow 0.2s;
}

.os-tab:hover {
  color: var(--vp-c-text-1);
}

.os-tab.on {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg);
  box-shadow: 0 0 0 1px var(--vp-c-divider), 0 4px 14px -6px var(--yz-glow);
}

.os-body {
  padding: 4px 20px 8px;
  background: var(--vp-c-bg);
}

.os-body :deep(> :first-child) {
  margin-top: 16px;
}

.short {
  display: none;
}

/* 窄屏四个页签平分一行、换短名，免得最后一个（安卓）被挤出视野 */
@media (max-width: 640px) {
  .os-body {
    padding: 2px 14px 6px;
  }

  .os-tab {
    flex: 1 1 0;
    justify-content: center;
    gap: 5px;
    padding: 7px 4px;
    font-size: 13.5px;
  }

  .long {
    display: none;
  }

  .short {
    display: inline;
  }
}
</style>
