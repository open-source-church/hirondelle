import { defineStore } from 'pinia'
import { ref, computed, watch, toRef, nextTick } from 'vue'
import _ from 'lodash'
import { useQuasar, copyToClipboard, uid } from 'quasar'
import OBSWebSocket from 'obs-websocket-js'

export const useHirondelle = defineStore('hirondelle', () => {

  const $q = useQuasar()
  /*
    Node Types

    @type: string, must be unique
    @id: string unique
    @category: string,
    @type: string parmi trigger, action, param
    @params accepts_input: accepts inputs
    @params accepts_output: accepts ouputs
    @params opt.inputs: {
      description: string
      type: string|object|boolean|number,
      options?: array of values,
      optionLabel?: string, key affiché dans la list si options est array of objects
      optionValue?: string, key retournée si options est array of objects
    }
    @action: callback appelé quand le node est trigger
    @compute: callback quand un des paramètres input change
  */
  const nodeTypes = ref([])
  const nodeTypesListIds = computed(() => nodeTypes.value.map(n => n.id))
  const registerNodeType = (opt) => {
    if(!opt.id) {
      throw new Error("Il faut un type (unique).")
      return
    }
    if(nodeTypesListIds.value.includes(opt.id)) {
      throw new Error(`Il y a déjà un type '${opt.id}' enregistré`)
      return
    }
    opt.accepts_input = opt.accepts_input != false
    opt.accepts_output = opt.accepts_output != false
    if (!opt.title) opt.title = opt.id
    // On map les interfaces
    if (!opt.inputs) opt.inputs = {}
    if (!opt.outputs) opt.outputs = {}
    // var both = ["inputs", "outputs"]
    // both.forEach(type =>
    //   Object.keys(opt[type]).forEach(k => {
    //     let param = opt[type][k]
    //   })
    // )
    if(!opt.type) opt.type = "action"
    if(opt.type == "trigger") opt.accepts_input = false
    if(opt.type == "param") {
      opt.accepts_input = false
      opt.accepts_output = false
    }
    opt.isTrigger = opt.type == "trigger"
    opt.isAction = opt.type == "action"
    opt.isParam = opt.type == "param"
    opt.isSystem = opt.type == "system"
    // opt.active = ref(opt.active)
    nodeTypes.value.push(opt)
  }
  registerNodeType({
    id: `group`,
    title: "Group",
    type: "system",
    active: true
  })

  const defaultValuesForParamType = {
    string: "",
    textarea: "",
    number: 0,
    object: {},
    rect: {x: 0, y: 0, width: 0, height: 0},
    boolean: false
  }

  /*
    Un graph contient des nodes, et des connections
  */
  const graph = ref({
    nodes: [],
    connections: [
      // {from: {id: "33abce08-a4a0-4860-8fc2-856395f9d80d"}, to: {id: "8ee944e1-927d-44fd-bac1-12a200498a8d"}}
    ],
    groups: [],
    view: {
      scaling: 1,
      panning: { x: 0, y: 0},
      to(pos){
        return { x: (pos.x / this.scaling) - this.panning.x, y: (pos.y / this.scaling) - this.panning.y }
      }
    },
    settings: {
      autoCloseNodes: false
    },
    newGroup(nodes) {
      var parent = nodes[0].parent
      var g = this.addNode({ type: "group", title: "New group", nodes: nodes }, parent)
      // Fixing connections
      this.connections.forEach(c => {
        if (c.from.parent != c.to.parent) {
          if (c.from.parent.parent == c.to.parent) c.from = c.from.parent
          if (c.from.parent == c.to.parent.parent) c.to = c.to.parent
        }
      })
      return g
    },
    findNode(nodeId, parent=null) {
      if (!parent) parent = this
      for (var node of parent.nodes) {
        if (node.id == nodeId) return node
        if (node.nodes.length) {
          var n = this.findNode(nodeId, node)
          if (n) return n
        }
      }
    },
    addNode(newNode, parent=null) {
      // nodeType, pos, id, values, options
      if (typeof(newNode.type) == "string") newNode.type = nodeTypes.value.find(t => t.id == newNode.type)
      if (this.nodes.map(n => n.id).includes(newNode.id)) {
        console.error("Un node existe déjà avec cet id:", newNode.id)
        return
      }
      if(!newNode.type) console.error("Pas trouvé de type pour", newNode)
      var values = newNode.values || {
        input: _.mapValues(newNode.type.inputs, p => p.default || defaultValuesForParamType[p.type]),
        output: _.mapValues(newNode.type.outputs, p => p.default || defaultValuesForParamType[p.type]) }
      var id = newNode.id || uid()
      var node = {
        type: newNode.type,
        state: newNode.state || { x: 0, y: 0, open: true},
        graph: this,
        id: id,
        values: toRef(values),
        running: ref(false),
        nodes: [],
        options: newNode.options || {}, // to store things, used for condition now
        inputs: ref({}), // Dynamic inputs
        outputs: ref({}), // Dynamic outpus
        inputOptions: ref({}), // to update input types conditions for specific nodes
        title: newNode.title,
        targets: () => this.targets(id),
      }
      node.setInputOptions = (param, val) => node.inputOptions.value[param] = val
      // Node specific inputs (param)
      node.setInputs = (param, input) => {
        node.inputs.value[param] = input
        if (input.default && !node.values.value.input[param]) node.values.value.input[param] == input.default
      }
      node.start = async function () {
        console.log("STARTING", node.type.title, node.type.category)
        console.log("With params:", node.values.value)
        node.running.value = true

        // Main action
        if (node.type.action && node.type.active) await node.type.action(node.values.value, node)
        node.running.value = false
        console.log("And done.")
        node.targets().forEach(c => c.start())
      }
      node.remove = () => this.removeNode(node)

      // On ajoute les éventuels enfants
      if (newNode.nodes?.length) {
        // Est-ce que le node a déjà été crée
        if (newNode.nodes[0].start)
          newNode.nodes.forEach(n => {
            n.parent.nodes = n.parent.nodes.filter(nn => nn != n)
            n.parent = node
            node.nodes.push(n)
          })
        else
          newNode.nodes.forEach(n => this.addNode(n, node))
      }
      watch(node.values, (val) => {
        this.updateValues(node)
      }, { deep: true, immediate: true })

      if (!parent) parent = this
      node.parent = parent
      parent.nodes.push(node)
    },
    // Update values for node
    updateValues(node) {
      console.log("UPDATING VALUES", node.type.title)
      var val = node.values.value || node.values // FIXME: pourquoi des fois c'est une ref et des fois pas?
      // On compute s'il y a des choses à faire
      if (node.type.compute) node.type.compute(val, node)
      // On update les params connections
      var connections = this.connections.filter(c => c.from.id == node.id && c.type == "param")
      // Warning: si plusieurs paramètres connectés sur la même valeurs, ça prend le dernier
      connections.forEach(c => {
        if (c.to.type.inputs[c.input].type == 'object')
        this.updateObjectParam(c.to, c.input)
        else
          c.to.values.input[c.input] = val.output[c.output]
      })
    },
    updateObjectParam(node, input) {
      var connections = this.connections.filter(c => c.to.id == node.id && c.type == "param" && c.input == input)
      var indexes = {}
      node.values.input[input] = {}
      connections.forEach(c => {
        var i = indexes[c.output] || ""
        c.to.values.input[c.input][c.output+i] = c.from.values.output[c.output]
        indexes[c.output] = (indexes[c.output] || 1) + 1
      })
    },
    addConnection({from, to, type="main", input=null, output=null, condition=null}) {
      if (typeof(from) == "string") {
        from = this.findNode(from)
      }
      if (typeof(to) == "string") {
        to = this.findNode(to)
      }
      if (!from || !to) {
        console.error("Il manque des nodes:", from, to)
        return
      }
      // On vérifie si la connection existe déjà
      if(this.connections.find(
        // Memes paramètres
        (c => c.from.id == from.id && c.to.id == to.id
        && c.type == type && c.input == input && c.output == output && c.condition == condition)
        // Connection temporaire (il ne peut y en avoir qu'une)
        || (c.type == "connection" && type == "connection"))) {
        console.log("Cette connection existe déjà")
        return
      }
      var connection = { from, to, input, output, graph: this, type:type }
      if (type == "condition") connection.condition = condition
      this.connections.push(connection)
      // Quand on crée une connections de paramètres, on update direct les values
      if (connection.type == "param") {
        this.updateValues(from)
      }
      return connection
    },
    removeConnection(connection) {
      this.connections = this.connections.filter(c => c != connection)
    },
    removeTemporaryConnection() {
      this.connections = this.connections.filter(c => c.type != "temporary")
    },
    removeNode(node) {
      node.nodes.forEach(n => this.removeNode(n))
      var parent = node.parent || this
      parent.nodes = parent.nodes.filter(n => n.id != node.id)
      this.connections = this.connections.filter(c => c.from.id != node.id && c.to.id != node.id)
    },
    // La list des noeuds connectés depuis
    targets(nodeId) {
      return this.connections.filter(c => c.from.id == nodeId && c.type == "main").map(c => c.to)
    },
    // La list des noeuds connectés par conditions
    targetsCondition(nodeId) {
      return {
        true: this.connections.filter(c => c.from.id == nodeId && c.type == "condition" && c.condition).map(c => c.to),
        false: this.connections.filter(c => c.from.id == nodeId && c.type == "condition" && !c.condition).map(c => c.to),
      }
    },
    // La list des noeuds connectés vers
    sources(targetNodeId) {
      return this.connections.filter(c => c.to.id == targetNodeId && c.type == "main").map(c => c.from)
    },
    // La liste des paramètres connectés vers le param
    // paramSources(targetNodeId, inputName) {
    //   var conns = this.connections.filter(c => c.to.id == targetNodeId && c.type == "param" && c.input == inputName)
    //   return _.chain(conns).keyBy("output").mapValues(c => c.from.values.output[c.output]).value()
    // },
    saveNodes(parent) {
      return parent.nodes.map(n => {
        var node = {
          type: n.type.id,
          id: n.id,
          state: n.state,
        }
        if (n.values) node.values = n.values
        if (!_.isEmpty(n.options)) node.options = n.options
        if (n.title) node.title = n.title
        if (!_.isEmpty(n.nodes)) node.nodes = this.saveNodes(n)
        return node
      })
    },
    save() {
      var obj = {}
      obj.nodes = this.saveNodes(this)
      var connections = _.cloneDeep(this.connections).filter(c => c.type != "temporary")
      connections.forEach(c => {
        c.from = c.from.id
        c.to = c.to.id
        delete c.graph
      })
      obj.connections = connections.map(c => _.pickBy(c))
      obj.view = { scaling: this.view.scaling, panning: this.view.panning }
      obj.settings = this.settings
      return obj
    },
    load(obj) {
      console.log("LOADING", obj)
      if (obj.nodes)
        obj.nodes.forEach(n => this.addNode(_.cloneDeep(n)))
      console.log(obj.connections, typeof(obj.connections))
      if (obj.connections)
        obj.connections.forEach(c => this.addConnection(c))
      if (obj.view) {
        this.view.scaling = obj.view.scaling
        this.view.panning = obj.view.panning
      }
      if (obj.settings) this.settings = obj.settings
    },
    async startNodeType(typeId, outputValues) {
      var nodes = this.nodes.filter(n => n.type.id == typeId)
      nodes.forEach(n => {
        Object.assign(n.values.output, outputValues)
      })
      await nextTick() // Let reactivity do its thing
      nodes.forEach(n => n.start())
    },
    updateValuesFoNodeTypes(typeId) {
      var nodes = this.nodes.filter(n => n.type.id == typeId)
      nodes.forEach(n => n.updateValues())
    }
  })

  return {
    registerNodeType, nodeTypes,
    graph
  }
})
