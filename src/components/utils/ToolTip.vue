<template>
  <q-tooltip :anchor="anchor" :self="self" :class="props.class">
    <slot></slot>
  </q-tooltip>
</template>

<script setup>

import { computed } from 'vue'

const props = defineProps({
  top: { type: Boolean, default: false},
  class: { type: String, default: "bg-secondary text-dark text-body2" }
})

const anchor = computed(() => props.top ? "top middle" : "bottom middle")
const self = computed(() => props.top ? "bottom middle" : "top middle")

</script>
