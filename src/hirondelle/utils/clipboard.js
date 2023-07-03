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
    copyToClipboard(JSON.stringify(clipboard.value, null, 2))
    $q.notify("Copié dans le presse papier")
  }

  const paste = (parent = null) => {

    var cb = _.cloneDeep(clipboard.value)

    // On prend la position médiane des éléments
    var x = cb.nodes.map(n => n.state.x).reduce((a, b) => a + b) / cb.nodes.length
    var y = cb.nodes.map(n => n.state.y).reduce((a, b) => a + b) / cb.nodes.length
    // On cherche un centre
    if (H._mousePos && H._mousePos.y > 100)
      // La position de la souris (sauf si elle est en haut, probablement sur le bouton coller)
      var center = H.graph.view.to(H._mousePos)
    else if (H._graphSize)
      // Le centre de l'écran
      var center = H.graph.view.to({
        x: H._graphSize.width / 2,
        y: H._graphSize.height / 2
      })
    else
      var center = {x: 0, y: 0}
    var delta = {
      x: center.x - x - 150,
      y: center.y - y - 25
    }

    var idMap = {}
    const fixNode = (node, l=0) => {
      // Changer la position selon la vue qui a bougé pour les nodes top-level
      if (l == 0) {
        node.state.x += delta.x,
        node.state.y += delta.y
      }
      // Nouvel id
      var id = uid()
      idMap[node.id] = id
      node.id = id
      if (node.nodes) node.nodes.forEach(n => fixNode(n, l+1))
    }
    cb.nodes.forEach(n => fixNode(n))

    // Fixer les connections avec les nouveaux IDs
    cb.connections.forEach(c => {
      if (c.from in idMap) c.from = idMap[c.from]
      if (c.to in idMap) c.to = idMap[c.to]
    })

    // On ajoute les nodes
    var nodes = []
    cb.nodes.forEach(n => nodes.push(H.graph.addNode(n, parent)))
    // On ajoute les connections
    cb.connections.forEach(c => H.graph.addConnection(c))

    // On est content
    return nodes
  }

  return {
    clipboard, empty, copy, paste
  }
})
