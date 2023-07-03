<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card style="min-width: 300px" >
      <q-card-section class="q-pa-none" >
        <q-select filled dense label="Node type" :options="options" ref="selectRef"
          emit-value options-dense use-input fill-input hide-selected input-debounce="0"
          @filter="filterFn" v-model="model" @update:model-value="submit"
          options-disable="header">
          <template v-slot:option="scope">
            <q-item v-bind="scope.itemProps" :disable="scope.opt.header">
              <q-item-section avatar v-if="!scope.opt.header">
                <q-badge v-if="scope.opt.type.isTrigger" square class="bg-accent text-white">trigger</q-badge>
                <q-badge v-if="scope.opt.type.isAction" square class="bg-primary text-dark">action</q-badge>
                <q-badge v-if="scope.opt.type.isParam" square class="bg-grey-8 text-white">param</q-badge>
              </q-item-section>
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
                <q-item-label caption>{{ scope.opt.description }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted, nextTick } from 'vue'
import { useHirondelle } from './hirondelle'
import _ from "lodash"
import { useDialogPluginComponent } from 'quasar'

const H = useHirondelle()

const options = ref(H.nodeTypesOptions)
const model = ref()
const selectRef = ref()

defineEmits([
  ...useDialogPluginComponent.emits
])
const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

const filterFn = (val, update, abort) => {
  update(() => {
    const needle = val.toLowerCase()
    options.value = H.nodeTypesOptions.filter(v => JSON.stringify(v).toLowerCase().indexOf(needle) > -1)
  })
}

onMounted(async () => {
  setTimeout(() => selectRef.value.focus(), 300)
})

const submit = (val) => {
  onDialogOK(val)
}

</script>

<style lang="scss">


</style>
