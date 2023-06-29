<template>
  <div
    class="h-editor"
    @wheel.self="e => PZ.mouseWheel(e, _graph.view)"
    @pointermove.self="e => PZ.onPointerMove(e, _graph.view)"
    @pointerdown.self="e => PZ.onPointerDown(e, _graph.view)"
    @pointerup.self="PZ.onPointerUp"
    @click="selected = []"
  >
    <div class="absolute-top-left">
      <q-breadcrumbs>
        <q-breadcrumbs-el v-for="b in breadcrumbs" :key="b.id" :label="b.type?.title || 'Root'" @click="setParent(b)"/>
      </q-breadcrumbs>
    </div>
    <div class="absolute-left items-center row">
    </div>
    <div class="absolute-left items-center row rotate-270" v-if="parentNode.parent">
      <q-btn flat dense icon="circle" color="red" />
      <span class="absolute q-ml-lg text-grey no-pointer-events	" style="min-width: 200px;" > Group Input</span>
    </div>
    <div class="absolute-right items-center row rotate-270" v-if="parentNode.parent">
      <q-btn flat dense  icon="circle" color="red" />
      <span class="absolute q-ml-lg text-grey no-pointer-events	" style="min-width: 200px;" > Group Output</span>
    </div>
    <div class="h-background no-pointer-events" :style="styles"
    ></div>
    <!-- Nodes -->
    <div class="h-node-container" :style="transformStyle">
      <HNode v-for="(n, i) in parentNode.nodes" :key="'node'+i" :node="n"
        v-touch-pan.prevent.mouse="e => PZ.move(e, selected.includes(n) ? selected : [n], _graph.view)"
        :class="selected.includes(n) ? 'selected' : ''"
        @click.ctrl.stop="selected = _.xor(selected, [n])"
        @click.exact.stop="selected = [n]"
        @edit="setParent($event)" />
    </div>
    <!-- Connections -->
    <svg class="h-connections-container" :style="transformStyle">
      <HConnection v-for="(c, i) in connections_in_group" :key="'connection'+i" :connection="c" />
    </svg>
    <!-- Context menu -->
    <q-menu
        touch-position
        context-menu
      >
      <HMenu :items="contextMenu" />
    </q-menu>
  </div>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted, toRef } from 'vue'
import { useHirondelle } from "./hirondelle.js"
import { useMovePanZoom } from "./movePanZoom.js"
import HNode from "src/hirondelle/HNode.vue"
import HMenu from "src/hirondelle/HMenu.vue"
import HConnection from "src/hirondelle/HConnection.vue"
import _ from "lodash"

const H = useHirondelle()
const PZ = useMovePanZoom()

const props = defineProps({
  graph: { type: Object, required: false },
})
const emit = defineEmits(["selected", "parentChanged"])
const _graph = computed(() => props.graph)

const selected = ref([])
watch(selected, (val) => emit("selected", val))

const parentNode = ref(props.graph)
const setParent = (parent) => {
  parentNode.value = parent
  emit("parentChanged", parent)
}
// const nodes_in_group = computed(() => {
//   if (parentNode.value) return parentNode.value.nodes
//   else return _graph.value.nodes
// })
const connections_in_group = computed(() => {
  return props.graph.connections.filter(c =>
    (c.from.parent == (parentNode.value || props.graph) &&
    c.to.parent == (parentNode.value || props.graph)) ||
    c.type == "temporary"
    )
})

// Context menu
const nodeTypesCategories = computed(() => _.uniq(H.nodeTypes.map(t => t.category)).filter(c => c))
const contextMenu = computed(() => {
  var menu = []
  // New Triggers
  menu.push({
    title: "New…",
    items: nodeTypesCategories.value.map(cat => ({
      title: cat,
      items: H.nodeTypes.filter(t => t.category == cat).map(t => ({
        title: t.title,
        type: t
      }))
    }))
  })

  // New Actions
  // New Transforms

  return menu
})

// Breadcrumbs

const breadcrumbs = computed(() => {
  var b = []
  var p = parentNode.value
  while (p) {
    b.push(p)
    p = p.parent
  }
  return b.reverse()
})

// Transform

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
const scaling = computed(() => _graph.value.view.scaling)


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
    box-shadow: 0px 0px calc(14px / v-bind("scaling")) #00ffdd;
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
