import { defineStore } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import _ from 'lodash'
import { useQuasar, copyToClipboard, uid } from 'quasar'

export const useHirondelle = defineStore('hirondelle', () => {

  const $q = useQuasar()
  /*
    Node Types

    @type: string, must be unique
    @title: string
    @category: string,
    @params accepts_input: accepts inputs
    @params accepts_output: accepts ouputs
    @params opt.inputs: {
      description: string
      type: string|object|boolean|number,
      options?: array of values,
    }
  */
  const nodeTypes = ref([])
  const nodeTypesList = computed(() => nodeTypes.value.map(n => n.type))
  const registerNodeType = (opt) => {
    if(!opt.type) {
      throw new Error("Il faut un type (unique).")
      return
    }
    if(nodeTypesList.value.includes(opt.type)) {
      throw new Error(`Il y a déjà un type '${opt.type}' enregistré`)
      return
    }
    opt.accepts_input = opt.accepts_input != false
    opt.accepts_output = opt.accepts_output != false
    if (!opt.title) opt.title = opt.type
    if (!opt.category) opt.category = "Uncategorised"
    // On map les interfaces
    if (!opt.inputs) opt.inputs = []
    if (!opt.outputs) opt.outputs = []
    var both = ["inputs", "outputs"]
    both.forEach(type =>
      Object.keys(opt[type]).forEach(k => {
        let param = opt[type][k]
        console.log(" * ", k, param)
      })
    )
    nodeTypes.value.push(opt)
  }

  /*
    Un graph contient des nodes, et des connections
  */
  const graph = ref({
    nodes: [],
    connections: [
      // {from: {id: "33abce08-a4a0-4860-8fc2-856395f9d80d"}, to: {id: "8ee944e1-927d-44fd-bac1-12a200498a8d"}}
    ],
    paramConnections: [
      // { from: id, to: id, }
    ],
    nodeTypes: toRef(nodeTypes),
    view: {
      scaling: 1,
      panning: { x: 0, y: 0}
    },
    addNode(nodeType, pos, id, values) {
      if (typeof(nodeType) == "string") nodeType = this.nodeTypes.find(t => t.type == nodeType)
      if (this.nodes.map(n => n.id).includes(id)) {
        console.error("Un node existe déjà avec cet id:", id)
        return
      }
      var values = values || { input: {}, output: {} }
      var id = id || uid()
      var node = {
        type: nodeType,
        state: pos || { x: 0, y: 0},
        graph: this,
        id: id,
        values: values,
        running: ref(false),
        children: () => this.children(id),
        remove: () => this.removeNode(id),
        async start () {
          console.log("STARTING",this.type.title, this.type.category)
          console.log("With params:", node.values)
          node.running.value = true
          if (this.type.action) await this.type.action(node.values)
          node.running.value = false
          console.log("And done.")
          node.children().forEach(c => c.start())
        }
      }
      watch(node.values, (val, old) => {
        console.log("VALUE CHANGED", old, val)
      }, { deep: true })
      this.nodes.push(node)
    },
    addConnection(node1, node2) {
      if (typeof(node1) == "string") {
        node1 = this.nodes.find(n => n.id == node1)
      }
      if (typeof(node2) == "string") {
        node2 = this.nodes.find(n => n.id == node2)
      }
      if (!node1 || !node2) {
        console.error("Il manque des nodes:", node1, node2)
        return
      }
      if(this.connections.find(c => c.from.id == node1.id && c.to.id == node2.id)) {
        console.log("Cette connection existe déjà")
        return
      }
      this.connections.push({ from: node1, to: node2, graph: this })
    },
    addParamConnection(nodeId1, param1, nodeId2, param2) {
      var node1 = this.nodes.find(n => n.id == nodeId1)
      var node2 = this.nodes.find(n => n.id == nodeId2)


    },
    removeConnection(from, to) {
      this.connections = this.connections.filter(c => c.from.id != from.id || c.to.id != to.id)
    },
    removeNode(id) {
      this.nodes = this.nodes.filter(n => n.id != id)
      this.connections = this.connections.filter(c => c.from.id != id && c.to.id != id)
    },
    children(id) {
      return this.connections.filter(c => c.from.id == id).map(c => c.to)
    },
    save() {
      var obj = {}
      obj.nodes = this.nodes.map(n => ({
        type: n.type.type,
        id: n.id,
        state: n.state,
        values: n.values
      }) )
      obj.connections = this.connections.map(c => ({ from: c.from.id, to: c.to.id }))
      obj.view = this.view
      return obj
    },
    load(obj) {
      console.log("LOADING", obj)
      if (obj.nodes)
        obj.nodes.forEach(n => this.addNode(n.type, n.state, n.id, n.values))
      if (obj.connections)
        obj.connections.forEach(c => this.addConnection(c.from, c.to))
      if (obj.view) this.view = obj.view
      console.log(this.nodes.length, this.nodes)
    },
    startNodeType(typeName, outputValues) {
      var nodes = this.nodes.filter(n => n.type.type == typeName)
      nodes.forEach(n => Object.assign(n.values.output, outputValues))
      nodes.forEach(n => n.start())
    }
  })

  return {
    registerNodeType, nodeTypes,
    graph
  }
})
