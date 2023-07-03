<template>
  <!-- Array -->
  <template v-if="param.array">
    <div class="row items-center">
      <div class="col-12 caption">{{ name }}</div>
      <q-chip v-for="(val, param) in _.forEach(modelValue)" :key="val"
        square class="bg-grey text-dark">
        {{ param }}
        <q-tooltip>{{ val }}</q-tooltip>
      </q-chip>
    </div>
  </template>
  <!-- Boolean -->
  <template v-else-if="param.type == 'boolean'">
    <q-toggle :disable="disable" :label="param.description || name" :model-value="modelValue" @update:model-value="update" />
  </template>
  <!-- Color -->
  <template v-else-if="param.type == 'color'">
    <div class="row">
      <q-btn class="col-auto q-px-md" square flat dense :style="`background-color:${modelValue}`" />
      <q-input class="col" square dense filled :model-value="modelValue"
      @update:model-value="update" :disable="disable"
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
  <!-- Rect -->
  <template v-else-if="param.type == 'rect'">
    <div class="row q-col-gutter-xs">
      <q-input :disable="disable" class="col-6" dense filled type="number" label="left" :model-value="modelValue.x"
        @update:model-value="val => update(_.assign(modelValue, {x: val}))" />
      <q-input :disable="disable" class="col-6" dense filled type="number" label="top" :model-value="modelValue.y"
        @update:model-value="val => update(_.assign(modelValue, {y: val}))"  />
      <q-input :disable="disable" class="col-6" dense filled type="number" label="width" :model-value="modelValue.width"
        @update:model-value="val => update(_.assign(modelValue, {width: val}))"  />
      <q-input :disable="disable" class="col-6" dense filled type="number" label="height" :model-value="modelValue.height"
        @update:model-value="val => update(_.assign(modelValue, {height: val}))"  />
    </div>
  </template>
  <!-- Object -->
  <template v-else-if="param.type == 'object'">
    <div class="">
      <div class="col-12 caption">{{ name }}</div>
      <q-chip v-for="(val, param) in _.forEach(modelValue)" :key="val"
        square class="bg-grey text-dark">
        {{ param }}
        <q-tooltip>{{ val }}</q-tooltip>
      </q-chip>
    </div>
  </template>
  <!-- Number -->
  <template v-else-if="param.type == 'number' && param.slider">
    <div class="row">
      <div class="col-12">{{ name }}</div>
      <q-slider v-if="param.slider" class="col-12" :min="param.slider.min" :max="param.slider.max" :color="param.slider.color"
        :model-value="modelValue" @update:model-value="update" />
    </div>
  </template>
  <!-- String -->
  <template v-else>
    <q-select v-if="param.options" options-dense :disable="disable"
      :label="name" dense filled clearable :options="param.options"
      :option-label="param.optionLabel || 'label'" :option-value="param.optionValue || 'id'" emit-value map-options
      :model-value="modelValue" @update:model-value="update"/>
    <q-input v-else dense filled :label="name" :type="param.type" :textarea="param.textarea" :autogrow="param.textarea"
      :model-value="modelValue" @update:model-value="update" :disable="disable"  />
  </template>

</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import _ from "lodash"

const props = defineProps({
  param: { type: Object, required: true },
  name: { type: String },
  modelValue: {},
  node: { type: Object },
  disable: { type: Boolean }
})
const emit = defineEmits(["update:modelValue"])

const update = val => {
  if (props.param.type == "number") val = ~~val
  if (props.param.type == 'rect') emit('update:modelValue', val)
  else emit('update:modelValue', val)
}

// const paramSources = computed(() => {
//   if (props.param.type == "object") return props.node.graph.paramSources(props.node.id, props.name)
//   else return null
// })

</script>

<style lang="scss">


</style>
