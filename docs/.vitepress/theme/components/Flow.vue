<script setup lang="ts">
/**
 * 流程图：一串节点，节点之间是流动的虚线与光点
 *
 * 宽时横排，容器窄于 640px 时竖排（按容器而非视口判断 —— 有侧栏时正文比视口窄得多）。
 * `tone` 给节点换色：core 为橙、ext 为蓝，不给为中性。
 */
import Icon from "./Icon.vue"

export interface FlowStep {
  icon: string
  title: string
  sub?: string
  tone?: "core" | "ext"
}

withDefaults(defineProps<{ steps: FlowStep[]; caption?: string }>(), { caption: "" })
</script>

<template>
  <figure class="flow-wrap">
    <ol class="flow">
      <template v-for="(s, i) in steps" :key="i">
        <li v-if="i > 0" class="wire" aria-hidden="true"><span class="pulse" :style="{ animationDelay: `${i * 0.35}s` }" /></li>
        <li class="node" :class="s.tone">
          <span class="badge"><Icon :name="s.icon" :size="22" /></span>
          <span class="txt">
            <strong>{{ s.title }}</strong>
            <small v-if="s.sub">{{ s.sub }}</small>
          </span>
        </li>
      </template>
    </ol>
    <figcaption v-if="caption">{{ caption }}</figcaption>
  </figure>
</template>

<style scoped>
.flow-wrap {
  container-type: inline-size;
  margin: 24px 0;
}

.flow {
  display: flex;
  align-items: stretch;
  margin: 0;
  padding: 0;
  list-style: none;
}

.flow li {
  margin: 0;
}

.node {
  --n: var(--vp-c-text-2);
  --n-soft: var(--vp-c-default-soft);
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 16px 8px 14px;
  border-radius: var(--yz-radius);
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  text-align: center;
  transition: transform 0.25s, box-shadow 0.25s, border-color 0.25s;
}

.node:hover {
  transform: translateY(-3px);
  border-color: var(--n);
  box-shadow: 0 12px 26px -16px var(--n);
}

.node.core {
  --n: var(--yz-pumpkin);
  --n-soft: var(--yz-pumpkin-soft);
}

.node.ext {
  --n: var(--yz-sky);
  --n-soft: var(--yz-sky-soft);
}

.badge {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  color: var(--n);
  background: var(--n-soft);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--n) 30%, transparent) inset;
}

.txt {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.txt strong {
  font-size: 14px;
  line-height: 1.35;
  color: var(--vp-c-text-1);
}

.txt small {
  font-size: 12px;
  line-height: 1.45;
  color: var(--vp-c-text-2);
}

.wire {
  position: relative;
  flex: 0 0 28px;
  align-self: center;
  height: 2px;
  background: repeating-linear-gradient(90deg, var(--vp-c-divider) 0 6px, transparent 6px 10px);
  overflow: visible;
}

.wire::after {
  content: "";
  position: absolute;
  right: -2px;
  top: -4px;
  border: 5px solid transparent;
  border-left-color: var(--vp-c-divider);
  border-right-width: 0;
}

.pulse {
  position: absolute;
  top: -3px;
  left: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--yz-sky);
  box-shadow: 0 0 10px var(--yz-sky);
  animation: yz-flow 2.1s ease-in-out infinite;
}

@keyframes yz-flow {
  0% {
    left: 0;
    opacity: 0;
  }

  20% {
    opacity: 1;
  }

  80% {
    opacity: 1;
  }

  100% {
    left: calc(100% - 8px);
    opacity: 0;
  }
}

@keyframes yz-flow-v {
  0% {
    top: 0;
    opacity: 0;
  }

  20%,
  80% {
    opacity: 1;
  }

  100% {
    top: calc(100% - 8px);
    opacity: 0;
  }
}

figcaption {
  margin-top: 12px;
  font-size: 13.5px;
  color: var(--vp-c-text-2);
  text-align: center;
}

@container (max-width: 640px) {
  .flow {
    flex-direction: column;
  }

  /*
   * 竖排时文字、连线与光点落在同一条中轴上；图标钉在左侧
   *
   * 图标若跟着文字一起居中，各节点文字长短不一，图标便左右错开、排不成一列。
   */
  .node {
    position: relative;
    flex-direction: row;
    justify-content: center;
    min-height: 64px;
    padding: 12px 64px;
  }

  .badge {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
  }

  .txt {
    align-items: center;
    text-align: center;
    min-width: 0;
  }

  .badge {
    width: 40px;
    height: 40px;
  }

  .wire {
    flex: 0 0 22px;
    width: 2px;
    height: auto;
    align-self: center;
    background: repeating-linear-gradient(180deg, var(--vp-c-divider) 0 5px, transparent 5px 9px);
  }

  .wire::after {
    right: auto;
    left: -4px;
    top: auto;
    bottom: -2px;
    border: 5px solid transparent;
    border-top-color: var(--vp-c-divider);
    border-bottom-width: 0;
  }

  .pulse {
    left: -3px;
    animation-name: yz-flow-v;
  }
}
</style>
