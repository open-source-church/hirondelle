<template>
   <path class="Hconnection cursor-pointer" :d="d"
    :stroke="color" fill="none" width="2" stroke-width="3" stroke-dasharray=""
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

const color = computed(() => {
  if (props.connection.type == 'main') return "green"
  if (props.connection.type == 'condition' && props.connection.condition) return "green"
  if (props.connection.type == 'condition' && !props.connection.condition) return "red"
  else return "blue"
})

const deltaY = computed(() => {
  if (props.connection.type == 'main') return 25
  if (props.connection.type == 'condition' && props.connection.condition) return 65
  if (props.connection.type == 'condition' && !props.connection.condition) return 87
  else return 0
})

const d = computed(() => {
  var n1 = {
    x: props.connection.from.state.x + 300,
    y: props.connection.from.state.y + deltaY.value
  }
  var n2 = {
    x: props.connection.to.state.x,
    y: props.connection.to.state.y + 25
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
