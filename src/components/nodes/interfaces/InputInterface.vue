<template>
  <q-select v-if="options" filled dense :options="options" :modelValue="modelValue" @update:modelValue="val => $emit('update:modelValue', val)" />
  <q-input v-else filled dense :modelValue="modelValue" @input:modelValue="val => $emit('update:modelValue', val)" />
  <!-- <q-btn icon="info" @click="info" flat/> -->
</template>


<script setup>
import { useOBS } from 'stores/obs'
import { computed } from 'vue'

  const OBS = useOBS()

  const props = defineProps(["modelValue", "intf", "node"])
  const emit = defineEmits(["update:modelValue", "openSidebar"])

  const options = computed(() => {
    if (["OBS:SetCurrentProgramScene", "OBS:SetCurrentPreviewScene"].includes(props.node.type) ) {
      if (OBS.connected) return OBS.data.scenes.map(s => s.sceneName)
    }
    return null
  })

  const info = () => {
    console.log(props.node)
    console.log(props.intf)
    console.log(OBS.data)
  }

</script>

<style scoped lang="scss">

.q-field, .q-menu, input {
  font-size: 10px;
}

</style>
