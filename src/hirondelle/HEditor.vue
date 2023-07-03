<template>
  <div
    class="h-editor" tabindex="0"
    @wheel.self.prevent="e => PZ.mouseWheel(e, H.view)"
    @mousemove="e => PZ.onPointerMove(e, H.view)"
    @mousedown.self="e => PZ.onPointerDown(e, H.view)"
    @mouseup="e => !PZ.onPointerUp(e, H.view) && !e.ctrlKey ? selected = [] : ''"
    @click.right="selected = []"
    @keyup.self.delete="deleteSelectedNodes"
    @keyup.self.ctrl.c.exact="CB.copy(selected)"
    @keyup.self.ctrl.v.exact="() => selected = CB.paste(parentNode)"
    @keyup.self.shift.a.exact="newNodeDialog"
  >
    <div class="absolute-top-left" style="z-index: 10">
      <q-breadcrumbs>
        <q-breadcrumbs-el v-for="b in breadcrumbs" :key="b.id" :label="b.id || b.type?.title || 'Root'" @click="setParent(b)"/>
      </q-breadcrumbs>
    </div>
    <!-- Background -->
    <div class="h-background no-pointer-events h-prevent-select" :style="styles"></div>
    <!-- Group connectors -->
    <div class="absolute-left items-center row rotate-270 h-prevent-select" v-if="parentNode.parent">
      <span class="absolute q-ml-xl text-grey no-pointer-events	" style="min-width: 200px;" > Group Input</span>
      <HConnector port-type="output" port-class="group" :node="parentNode" />
    </div>
    <div class="absolute-right items-center row rotate-270" v-if="parentNode.parent">
      <span class="absolute q-ml-xl text-grey no-pointer-events	" style="min-width: 200px;" > Group Output</span>
      <HConnector port-type="input" port-class="group" :node="parentNode" />
    </div>
    <!-- Nodes -->
    <div class="h-node-container h-prevent-select" :style="transformStyle" >
      <HNode v-for="n in parentNode.nodes" :key="n.id" :node="n"
        v-touch-pan.prevent.mouse="e => PZ.move(e, selected.includes(n) ? selected : [n], H.view)"
        :class="selected.includes(n) ? 'selected' : ''"
        @click.ctrl.stop="selected = _.xor(selected, [n])"
        @click.exact.stop="selected = [n]"
        @edit="setParent($event)"
        draggable="false" v-memo="[parentNode, selected.includes(n)]"
         />
    </div>
    <!-- Connections -->
    <svg class="h-connections-container h-prevent-select" :style="transformStyle">
      <HConnection v-for="(c, i) in connections_in_group" :key="'connection'+i" :connection="c" />
    </svg>
    <!-- Selection -->
    <div class="h-selection h-prevent-select" >
      <div class="h-selection-area" :style="selectionStyle"></div>
    </div>
    <!-- Context menu -->
    <q-menu
        touch-position
        context-menu
      >
      <HMenu :items="contextMenu" />
    </q-menu>
    <q-resize-observer @resize="getGraphSize" />
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
import HNodeTypes from "src/hirondelle/HNodeTypes.vue"
import _ from "lodash"
import { useClipboard } from './utils/clipboard'
import { uid, useQuasar } from 'quasar'

const H = useHirondelle()
const PZ = useMovePanZoom()
const CB = useClipboard()
const $q = useQuasar()

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

const connections_in_group = computed(() => {
  return props.graph.connections.filter(c =>
    // Même parent
    (c.from.parent == (parentNode.value || props.graph) &&
    c.to.parent == (parentNode.value || props.graph)) ||
    // Temporaires
    c.type == "temporary" ||

    c.from == parentNode.value && c.to.parent == c.from ||
    c.to == parentNode.value && c.from.parent == c.to
    )
})

// New node dialog
const newNodeDialog = () => {
  var state = { x: H.view.mouse.x, y: H.view.mouse.y }
  state.x -= 150
  state.y -= 20
  console.log(state)
  state = H.view.to(state)
  state.open = true

  $q.dialog({ component: HNodeTypes }).onOk((t) => {
    console.log("TYPE", t)
    _graph.value.addNode({ type: t.type, state }, parentNode.value)
  })
}

// Graph width
const getGraphSize = size => {
  H.view.dimensions = size
}

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
  if (H.view.selection?.topLeft) {
    var selection = H.view.selection
    return {
    left: selection.topLeft.x + "px",
    top: selection.topLeft.y + "px",
    width: selection.width + "px",
    height: selection.height + "px",
    }
  }
  return {}
})
watch(() => H.view.selection, () => {
  if (!H.view.selection?.topLeft) return
  var selection = H.view.selection
  var view = H.view
  var p1 = H.view.to(selection.topLeft)
  var p2 = H.view.to(selection.bottomRight)
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
const _view = computed(() => H.view)
var last = {}
watch([_graph.value, H.view], async (val) => {
  // if (PZ.isMoving) return
  var state = {
    view: { x: H.view.panning.x, y: H.view.panning.y, scaling: H.view.scaling },
    nodeState: parentNode.value.nodes.map(n => ({x: n.state.x, y: n.state.y, open: n.state.open}))
  }
  if (_.isEqual(last, state)) return

  var el = document.querySelectorAll('[data-port-type]')
  // var c = {}
  if (!_graph.value._connectors) _graph.value._connectors = {}
  el.forEach(e => {
    var portId = e.getAttribute("id")
    e = e.getBoundingClientRect()
    if (e.width && e.height) {
      var to = H.view.to({x: e.x + e.width/2, y: e.y + e.height / 2})
      _graph.value._connectors[portId] = to
    }
  })
  if (!_.isEmpty(_graph.value._connectors))
    last = state
  // _graph.value._connectors = c
}, {flush: 'post'})

// Transform

const transformStyle = computed(() => ({
  "transform-origin": "0 0",
  "transform": `scale(${H.view.scaling})
  translate(${H.view.panning.x}px, ${H.view.panning.y}px)`
}))

// Background
const gridSize = 100
const subGridSize = 20
const styles = computed(() => {
  const view = H.view
  return {
    backgroundPosition: `left ${view.panning.x * view.scaling}px top ${view.panning.y * view.scaling}px`,
    backgroundSize: `${gridSize * view.scaling}px ${gridSize * view.scaling}px,
                     ${gridSize * view.scaling}px ${gridSize * view.scaling}px,
                     ${subGridSize * view.scaling}px ${subGridSize * view.scaling}px,
                     ${subGridSize * view.scaling}px ${subGridSize * view.scaling}px`
  }
})
const scaling = computed(() => H.view.scaling)


const color = "#2c2c2c"
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
