<script setup lang="ts">
/**
 * 面板截图：/screens/<name>-light|dark.webp 一对，跟随站点深浅色切换
 *
 * 截图取自脱敏的演示数据（假账号、假路径），不是真实实例。点图放大用原生 <dialog>，
 * 不必另挂到 body 上。宽高写死在这里，图片未到时先占好位置、不跳版。
 */
import { computed, ref } from "vue"
import { useData } from "vitepress"
import Icon from "./Icon.vue"

const SIZES: Record<string, [number, number]> = {
  login: [1600, 950],
  overview: [1800, 1225],
  market: [1800, 1125],
  plugins: [1800, 1125],
  store: [1800, 1075],
  accounts: [1800, 1225],
  config: [1800, 1125],
  "theme-classic": [1800, 1350],
  "theme-pumpkin": [1800, 1225],
  "theme-pumpkin-login": [1600, 950],
  phone: [780, 1688]
}

const props = withDefaults(
  defineProps<{ name: string; alt: string; frame?: "browser" | "phone" | "none"; url?: string }>(),
  { frame: "browser", url: "127.0.0.1:2536" }
)

const { isDark } = useData()
const size = computed(() => SIZES[props.name] ?? [1600, 1000])
const src = (theme: "light" | "dark") => `/screens/${props.name}-${theme}.webp`
const dialog = ref<HTMLDialogElement>()
const open = ref(false)

function zoom() {
  open.value = true
  dialog.value?.showModal()
}

function close() {
  dialog.value?.close()
}
</script>

<template>
  <figure class="shot" :class="frame">
    <div class="shot-frame">
      <div v-if="frame === 'browser'" class="shot-bar" aria-hidden="true">
        <span class="dots"><i /><i /><i /></span>
        <span class="addr"><Icon name="shield" :size="12" />{{ url }}</span>
      </div>
      <button type="button" class="shot-img" :aria-label="`放大查看：${alt}`" @click="zoom">
        <img class="only-light" :src="src('light')" :alt="alt" :width="size[0]" :height="size[1]" loading="lazy" decoding="async" />
        <img class="only-dark" :src="src('dark')" :alt="alt" :width="size[0]" :height="size[1]" loading="lazy" decoding="async" />
        <span class="zoom-hint"><Icon name="image" :size="14" />点击放大</span>
      </button>
    </div>
    <figcaption v-if="$slots.default"><slot /></figcaption>
    <dialog ref="dialog" class="shot-box" @click="close" @close="open = false">
      <img v-if="open" :src="src(isDark ? 'dark' : 'light')" :alt="alt" />
      <span class="shot-close">点击任意处或按 Esc 关闭</span>
    </dialog>
  </figure>
</template>

<style scoped>
.shot {
  margin: 24px 0;
}

.shot-frame {
  position: relative;
  border-radius: var(--yz-radius);
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  box-shadow: 0 24px 50px -30px rgb(0 0 0 / 45%), 0 0 0 1px rgb(255 255 255 / 3%) inset;
}

.dark .shot-frame {
  box-shadow: 0 30px 60px -34px rgb(0 0 0 / 85%), 0 0 40px -20px var(--yz-glow);
}

.shot.phone {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.shot.phone .shot-frame {
  width: min(300px, 78%);
  padding: 10px;
  border-radius: 38px;
  background: linear-gradient(160deg, #2a2f3d, #12151d);
  border-color: #3a4152;
}

.shot.phone .shot-img {
  border-radius: 28px;
  overflow: hidden;
}

.shot-bar {
  display: flex;
  align-items: center;
  gap: 14px;
  height: 34px;
  padding: 0 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-alt);
}

.dots {
  display: inline-flex;
  gap: 6px;
}

.dots i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #ff5f57;
}

.dots i:nth-child(2) {
  background: #febc2e;
}

.dots i:nth-child(3) {
  background: #28c840;
}

.addr {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  max-width: 340px;
  height: 22px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 11.5px;
  font-family: var(--vp-font-family-mono);
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  overflow: hidden;
  white-space: nowrap;
}

.shot-img {
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  cursor: zoom-in;
}

.shot-img img {
  width: 100%;
  height: auto;
  border-radius: 0;
}

.only-dark,
.dark .only-light {
  display: none;
}

.dark .only-dark {
  display: block;
}

.zoom-hint {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #fff;
  background: rgb(10 14 22 / 72%);
  backdrop-filter: blur(6px);
  opacity: 0;
  transform: translateY(4px);
  transition: opacity 0.2s, transform 0.2s;
}

.shot-img:hover .zoom-hint,
.shot-img:focus-visible .zoom-hint {
  opacity: 1;
  transform: none;
}

figcaption {
  margin-top: 10px;
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
  text-align: center;
}

.shot-box {
  max-width: 96vw;
  max-height: 96vh;
  padding: 0;
  border: none;
  border-radius: 12px;
  background: transparent;
  cursor: zoom-out;
  overflow: visible;
}

.shot-box::backdrop {
  background: rgb(5 7 12 / 82%);
  backdrop-filter: blur(4px);
}

.shot-box img {
  display: block;
  max-width: 96vw;
  max-height: calc(96vh - 30px);
  border-radius: 12px;
}

.shot-close {
  display: block;
  margin-top: 8px;
  font-size: 12px;
  color: #c9d1e3;
  text-align: center;
}
</style>
