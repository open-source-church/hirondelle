<template>
  <!-- Multiple -->
  <template v-if="param.multiple">
    <div class="row items-center">
      <div class="col-12 caption">{{ param.displayName || name }}</div>
      <q-chip v-for="val in modelValue" :key="val.id"
        square :class="`bg-${H.varTypes[val?.type]?.color}-3 text-dark`">
        {{ val.name }}
        <q-tooltip v-if="typeof(val.val) == 'object'">
          <q-chip v-for="(v, key) in val.val" :key="key" class="bg-secondary text-dark q-pa-none q-pr-sm">
            <q-chip class="bg-accent q-ma-none q-pl-xs q-pr-sm q-mr-sm">{{ key }}</q-chip>
            {{ v }}</q-chip>
         </q-tooltip>
        <q-tooltip v-else>{{ val.val }} </q-tooltip>
      </q-chip>
    </div>
  </template>
  <!-- Array -->
  <template v-else-if="param.array && !param.options">
    <div class="row items-center">
      <div class="col-12 caption">{{ param.displayName || name }}</div>
      <q-chip v-for="(val, i) in modelValue" :key="i"
        square :class="`bg-${H.varTypes[param.type]?.color}-3 text-dark`">
        {{ val }}
      </q-chip>
    </div>
  </template>
  <!-- Boolean -->
  <template v-else-if="param.type == 'boolean'">
    <q-toggle :disable="disable" :label="param.description || param.displayName || name" :model-value="modelValue" @update:model-value="update" />
  </template>
  <!-- Color -->
  <template v-else-if="param.type == 'color'">
    <div class="row">
      <div class="col-12 caption">{{ param.displayName || name }}</div>
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
    <div class="row items-center">
      <div class="col-12 caption">{{ param.displayName || name }}</div>
      <div class="row q-col-gutter-sm">
        <q-input :disable="disable" class="col-6" dense filled label="left" :model-value="modelValue.x"
          @update:model-value="val => update(val, 'x')" debounce="1000" />
        <q-input :disable="disable" class="col-6" dense filled label="top" :model-value="modelValue.y"
          @update:model-value="val => update(val, 'y')" debounce="1000" />
        <q-input :disable="disable" class="col-6" dense filled label="width" :model-value="modelValue.width"
          @update:model-value="val => update(val, 'width')" debounce="1000" />
        <q-input :disable="disable" class="col-6" dense filled label="height" :model-value="modelValue.height"
          @update:model-value="val => update(val, 'height')" debounce="1000" />
      </div>
    </div>
  </template>
  <!-- Object -->
  <template v-else-if="param.type == 'object'">
    <div class="">
      <div class="col-12 caption">{{ param.displayName || name }}</div>
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
      <div class="col-12">{{ param.displayName || name }}</div>
      <q-slider v-if="param.slider" class="col-12"
        :min="param.slider.min"
        :max="param.slider.max"
        :color="param.slider.color"
        :step="param.slider.step == undefined ? 1 : param.slider.step"
        :label="param.slider.label"
        label-text-color="dark"
        :model-value="modelValue" @update:model-value="update" />
    </div>
  </template>
  <!-- String -->
  <template v-else>
    <div class="">
      <div v-if="param.options && param.checkbox">{{ param.displayName || name }}</div>
      <q-option-group v-if="param.options && param.checkbox" dense :disable="disable" :options="param.options"
      :label="param.displayName || name" :clearable="param.clearable" :type="param.array ? 'checkbox' : 'radio'"
      :option-label="param.optionLabel || 'label'" :option-value="param.optionValue || 'value'" emit-value map-options
      :model-value="modelValue" @update:model-value="update" inline/>
      <q-select v-else-if="param.options" options-dense :disable="disable"
      :options="options" @filter="filterFn" use-input fill-input hide-selected
      :label="param.displayName || name" dense filled :clearable="param.clearable" :multiple="param.multiple"
      :option-label="param.optionLabel || 'label'" :option-value="param.optionValue || 'value'" emit-value map-options
      :model-value="modelValue" @update:model-value="update">
        <template v-slot:option="scope">
          <q-item v-bind="scope.itemProps">
            <q-item-section avatar v-if="scope.opt.icon">
              <q-icon :name="scope.opt.icon" />
            </q-item-section>
            <q-item-section avatar v-else-if="scope.opt.image">
              <q-img width="24" :src="scope.opt.image" />
            </q-item-section>
            <q-item-section>
              <q-item-label>{{ scope.label }}</q-item-label>
              <q-item-label caption v-if="scope.opt[param.optionCaption || 'caption']">{{ scope.opt[param.optionCaption || "caption"] }}</q-item-label>
            </q-item-section>
          </q-item>
        </template>
      </q-select>
      <q-input v-else dense filled :label="param.displayName || name" :textarea="param.textarea" :autogrow="param.textarea"
      :model-value="modelValue" @update:model-value="update" :disable="disable" :debounce="param.type=='number' ? 1000:0" />
    </div>
  </template>

</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import _ from "lodash"
import { useHirondelle } from './hirondelle'

const H = useHirondelle()

const props = defineProps({
  param: { type: Object, required: true },
  name: { type: String },
  modelValue: {},
  node: { type: Object },
  disable: { type: Boolean }
})
const emit = defineEmits(["update:modelValue"])

const value = computed({
  get() { return props.modelValue },
  set(val) { update(val)}
})

const update = (val, rectProp) => {
  // On regarde si c'est une expression mathématique
  if (["number", "rect"].includes(props.param.type)) {
    if(val.toString().match(/[\d+\+ \-\*\/\(\)]+/)) {
      try {
        var r = Function(`return (${val.toString()})`)()
        val = r
      } catch {
        console.log(`'${val.toString()}' n'est pas une expression valide :(`)
        return
      }
    }
    else
      // On converti en nombre
      val = ~~val
  }
  if (props.param.type == 'rect') val = _.assign(props.modelValue, { [rectProp]: val })

  emit('update:modelValue', val)
}

// Filter options
const options = ref(props.param.options)
const filterFn = (val, update, abort) => {
  update(() => {
    const needle = val.toLowerCase()
    options.value = props.param.options.filter(v => JSON.stringify(v).toLowerCase().indexOf(needle) > -1)
  })
}

</script>

<style lang="scss">

textarea, input {
  background: rgba(255, 255, 255, 0.07);
  color: white;
  border: none;
  border-radius: 3px;
  padding: 4px;
}

</style>
