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
    active: true,
    compute(params, node) {
      console.log("COMPUTING GROUP")
      // FIXME: sais pas pourquoi je dois utiliser les .id pour trouver :/
      var internalInputs = node.graph.connections.filter(c => c.type == "param" && c.from.id == node.id && c.to.parent.id == node.id)
      var internalOutputs = node.graph.connections.filter(c => c.type == "param" && c.to.id == node.id && c.from.parent.id == node.id)

      internalInputs.forEach(c => {
        var input = c.to.type.inputs[c.input] || c.to.inputs[c.input]
        if (input)
          node.setInputs(c.input, c.to.type.inputs[c.input] || c.to.inputs[c.input])
        // c.to.values.input[c.input] = node.values.input[c.input]
      })
      internalOutputs.forEach(c => {
        node.setOutputs(c.output, c.from.type.outputs[c.output])
        // node.values.output[c.output] = c.to.values.value.output[c.output]
      })
    },
    action(values, node) {
      // call internal nodes
      var targets = node.graph.connections.filter(c => c.type == "main" && c.from.id == node.id && c.to.parent.id == node.id)
      targets.forEach(n => n.to.start())
    },
    then() {
      console.log("THEN", this)
    }
  })

  const paramTypes = {
    string: { default: "", color: "yellow" },
    number: { default: 0, color: "blue" },
    object: { default: {}, color: "grey" },
    rect: { default: {x: 0, y: 0, width: 0, height: 0}, color: "brown" },
    boolean: { default: false, color: "purple" },

  }

  /*
    Un graph contient des nodes, et des connections
  */
  const graph = ref({
    nodes: [],
    connections: [
      // {from: {id: "33abce08-a4a0-4860-8fc2-856395f9d80d"}, to: {id: "8ee944e1-927d-44fd-bac1-12a200498a8d"}}
    ],
    _connectors: {}, // to keep track of connectors positions
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
      // Finding average position
      var x = nodes.map(n => n.state.x).reduce((a, b) => a + b) / nodes.length
      var y = nodes.map(n => n.state.y).reduce((a, b) => a + b) / nodes.length

      console.log("CREATING GROUP")
      var group = this.addNode({
        type: "group",
        title: "New group",
        nodes: nodes,
        state: { x, y, open: true}
        }, parent)

      console.log("FIXING CONNECTIONS")
      // Fixing connections
      this.connections.forEach(c => {
        if (c.from.parent != c.to.parent) {
          if (c.from.parent.parent == c.to.parent) {
            const node = c.from.id
            c.from = c.from.parent
            console.log("CREATING CONNECTION TO GROUP")
            this.addConnection({from: node, to: group, type: c.type, input: c.input, output: c.output, condition: c.condition})
          }
          if (c.from.parent == c.to.parent.parent) {
            const node = c.to.id
            c.to = c.to.parent
            console.log("CREATING CONNECTION FROM GROUP")
            this.addConnection({from: group, to: node, type: c.type, input: c.output, output: c.output, condition: c.condition})
          }
        }
      })
      console.log("DONE")
      return group
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
        input: _.mapValues(newNode.type.inputs, p => p.default || paramTypes[p.type].default),
        output: _.mapValues(newNode.type.outputs, p => p.default || paramTypes[p.type].default) }
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
        inputs: ref(_.cloneDeep(newNode.type.inputs) || {}), // Dynamic inputs
        outputs: ref(_.cloneDeep(newNode.type.outputs) || {}), // Dynamic outpus
        inputOptions: ref({}), // to update input types conditions for specific nodes
        title: newNode.title,
        targets: (signal = null) => this.targets(id, signal),
      }
      node.startTargets = (signal = null) => node.targets(signal).forEach(t => t.node.start(t.slot))
      node.compute = () => this.compute(node)
      node.setInputOptions = (param, val) => node.inputOptions.value[param] = val
      // Node specific inputs (param)
      node.setInputs = (param, input) => {
        node.inputs.value[param] = input
        if (input.default && !node.values.value.input[param]) node.values.value.input[param] == input.default
      }
      // Node specific inputs (param)
      node.setOutputs = (param, output) => {
        node.outputs.value[param] = output
        if (output.default && !node.values.value.output[param]) node.values.value.output[param] == output.default
      }
      node.start = async function (slot = "main") {
        console.log("STARTING", slot, "in", node.type.title, node.type.category)
        console.log("With params:", node.values.value)
        node.running.value = true

        // Main action
        if (slot == "main") {
          if (node.type.action && node.type.active)
            await node.type.action(node.values.value, node)
        }
        // Subroutine / function
        else if (node.type.slots && slot in node.type.slots) {
          await node.type.slots[slot](node)
        }

        node.running.value = false
        console.log("And done.", node.type.title)

        // Call connected nodes
        // Pas pour les groupes, parce qu'on appelle là suite que si des noeuds internes le demandent
        if(node.type.id != "group") {
          node.startTargets()
        }
        // Si connecté à un group, on appelle le groupe
        var group = node.graph.connections.filter(c => c.type == "main" && c.from.id == node.id && c.from.parent.id == c.to.id)
        group.forEach(g => g.to.startTargets())
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
      watch(() => node.values.value.input, (val) => {
        this.onInputValuesChange(node)
      }, { deep: true })
      watch(() => node.values.value.output, (val) => {
        this.propagateOutputValues(node)
      }, { deep: true })

      // On assigne au parent
      if (!parent) parent = this
      node.parent = parent
      parent.nodes.push(node)
      // On retourne le node
      return node
    },
    compute(node) {
      var val = node.values.value || node.values // FIXME: pourquoi des fois c'est une ref et des fois pas?
      // FIXME: les choses se chargent pas dans le bon ordre
      try {
        if (node.type.compute) node.type.compute(val, node)
      } catch (err) {
        console.error(err)
      }
    },
    // When values.input changes
    onInputValuesChange(node) {
      console.log("UPDATING VALUES", node.type.title, node.values.value, node.values)
      var val = node.values.value || node.values // FIXME: pourquoi des fois c'est une ref et des fois pas?
      // On compute s'il y a des choses à faire
      this.compute(node)
      // On propage les résultats
      this.propagateOutputValues(node)
    },
    propagateOutputValues(node) {
      console.log("PROPAGATING VALUES", node.type.title)
      var val = node.values.value || node.values // FIXME: pourquoi des fois c'est une ref et des fois pas?
      // On update les params connections
      var connections = this.connections.filter(c => c.from.id == node.id && c.type == "param")
      // Warning: si plusieurs paramètres connectés sur la même valeurs, ça prend le dernier
      connections.forEach(c => {
        if (c.to.type.inputs[c.input]?.array)
          this.updateArrayInputParam(c.to, c.input)
        else if (c.from.type.id == "group" && c.from.parent != c.to.parent)
          c.to.values.input[c.input] = val.input[c.input]
        else if (c.to.type.id == "group" && c.from.parent != c.to.parent)
          c.to.values.output[c.output] = val.output[c.output]
        else
          c.to.values.input[c.input] = val.output[c.output]
      })
    },
    updateArrayInputParam(node, inputName) {
      // Si pas array, on ignore
      if (!node.inputs[inputName].array) return
      var connections = this.connections.filter(c => c.to.id == node.id && c.type == "param" && c.input == inputName)
      var indexes = {}
      node.values.input[inputName] = {}
      connections.forEach(c => {
        var i = indexes[c.output] || ""
        c.to.values.input[c.input][c.output+i] = c.from.values.output[c.output]
        indexes[c.output] = (indexes[c.output] || 1) + 1
      })
    },
    addConnection({from, to, type="main", input=null, output=null, condition=null, slot=null}) {
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
        (c => c.from.id == from.id && c.to.id == to.id && c.type == type &&
              c.input == input && c.output == output && c.condition == condition &&
              c.slot == slot )
        // Connection temporaire (il ne peut y en avoir qu'une)
        || (c.type == "temporary" && type == "temporary"))) {
        console.log("Cette connection existe déjà")
        return
      }
      var connection = { from, to, input, output, graph: this, type, slot }
      if (type == "condition") connection.condition = condition
      this.connections.push(connection)
      // Quand on crée une connections de paramètres, on update direct les values
      if (connection.type == "param") {
        this.propagateOutputValues(from)
      }
      return connection
    },
    removeConnection(connection) {
      var from = connection.from
      var to = connection.to
      var input = connection.input
      this.connections = this.connections.filter(c => c != connection)
      this.onInputValuesChange(to)
      if (input) this.updateArrayInputParam(to, input)
    },
    removeTemporaryConnection() {
      this.connections = this.connections.filter(c => c.type != "temporary")
    },
    removeNodes(nodes) {
      nodes.forEach(n => this.removeNode(n))
    },
    removeNode(node) {
      node.nodes.forEach(n => this.removeNode(n))
      var parent = node.parent || this
      parent.nodes = parent.nodes.filter(n => n.id != node.id)
      this.connections = this.connections.filter(c => c.from.id != node.id && c.to.id != node.id)
    },
    // La list des noeuds connectés depuis
    // On prend ceux qui ont le même parents, pour pas avoir les noeuds internes
    targets(nodeId, signal = null) {
      return this.connections.filter(
        c => c.from.id == nodeId &&
        c.type == "main" &&
        c.from.parent.id == c.to.parent.id &&
        c.signal == signal
      ).map(c => ({node: c.to, slot: c.slot}))
    },
    // La list des noeuds connectés par conditions
    targetsCondition(nodeId) {
      return {
        true: this.connections.filter(c => c.from.id == nodeId && c.type == "condition" && c.condition && c.from.parent.id == c.to.parent.id).map(c => c.to),
        false: this.connections.filter(c => c.from.id == nodeId && c.type == "condition" && !c.condition && c.from.parent.id == c.to.parent.id).map(c => c.to),
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
      obj.connections = connections.map(c => _.pickBy(c, v => !_.isNil(v)))
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
      console.log(obj.connections)
      if (obj.view) {
        this.view.scaling = obj.view.scaling
        this.view.panning = obj.view.panning
      }
      if (obj.settings) this.settings = obj.settings
    },
    flatNodes() {
      var nodes = []
      const addNodes = (parent) => {
        nodes = nodes.concat(parent.nodes)
        parent.nodes.forEach(n => addNodes(n))
      }
      addNodes(this)
      return nodes
    },
    async startNodeType(typeId, outputValues) {
      var nodes = this.flatNodes()
      console.log("NOEUDS:", nodes.length, this.nodes.length)
      nodes = nodes.filter(n => n.type.id == typeId)
      // var nodes = this.nodes.filter(n => n.type.id == typeId)
      nodes.forEach(n => {
        Object.assign(n.values.output, outputValues)
      })
      await nextTick() // Let reactivity do its thing
      nodes.forEach(n => n.start())
    },
    updateValuesFoNodeTypes(typeId) {
      var nodes = this.flatNodes().filter(n => n.type.id == typeId)
      nodes.forEach(n => n.updateValues())
    }
  })

  return {
    registerNodeType, nodeTypes,
    graph, paramTypes
  }
})
