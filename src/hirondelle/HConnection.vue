<template>
  <path :class="`Hconnection ${connection.type != 'temporary' ? 'cursor-pointer' : ''}`" :d="d"
   :stroke="color" fill="none" width="3" :stroke-width="strokeWidth"
   :stroke-dasharray="connection.type == 'temporary' ? '10' : ''"
   @click="remove"
   />
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import _ from "lodash"

const props = defineProps({
  connection: { type: Object, required: true }
})

const remove = () => {
  props.connection.graph.removeConnection(props.connection)
}

const color = computed(() => {
  if (props.connection.valid == true) return "green"
  if (props.connection.valid == false) return "red"
  if (props.connection.type == 'flow') return "green"
  if (props.connection.type == 'temporary' ) return "grey"
  else return "grey"
})

const strokeWidth = computed(() => {
  if (props.connection.type == 'flow') return 7
  if (props.connection.type == 'temporary') return 7
  if (props.connection.type == 'param') return 4
  else return "grey"
})

const addPos = (pos1, pos2) => {
  if (pos1 && pos1.x != null && pos2 && pos2.x != null)
    return { x: pos1.x + pos2.x, y: pos1.y + pos2.y}
  else return null
}

const getPortId = (node, type, portClass, param=null, slot=null, signal=null) => {
  var id = `port-${node.id}-${type}-${portClass}`
  if (param) id += `-${param.id}`
  if (slot) id += `-${slot}`
  if (signal) id += `-${signal}`
  return id
}

const d = computed(() => {
  var cPosFrom = props.connection.from._state
  var cPosTo = props.connection.to._state
  var posFrom = props.connection.from.state
  var posTo = props.connection.to.state
  var type = props.connection.type
  var c = props.connection

  var n1
  var n2

  if (type != "temporary") {
    // n1 = addPos(posFrom, { x: 300, y: 25})
    // n2 = addPos(posTo, { x: 0, y: 25})

    // Groups
    if (c.from.type.id == "group" && c.to.parent == c.from) {
      var fromId = getPortId(c.from, "output", "group")
      n1 = c.graph._connectors[fromId] || {x: 0, y: 0}
      var type = c.type == "clone" ? "param" : c.type
      var idTo = getPortId(c.to, "input", type, c.input, c.slot)
      n2 = c.graph._connectors[idTo]
    }
    if (c.to.type.id == "group" && c.from.parent == c.to) {
      var toId = getPortId(c.to, "input", "group")
      n2 = c.graph._connectors[toId] || {x: 0, y: 0}
      var type = c.type == "clone" ? "param" : c.type
      var idFrom = getPortId(c.from, "output", type, c.output, c.slot)
      n1 = c.graph._connectors[idFrom]
    }
    if (!n1) {
      var idFrom = getPortId(c.from, "output", c.type, c.output, null, c.signal)
      n1 = c.graph._connectors[idFrom]
      if(!n1) {
        // Connect to main
        var idFrom = getPortId(c.from, "output", "flow")
        n1 = c.graph._connectors[idFrom]
      }
    }
    if (!n2) {
      var idTo = getPortId(c.to, "input", c.type, c.input, c.slot)
      n2 = c.graph._connectors[idTo]
      if(!n2) {
        // Connect to main
        var idTo = getPortId(c.to, "input", "flow")
        n2 = c.graph._connectors[idTo]
      }
    }
  }
  else {
    n1 = posFrom
    n2 = posTo
  }
  n1 = n1 || {x: posFrom.x + 300, y: posFrom.y + 25}
  n2 = n2 || {x: posTo.x, y: posTo.y + 25}

  if (false)
    return `M ${n1.x} ${n1.y} L ${n2.x} ${n2.y}`;
  else {
    var d = Math.abs(n1.x - n2.x) / 3
    return `M ${n1.x} ${n1.y} C ${n1.x + d} ${n1.y}, ${n2.x -d} ${n2.y}, ${n2.x} ${n2.y}`
  }
})

</script>

<style lang="scss">


</style>
