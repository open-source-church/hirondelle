<template>
  <div
    class="h-editor"
    @click.self="selected = []"
    >
    <div class="h-background" :style="styles"
    @wheel.self="e => PZ.mouseWheel(e, _graph.view)"
    @pointermove.stop.self="e => PZ.onPointerMove(e, _graph.view)"
    @pointerdown.stop.self="e => PZ.onPointerDown(e, _graph.view)"
    @pointerup.stop.self="PZ.onPointerUp"
    ></div>
    <!-- Nodes -->
    <div class="h-node-container" :style="transformStyle">
      <HNode v-for="(n, i) in _graph.nodes" :key="'node'+i" :node="n"
        v-touch-pan.prevent.mouse="e => PZ.move(e, selected.includes(n) ? selected : [n], _graph.view)"
        :class="selected.includes(n) ? 'selected' : ''"
        @click.ctrl.stop="selected = _.xor(selected, [n])"
        @click.exact.stop="selected = [n]" />
    </div>
    <!-- Connections -->
    <svg class="h-connections-container" :style="transformStyle">
      <HConnection v-for="(c, i) in _graph.connections" :key="'connection'+i" :connection="c" />
    </svg>
  </div>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useHirondelle } from "./hirondelle.js"
import { useMovePanZoom } from "./movePanZoom.js"
import HNode from "src/hirondelle/HNode.vue"
import HConnection from "src/hirondelle/HConnection.vue"
import _ from "lodash"

const H = useHirondelle()
const PZ = useMovePanZoom()

const props = defineProps({
  graph: { type: Object, required: false }
})
const _graph = computed(() => props.graph)

const selected = ref([])

const transformStyle = computed(() => ({
  "transform-origin": "0 0",
  "transform": `scale(${_graph.value.view.scaling})
  translate(${_graph.value.view.panning.x}px, ${_graph.value.view.panning.y}px)`
}))

// Background
const gridSize = 100
const subGridSize = 20
const styles = computed(() => {
  const view = _graph.value.view
  return {
    backgroundPosition: `left ${view.panning.x * view.scaling}px top ${view.panning.y * view.scaling}px`,
    backgroundSize: `${gridSize * view.scaling}px ${gridSize * view.scaling}px,
                     ${gridSize * view.scaling}px ${gridSize * view.scaling}px,
                     ${subGridSize * view.scaling}px ${subGridSize * view.scaling}px,
                     ${subGridSize * view.scaling}px ${subGridSize * view.scaling}px`
  }
})


const color = "#222222"
const lineColor = "#333333"

</script>

<style lang="scss">

.h-editor {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  outline: none !important;
  touch-action: none;

  .h-background {
    background-color: v-bind("color");
    background-image: linear-gradient(v-bind("lineColor") 2px, transparent 2px),
        linear-gradient(90deg, v-bind("lineColor") 2px, transparent 2px),
        linear-gradient(v-bind("lineColor") 1px, transparent 1px),
        linear-gradient(90deg, v-bind("lineColor") 1px, transparent 1px);
    background-repeat: repeat;
    width: 100%;
    height: 100%;
  }

  .h-node-container {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
  }

  .selected {
    border: 1px solid #00ffdd;
  }

  .h-connections-container {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
  }

  .h-node {
    position: fixed;
  }
}

</style>
