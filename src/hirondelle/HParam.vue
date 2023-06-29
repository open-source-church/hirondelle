<template>
  <template v-if="param.type == 'boolean'">
    <q-toggle :label="param.description || name" :model-value="modelValue" @update:model-value="update" />
  </template>
  <template v-else-if="param.type == 'color'">
    <div class="row">
      <q-btn class="col-auto q-px-md" square flat dense :style="`background-color:${modelValue}`" />
      <q-input class="col" square dense filled :model-value="modelValue"
      @update:model-value="update"
      >
      <template v-slot:append>
        <q-icon name="colorize" class="cursor-pointer">
          <q-popup-proxy transition-show="scale" transition-hide="scale">
            <q-color :model-value="modelValue" @update:model-value="update" />
            </q-popup-proxy>
          </q-icon>
        </template>
      </q-input>
    </div>
  </template>
  <template v-else-if="param.type == 'rect'">
    <div class="row q-col-gutter-xs">
      <q-input class="col-6" dense filled type="number" label="left" :model-value="modelValue.x"
        @update:model-value="val => update(_.assign(modelValue, {x: val}))" />
      <q-input class="col-6" dense filled type="number" label="top" :model-value="modelValue.y"
        @update:model-value="val => update(_.assign(modelValue, {y: val}))"  />
      <q-input class="col-6" dense filled type="number" label="width" :model-value="modelValue.width"
        @update:model-value="val => update(_.assign(modelValue, {width: val}))"  />
      <q-input class="col-6" dense filled type="number" label="height" :model-value="modelValue.height"
        @update:model-value="val => update(_.assign(modelValue, {height: val}))"  />
    </div>
  </template>
  <template v-else>
    <q-select v-if="param.options" :label="name" dense filled clearable :options="param.options"
    :model-value="modelValue" @update:model-value="update"/>
    <q-input v-else dense filled :label="name" :type="param.type"
      :model-value="modelValue" @update:model-value="update" />
  </template>

</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import _ from "lodash"

const props = defineProps({
  param: { type: Object, required: true },
  name: { type: String },
  modelValue: {}
})
const emit = defineEmits(["update:modelValue"])

const update = val => {
  if (props.param.type == 'rect') emit('update:modelValue', val)
  else emit('update:modelValue', val)
}

</script>

<style lang="scss">


</style>
