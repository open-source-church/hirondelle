<template>
  <template v-if="param.type == 'boolean'">
    <q-toggle :label="name" :model-value="modelValue" @update:model-value="val => $emit('update:modelValue', val)" />
  </template>
  <template v-else>
    <q-select v-if="param.options" :label="name" dense filled clearable :options="param.options"
    :model-value="modelValue" @update:model-value="val => $emit('update:modelValue', val)"/>
    <q-input v-else dense filled :label="name" :type="param.type"
      :model-value="modelValue" @update:model-value="val => $emit('update:modelValue', val)" />
  </template>

</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'

const props = defineProps({
  param: { type: Object, required: true },
  name: { type: String },
  modelValue: {}
})


</script>

<style lang="scss">


</style>
