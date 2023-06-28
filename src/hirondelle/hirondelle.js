import { defineStore } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import _ from 'lodash'
import { useQuasar, copyToClipboard, uid } from 'quasar'
import OBSWebSocket from 'obs-websocket-js'

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
    nodeTypes: toRef(nodeTypes),
    view: {
      scaling: 1,
      panning: { x: 0, y: 0},
      yop: 14,
      to(pos){
        return { x: (pos.x / this.scaling) - this.panning.x, y: (pos.y / this.scaling) - this.panning.y }
      }
    },
    settings: {
      autoCloseNodes: false
    },
    addNode(nodeType, pos, id, values, options) {
      if (typeof(nodeType) == "string") nodeType = this.nodeTypes.find(t => t.type == nodeType)
      if (this.nodes.map(n => n.id).includes(id)) {
        console.error("Un node existe déjà avec cet id:", id)
        return
      }
      var values = values || {
        input: _.mapValues(nodeType.inputs, p => p.default),
        output: _.mapValues(nodeType.outputs, p => p.default) }
      var id = id || uid()
      var node = {
        type: nodeType,
        state: pos || { x: 0, y: 0},
        graph: this,
        id: id,
        values: toRef(values),
        running: ref(false),
        options: options || {},
        children: () => this.children(id),
        remove: () => this.removeNode(id),
        async start () {
          console.log("STARTING",this.type.title, this.type.category)
          console.log("With params:", node.values.value)
          node.running.value = true

          // Main action
          if (this.type.action) await this.type.action(node.values.value, node)
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
    addConnection({from, to, type="main", param1=null, param2=null, condition=null}) {
      if (typeof(from) == "string") {
        from = this.nodes.find(n => n.id == from)
      }
      if (typeof(to) == "string") {
        to = this.nodes.find(n => n.id == to)
      }
      if (!from || !to) {
        console.error("Il manque des nodes:", from, to)
        return
      }
      // On vérifie si la connection existe déjà
      if(this.connections.find(
        // Memes paramètres
        (c => c.from.id == from.id && c.to.id == to.id
        && c.type == type && c.param1 == param1 && c.param2 == param2 && c.condition == condition)
        // Connection temporaire (il ne peut y en avoir qu'une)
        || (c.type == "connection" && type == "connection"))) {
        console.log("Cette connection existe déjà")
        return
      }
      var connection = { from: from, to: to, graph: this, type:type }
      if (type == "condition") connection.condition = condition
      this.connections.push(connection)
      return connection
    },
    removeConnection(connection) {
      this.connections = this.connections.filter(c => c != connection)
    },
    removeTemporaryConnection() {
      this.connections = this.connections.filter(c => c.type != "temporary")
    },
    removeNode(id) {
      this.nodes = this.nodes.filter(n => n.id != id)
      this.connections = this.connections.filter(c => c.from.id != id && c.to.id != id)
    },
    children(nodeId) {
      return this.connections.filter(c => c.from.id == nodeId && c.type == "main").map(c => c.to)
    },
    childrenCondition(nodeId) {
      return {
        true: this.connections.filter(c => c.from.id == nodeId && c.type == "condition" && c.condition).map(c => c.to),
        false: this.connections.filter(c => c.from.id == nodeId && c.type == "condition" && !c.condition).map(c => c.to),
      }
    },
    sources(nodeId) {
      return this.connections.filter(c => c.to.id == nodeId).map(c => c.from)
    },
    save() {
      var obj = {}
      obj.nodes = this.nodes.map(n => ({
        type: n.type.type,
        id: n.id,
        state: n.state,
        values: n.values,
        options: n.options
      }) )
      var connections = _.cloneDeep(this.connections).filter(c => c.type != "temporary")
      connections.forEach(c => {
        c.from = c.from.id
        c.to = c.to.id
        delete c.graph
      })
      obj.connections = connections
      obj.view = { scaling: this.view.scaling, panning: this.view.panning }
      obj.settings = this.settings
      return obj
    },
    load(obj) {
      console.log("LOADING", obj)
      if (obj.nodes)
        obj.nodes.forEach(n => this.addNode(n.type, n.state, n.id, n.values, n.options))
      if (obj.connections)
        obj.connections.forEach(c => this.addConnection(c))
      if (obj.view) {
        this.view.scaling = obj.view.scaling
        this.view.panning = obj.view.panning
      }
      if (obj.settings) this.settings = obj.settings
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
