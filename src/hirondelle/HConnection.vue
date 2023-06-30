<template>
  <path :class="`Hconnection ${connection.type != 'temporary' ? 'cursor-pointer' : ''}`" :d="d"
   :stroke="color" fill="none" width="2" stroke-width="3"
   :stroke-dasharray="connection.type == 'temporary' ? '10' : ''"
   @click="remove"/>
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
  if (props.connection.type == 'main') return "green"
  if (props.connection.type == 'condition' && props.connection.condition) return "green"
  if (props.connection.type == 'condition' && !props.connection.condition) return "red"
  if (props.connection.type == 'temporary' ) return "grey"
  else return "grey"
})


const deltaY2 = computed(() => {
  if (props.connection.type == 'temporary') return 0
  else return 25
})
const deltaX = computed(() => {
  if (props.connection.type == 'temporary') return 0
  else return 300
})
const deltaY = computed(() => {
  if (props.connection.type == 'main') return 25
  // if (props.connection.type == 'condition' && props.connection.condition) return 65
  // if (props.connection.type == 'condition' && !props.connection.condition) return 87
  else return 25
})
const delta = computed(() => {
  if (props.connection.type == "temporary") return { x: 0, y: 0}
  else return { x: 0}
})


const addPos = (pos1, pos2) => {
  if (pos1 && pos1.x != null && pos2 && pos2.x != null)
    return { x: pos1.x + pos2.x, y: pos1.y + pos2.y}
  else return null
}

const d = computed(() => {
  var cPosFrom = props.connection.from._state
  var cPosTo = props.connection.to._state
  var posFrom = props.connection.from.state
  var posTo = props.connection.to.state
  var type = props.connection.type

  var n1 = posFrom
  var n2 = posTo

  if (type != "temporary") {
    n1 = addPos(posFrom, { x: 300, y: 25})
    n2 = addPos(posTo, { x: 0, y: 25})
  }

  if (type == "main") {
    n1 = addPos(posFrom, cPosFrom?.main_output) || n1
    n2 = addPos(posTo, cPosTo?.main_input) || n2
  }

  if (type == "param")
    n1 = addPos(posFrom, cPosFrom?.output[props.connection.output]) || n1
  if (type == "param")
    n2 = addPos(posTo, cPosTo?.input[props.connection.input]) || n2

  if (type == "condition" && props.connection.condition) {
    n1 = addPos(posFrom, cPosFrom?.condition_true) || n1
  }
  if (type == "condition" && !props.connection.condition) {
    n1 = addPos(posFrom, cPosFrom?.condition_false) || n1
  }

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
