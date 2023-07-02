import { defineStore } from 'pinia'
import { ref, computed, watch, toRef, nextTick } from 'vue'
import _ from 'lodash'
import { useQuasar, copyToClipboard, uid } from 'quasar'
import { useHirondelle } from '../hirondelle'

export const useClipboard = defineStore('clipboard', () => {

  const $q = useQuasar()
  const H = useHirondelle()

  const clipboard = ref("")
  const empty = computed(() => _.isEmpty(clipboard.value))

  const copy = (nodes) => {
    var obj = {
      nodes: nodes.map(n => n.save()),
      connections: [],
      view: {
        panning: _.cloneDeep(H.graph.view.panning),
        scaling: H.graph.view.scaling
      }
    }
    if (nodes.length) {
      var ids = _.flattenDeep(H.graph.flatNodes(obj)).map(n => n.id)

      obj.connections = H.graph.connections
      .filter(c => ids.includes(c.from.id) && ids.includes(c.to.id))
      .map(c => c.save())
    }
    clipboard.value = obj
    console.log(obj)
    copyToClipboard(JSON.stringify(clipboard.value, null, 2))
    $q.notify("Copié dans le presse papier")
  }


  return {
    clipboard, empty, copy
  }
})
