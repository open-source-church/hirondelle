import { defineStore } from 'pinia'
import { ref, computed, watch, toRef, nextTick, shallowRef } from 'vue'
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
    compute(values, node) {
      console.log("COMPUTING GROUP")
      // FIXME: sais pas pourquoi je dois utiliser les .id pour trouver :/
      var internalInputs = node.graph.connections.filter(c => c.type == "clone" && c.from.id == node.id && c.to.parent.id == node.id)
      var internalOutputs = node.graph.connections.filter(c => c.type == "clone" && c.to.id == node.id && c.from.parent.id == node.id)
      // On ajoute les inputs
      internalInputs.forEach(c => {
        var input = c.to.inputs[c.input]
        //  On crée un input
        if (input) node.setInputs(c.input, input)
        // On met à jour la valeur du node lié
        console.log(values.input[c.input], c.to.values.input[c.input])
        if (values.input[c.input]) c.to.values.input[c.input] = values.input[c.input]
      })
      // On supprime les inputs qui ne sont plus là
      _.forEach(node.inputs.value, (v, k) => {
        if (!internalInputs.map(c => c.input).includes(k)) delete node.inputs.value[k]
      })
      // On ajoute les outputs
      internalOutputs.forEach(c => {
        // On crée un output
        node.setOutputs(c.output, c.from.type.outputs[c.output])
        // On met à jour la valeur
        values.output[c.output] = c.from.values.output[c.output]
      })
      // On supprime les outputs qui ne sont plus là
      _.forEach(node.outputs.value, (v, k) => {
        if (!internalOutputs.map(c => c.output).includes(k)) delete node.outputs.value[k]
      })
    },
    action(values, node) {
      console.log("STARTING GROUPS")
      // call internal nodes
      var targets = node.graph.connections.filter(c => c.type == "main" && c.from.id == node.id && c.to.parent.id == node.id)
      targets.forEach(n => n.to.start())
    }
  })
  // Retourne une liste d'objets avec les types pour affichage dans listes
  const nodeTypesOptions = computed(() => {
    var options = []

    var cats = _.uniq(nodeTypes.value.map(t => t.category)).filter(c => c)
    cats.forEach(cat => {
      options.push({ header: true, label: cat })

      nodeTypes.value
      .filter(t => t.category == cat)
      .forEach(t => options.push({
        label: t.title,
        description: t.description,
        category: t.category,
        type: t
      }))
    })

    return options
  })

  const paramTypes = {
    string: { default: "", color: "yellow" },
    number: { default: 0, color: "blue" },
    object: { default: {}, color: "grey" },
    rect: { default: {x: 0, y: 0, width: 0, height: 0}, color: "brown" },
    boolean: { default: false, color: "purple" },
    color: { default: "#d700d7ff", color: "deep-orange"},
    "*": { default: null}
  }

  // View
  const view = ref ({
    scaling: 1,
    panning: { x: 0, y: 0},
    // Retourne la position dans le système de coordonée du graph
    to(pos){
      return { x: (pos.x / this.scaling) - this.panning.x, y: (pos.y / this.scaling) - this.panning.y }
    },
    // Retourne la position du graph dans l'affichage
    from(pos){
      return { x: (pos.x + this.panning.x) * this.scaling, y: (pos.y + this.panning.y) * this.scaling }
    },
    dimensions: {
      width: 0,
      height: 0
    },
    mouse: { x: 0, y: 0}
  })
  view.value.viewport = computed(() => {
    if (!view.value.dimensions.width) return {}
    var size = {}
    var topLeft = view.value.to({ x: 0, y:0 })
    var bottomRight = view.value.to({ x: view.value.dimensions.width, y: view.value.dimensions.height })
    size.top = topLeft.y
    size.left = topLeft.x
    size.bottom = bottomRight.y
    size.right = bottomRight.x
    return size
  })

  /*
    Un graph contient des nodes, et des connections
  */
  const graph = ref({
    nodes: [],
    connections: [],
    _connectors: {}, // to keep track of connectors positions
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
            var type = c.type == "param" ? "clone" : c.type
            this.addConnection({from: node, to: group, type, input: c.input, output: c.output})
          }
          if (c.from.parent == c.to.parent.parent) {
            const node = c.to.id
            c.to = c.to.parent
            var type = c.type == "param" ? "clone" : c.type
            this.addConnection({from: group, to: node, type, input: c.output, output: c.output})
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
      var type = newNode.type
      if (typeof(newNode.type) == "string") newNode.type = nodeTypes.value.find(t => t.id == newNode.type)
      if (this.nodes.map(n => n.id).includes(newNode.id)) {
        console.error("Un node existe déjà avec cet id:", newNode.id)
        return
      }
      if(!newNode.type) {
        console.error("Pas trouvé de type pour", type)
        return
      }
      var values = newNode.values || {
        input: _.mapValues(newNode.type.inputs, p => p.default || paramTypes[p.type].default),
        output: _.mapValues(newNode.type.outputs, p => p.default || paramTypes[p.type].default) }
      var id = newNode.id || uid()
      var state = newNode.state
      // On centre le node sur l'écran si possible
      if (!state && view.value.dimensions.width) {
        var center = view.value.to({ x: view.value.dimensions.width / 2, y: view.value.dimensions.height / 2})
        state = {
          open: true,
          x: center.x - 150,
          y: center.y - 100
         }
      }
      var node = {
        type: newNode.type,
        state: state || { x: 0, y: 0, open: true},
        graph: this,
        id: id,
        values: toRef(values),
        running: ref(false),
        nodes: [],
        // inputs: ref(newNode.type.inputs || {}), // Dynamic inputs
        // outputs: ref(newNode.type.outputs || {}), // Dynamic outpus
        inputs: ref({}), // Dynamic inputs
        outputs: ref({}), // Dynamic outpus
        title: newNode.title,
        targets: (signal = null) => this.targets(id, signal),
      }
      if(newNode.type.inputs)
        node.inputs = ref(_.mapValues(newNode.type.inputs, p => p))
      if(newNode.type.outputs)
        node.outputs = ref(_.mapValues(newNode.type.outputs, p => p))

      node.save = () => this.saveNode(node)
      node.emit = (signal = null) => node.targets(signal).forEach(t => t.node.start(t.slot))
      node.compute = () => this.compute(node)
      // Node specific inputs (param)
      node.setInputs = (param, input) => {
        node.inputs.value[param] = input
        if (input.default && !node.values.value.input[param]) node.values.value.input[param] = input.default
      }
      // Node specific inputs (param)
      node.setOutputs = (param, output) => {
        node.outputs.value[param] = output
        if (output.default && !node.values.value.output[param]) node.values.value.output[param] == output.default
      }
      node.start = async function (slot="main") {
        if (!slot) slot = "main" // Pourquoi?? il y a une valeur par defaut "main" non?
        console.log("STARTING", slot, "in", node.type.title, node.type.category)
        console.log("With params:", node.values.value)
        node.running.value = true

        // Main action
        if (slot == "main") {
          if (node.type.action && node.type.active)
            await node.type.action(node.values.value, node)

            // Call connected nodes
            // Pas pour les groupes, parce qu'on appelle là suite que si des noeuds internes le demandent
            if(node.type.id != "group") {
              node.emit()
            }
            // Si connecté à un group, on appelle le groupe
            var group = node.graph.connections.filter(c => c.type == "main" && c.from.id == node.id && c.from.parent.id == c.to.id)
            group.forEach(g => g.to.emit())
        }
        // Subroutine / function
        else if (node.type.slots && slot in node.type.slots) {
          await node.type.slots[slot](node)
        }

        node.running.value = false
        console.log("And done.", node.type.title)
      }
      node.remove = () => this.removeNode(node)

      // On ajoute les éventuels enfants
      if (newNode.nodes?.length) {
        // Est-ce que le node a déjà été crée ?
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
      }, { deep: true, immediate: true })
      watch(() => node.values.value.output, (val) => {
        this.propagateOutputValues(node)
      }, { deep: true, immediate: true })

      // On assigne au parent
      if (!parent) parent = this
      node.parent = parent
      parent.nodes.push(node)
      // On retourne le node
      return node
    },
    compute(node) {
      if (this._loading) return
      var val = node.values.value || node.values // FIXME: pourquoi des fois c'est une ref et des fois pas?
      // FIXME: les choses se chargent pas dans le bon ordre
      try {
        if (node.type.compute) node.type.compute(val, node)
      } catch (err) {
        console.error(err)
      }
      // On ne garde que les valeurs qui sont dans les inputs/outputs
      var inputs = node.inputs.value || node.inputs // again...
      _.forEach(val.input, (v, k) => {
        if(!inputs[k]) delete val.input[k]
      })
      var outputs = node.outputs.value || node.outputs // again...
      _.forEach(val.output, (v, k) => {
        if(!outputs[k]) delete val.output[k]
      })
    },
    // When values.input changes
    onInputValuesChange(node) {
      console.log("UPDATING VALUES", node.type.title)
      var val = node.values.value || node.values // FIXME: pourquoi des fois c'est une ref et des fois pas?
      // On compute s'il y a des choses à faire
      this.compute(node)
      // // On propage les résultats // ca se fait automatiquement normalement
      // this.propagateOutputValues(node)
    },
    propagateOutputValues(node) {
      // console.log(node.type.id)
      // if (this._loading && node.type.id == "group") return
      console.log("PROPAGATING VALUES", node.type.title)
      var val = node.values.value || node.values // FIXME: pourquoi des fois c'est une ref et des fois pas?
      // On update les params connections
      var connections = this.connections.filter(c => c.from.id == node.id && (c.type == "param" || c.type == "clone"))
      // Warning: si plusieurs paramètres connectés sur la même valeurs, ça prend le dernier
      connections.forEach(c => {
        if (c.to.type.inputs[c.input]?.array)
          this.updateArrayInputParam(c.to, c.input)
        else if (c.type == "param") {
          // On update la valeur
          c.to.values.input[c.input] = val.output[c.output]
          c.to.compute()
        }
        else
          c.to.compute()
      })
    },
    updateArrayInputParam(node, inputName) {
      // Si pas array, on ignore
      if (!node.inputs[inputName].array) return
      var connections = this.connections.filter(c => c.to.id == node.id && c.type == "param" && c.input == inputName)
      // Tentative de faire un truc qui donne des valeurs différentes à des variables qui ont le même nom
      // Mais ensuite c'est compliqué pour récupérer les types sources de chaque variable, puisque le nom a changé
      // Alors on garde ça quelque part en stock. C'est pas très propre.
      var indexes = {}
      node.values.input[inputName] = {}
      node._paramSourcesType = {} // Pour garder track des types
      connections.forEach(c => {
        var i = indexes[c.output] || ""
        c.to.values.input[c.input][c.output+i] = c.from.values.output[c.output]
        node._paramSourcesType[c.output+i] = c.from.outputs[c.output]
        indexes[c.output] = (indexes[c.output] || 1) + 1
      })
    },
    addConnection({from, to, type="main", input=null, output=null, slot=null, signal=null}) {
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
              c.input == input && c.output == output &&
              c.slot == slot && c.signal == signal)
        // Connection temporaire (il ne peut y en avoir qu'une)
        || (c.type == "temporary" && type == "temporary"))) {
        console.log("Cette connection existe déjà")
        return
      }
      var connection = { from, to, input, output, graph: this, type, slot, signal }
      connection.save = () => this.saveConnection(connection)
      this.connections.push(connection)
      // Quand on crée une connections de paramètres, on update direct les values
      if (connection.type == "param") {
        this.propagateOutputValues(from)
      }
      else if (connection.type == "clone") {
        from.compute()
        to.compute()
      }
      return connection
    },
    removeConnection(connection) {
      var from = connection.from
      var to = connection.to
      var input = connection.input
      var type = connection.type
      this.connections = this.connections.filter(c => c != connection)
      to.compute()
      if (input) this.updateArrayInputParam(to, input)
      // Groups
      if (type == "clone") {
        from.compute()
        to.compute()
      }
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
    // La list des noeuds connectés vers
    sources(targetNodeId) {
      return this.connections.filter(c => c.to.id == targetNodeId && c.type == "main").map(c => c.from)
    },
    // La liste des paramètres connectés vers le param
    paramSources(targetNodeId) {
      var conns = this.connections.filter(c => c.to.id == targetNodeId && c.type == "param")
      return _.chain(conns)
      .map(c => ({input: c.input, output: c.output, type: c.from.outputs[c.output]}))
      .groupBy("input")
      .mapValues(c => _.chain(c).keyBy("output").mapValues("type").value())
      .value()
    },
    saveNode(parent) {
      var node = {
        type: parent.type.id,
        id: parent.id,
        state: parent.state,
      }
      if (parent.values) node.values = _.cloneDeep(parent.values.value)
      if (parent.title) node.title = parent.title
      if (!_.isEmpty(parent.nodes)) node.nodes = parent.nodes.map(n => n.save())
      return node
    },
    saveConnection(connection) {
      var conn = _.cloneDeep(connection)
      conn.from = conn.from.id
      conn.to = conn.to.id
      delete conn.graph
      delete conn.save
      conn = _.pickBy(conn, v => !_.isNil(v))
      return conn
    },
    save() {
      var obj = {}
      obj.nodes = this.nodes.map(n => n.save())
      obj.connections = this.connections.filter(c => c.type != "temporary").map(c => c.save())
      obj.view = { scaling: view.value.scaling, panning: view.value.panning }
      obj.settings = this.settings
      return obj
    },
    load(obj) {
      console.log("LOADING", obj)
      this._loading = true
      if (obj.nodes)
        obj.nodes.forEach(n => this.addNode(_.cloneDeep(n)))
      if (obj.connections)
        obj.connections.forEach(c => this.addConnection(c))
      if (obj.view) {
        view.value.scaling = obj.view.scaling
        view.value.panning = obj.view.panning
      }
      if (obj.settings) this.settings = obj.settings
      this._loading = false
      // Compute all nodes
      this.flatNodes().forEach(n => n.compute())
    },
    flatNodes(root=this) {
      var nodes = []
      const addNodes = (parent) => {
        if (parent.nodes) {
          nodes = nodes.concat(parent.nodes)
          parent.nodes.forEach(n => addNodes(n))
        }
      }
      addNodes(root)
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
    graph, paramTypes,
    view, nodeTypesOptions
  }
})
