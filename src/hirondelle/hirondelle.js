import { defineStore } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import _ from 'lodash'
import { useQuasar, copyToClipboard } from 'quasar'

export const useHirondelle = defineStore('hirondelle', () => {

  const $q = useQuasar()

  /*
    Un graph contient des nodes
  */
  const graph = ref({
    nodes: [],

  })

  /*

  */
  const transformStyle = computed(() => ({
    "transform-origin": "0 0",
    "transform": `scale(${editor.value.view.scaling}) translate(${editor.value.view.panning.x}px, ${editor.value.view.panning.y}px)`
  }))
  const editor = ref({
    graph: toRef(graph),
    view: {
      panning: { x: 77, y: 121},
      scaling: 1,
      style: toRef(transformStyle)
    }
  })

  return {
    graph, editor
  }
})
