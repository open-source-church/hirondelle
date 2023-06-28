<template>
  <path :class="`Hconnection ${connection.type != 'temporary' ? 'cursor-pointer' : ''}`" :d="d"
   :stroke="color" fill="none" width="2" stroke-width="3"
   :stroke-dasharray="connection.type == 'temporary' ? '10' : ''"
   @click="remove"/>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'

const props = defineProps({
  connection: { type: Object, required: true }
})

const remove = () => {
  props.connection.graph.removeConnection(props.connection)
}

watch(() => props.connection, () => console.log(props.connection.to))

const color = computed(() => {
  if (props.connection.type == 'main') return "green"
  if (props.connection.type == 'condition' && props.connection.condition) return "green"
  if (props.connection.type == 'condition' && !props.connection.condition) return "red"
  if (props.connection.type == 'temporary' ) return "grey"
  else return "blue"
})

const deltaY = computed(() => {
  if (props.connection.type == 'main') return 25
  if (props.connection.type == 'condition' && props.connection.condition) return 65
  if (props.connection.type == 'condition' && !props.connection.condition) return 87
  else return 0
})
const deltaY2 = computed(() => {
  if (props.connection.type == 'temporary') return 0
  else return 25
})
const deltaX = computed(() => {
  if (props.connection.type == 'temporary') return 0
  else return 300
})

const d = computed(() => {
  var n1 = {
    x: props.connection.from.state.x + deltaX.value,
    y: props.connection.from.state.y + deltaY.value
  }
  var n2 = {
    x: props.connection.to.state.x,
    y: props.connection.to.state.y + deltaY2.value
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
