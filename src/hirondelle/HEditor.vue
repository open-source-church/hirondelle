<template>
  <div
    class="h-editor" tabindex="0"
    @wheel.self.prevent="e => PZ.mouseWheel(e, _graph.view)"
    @mousemove="e => PZ.onPointerMove(e, _graph.view)"
    @mousedown.self="e => PZ.onPointerDown(e, _graph.view)"
    @mouseup="e => !PZ.onPointerUp(e, _graph.view) && !e.ctrlKey ? selected = [] : ''"
    @click.right="selected = []"
    @keyup.self.delete="deleteSelectedNodes"
  >
    <div class="absolute-top-left">
      <q-breadcrumbs>
        <q-breadcrumbs-el v-for="b in breadcrumbs" :key="b.id" :label="b.type?.title || 'Root'" @click="setParent(b)"/>
      </q-breadcrumbs>
    </div>
    <!-- Background -->
    <div class="h-background no-pointer-events" :style="styles"></div>
    <!-- Group connectors -->
    <div class="absolute-left items-center row rotate-270" v-if="parentNode.parent">
      <HConnector port-type="output" port-class="group" :node="parentNode" />
      <span class="absolute q-ml-lg text-grey no-pointer-events	" style="min-width: 200px;" > Group Input</span>
    </div>
    <div class="absolute-right items-center row rotate-270" v-if="parentNode.parent">
      <HConnector port-type="input" port-class="group" :node="parentNode" />
      <span class="absolute q-ml-lg text-grey no-pointer-events	" style="min-width: 200px;" > Group Output</span>
    </div>
    <!-- Nodes -->
    <div class="h-node-container h-prevent-select" :style="transformStyle">
      <HNode v-for="(n, i) in parentNode.nodes" :key="'node'+i" :node="n"
        v-touch-pan.prevent.mouse="e => PZ.move(e, selected.includes(n) ? selected : [n], _graph.view)"
        :class="selected.includes(n) ? 'selected' : ''"
        @click.ctrl.stop="selected = _.xor(selected, [n])"
        @click.exact.stop="selected = [n]"
        @edit="setParent($event)"
        draggable="false"
         />
    </div>
    <!-- Connections -->
    <svg class="h-connections-container" :style="transformStyle">
      <HConnection v-for="(c, i) in connections_in_group" :key="'connection'+i" :connection="c" />
    </svg>
    <!-- Selection -->
    <div class="h-selection" >
      <div class="h-selection-area" :style="selectionStyle"></div>
    </div>
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

import { ref, computed, reactive, watch, onMounted, toRef, nextTick } from 'vue'
import { useHirondelle } from "./hirondelle.js"
import { useMovePanZoom } from "./movePanZoom.js"
import HNode from "src/hirondelle/HNode.vue"
import HMenu from "src/hirondelle/HMenu.vue"
import HConnection from "src/hirondelle/HConnection.vue"
import HConnector from "src/hirondelle/HConnector.vue"
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

const deleteSelectedNodes = () => {
  _graph.value.removeNodes(selected.value)
  selected.value = []
}

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
    c.type == "temporary" ||
    c.from == parentNode.value && c.to.parent != parentNode.value.parent ||
    c.to == parentNode.value && c.from.parent != parentNode.value.parent
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

// Selection

const selectionStyle = computed(() => {
  if (_graph.value.view.selection?.topLeft) {
    var selection = _graph.value.view.selection
    return {
    left: selection.topLeft.x + "px",
    top: selection.topLeft.y + "px",
    width: selection.width + "px",
    height: selection.height + "px",
    }
  }
  return {}
})
watch(() => _graph.value.view.selection, () => {
  if (!_graph.value.view.selection?.topLeft) return
  var selection = _graph.value.view.selection
  var view = _graph.value.view
  var p1 = _graph.value.view.to(selection.topLeft)
  var p2 = _graph.value.view.to(selection.bottomRight)
  selected.value = parentNode.value.nodes.filter(n =>
    _.some([
      [n.state.x, n.state.y],
      [n.state.x + n._state.width, n.state.y],
      [n.state.x, n.state.y + n._state.height],
      [n.state.x + n._state.width, n.state.y + n._state.height]
    ], p => {
      return p[0] > p1.x && p[0] < p2.x && p[1] > p1.y && p[1] < p2.y
    })
  )
})

// Updating port positions
const findAttribute = (n, attr) => {
  while(n) {
    try {
      if(n.getAttribute(attr)) return n.getAttribute(attr)
    } catch {}
    n = n.parentNode
  }
  return null
}
const _view = computed(() => _graph.value.view)
var last = {}
watch(_graph.value, async (val) => {
  var state = _.cloneDeep({
    view: _graph.value.view,
    nodeState: parentNode.value.nodes.map(n => n.state)
  })
  if (_.isEqual(last, state)) return

  await nextTick()
  var el = document.querySelectorAll('[data-port-type]')
  var c = {}
  el.forEach(e => {
    var portClass = findAttribute(e, "data-port-class")
    var nodeId = findAttribute(e, "data-node-id")
    var portType = findAttribute(e, "data-port-type")
    var paramName = findAttribute(e, "data-param-name")
    var condition = findAttribute(e, "data-port-condition")

    e = e.getBoundingClientRect()

    var portId = `port-${nodeId}-${portType}`
    if (portClass) portId += `-${portClass}`
    if (paramName) portId += `-${paramName}`
    if (portClass == "condition") portId += `-${condition}`

    var to = _graph.value.view.to({x: e.x + e.width/2, y: e.y + e.height / 2})
    c[portId] = to
  })
  last = state
  _graph.value._connectors = c
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
const isMoving = PZ.isMoving

</script>

<style lang="scss">

.h-prevent-select {
  user-select: none;
  -moz-user-select: none;
  -webkit-user-select: none;
  -ms-user-select: none;
}

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
    z-index: -1;
  }

  .h-node-container {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1;
  }

  .selected {
    box-shadow: 0px 0px calc(14px / v-bind("scaling")) #00ffdd;
  }

  .h-connections-container {
    position: fixed;
    top: 0;
    left: 0;
    overflow: visible;
  }

  .h-node {
    position: fixed;
  }

  .h-selection {
    position: fixed;
    top: 0;
    left: 0;
    .h-selection-area {
      position: fixed;
      border: 1px solid #00ffdd;
      background-color: #00ffdd10;
    }
  }
}

</style>
