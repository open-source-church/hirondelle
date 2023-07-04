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

  const varTypes = {
    string: { default: "", color: "yellow" },
    number: { default: 0, color: "blue" },
    object: { default: {}, color: "grey" },
    rect: { default: {x: 0, y: 0, width: 0, height: 0}, color: "brown" },
    boolean: { default: false, color: "purple" },
    color: { default: "#d700d7ff", color: "deep-orange"},
    "*": { default: null, color: "white"}
  }

  // Installée sur les types, permet de créer une variable facilement
  const newVar = function () {
    return {
      id: uid(),
      type: this.type,
      options: this.options,
      val: this.default || (this.array ? [] : varTypes[this.type].default),
      // name: this.name,
      name: computed(() => this.name)
    }
  }

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
    var both = ["inputs", "outputs"]
    both.forEach(type =>
      _.mapValues(opt[type], (type, name) => {
        type.newVar = newVar
      })
    )
    console.log(opt.id, opt.outputs)
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

    nodeTypes.value.push(opt)
  }
  registerNodeType({
    id: `group`,
    title: "Group",
    type: "system",
    active: true,
    compute(values, node) {
      console.log("COMPUTING GROUP")
    },
    action(values, node) {
      console.log("STARTING GROUPS")
      // call internal nodes
      var targets = node.graph.connections.filter(c => c.type == "flow" && c.from.id == node.id && c.to.parent.id == node.id)
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

  /*
    View
  */

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
    GRAPH
    Un graph contient des nodes, et des connections
  */
  const graph = ref({
    nodes: [],
    connections: [],
    _connectors: {}, // to keep track of connectors positions
    settings: {
      autoCloseNodes: false
    },
    vars: [
      {
        id: uid(),
        type: "string",
        value: "salut",
        options: ["A", "B", "C"]
      }
    ],
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
    /**
     * Crée une nouveau node.
     *
     * @param {Object} newNode - les paramètres du node à créer
     * @param {Strings|Object<type>} newNode.type - Le type du node.
     * @param {Object} [newNode.state] - La position du node, au formt `{ open:true, x:0, y:0 }`. Si null, centré sur l'écran si possible, ou à 0:0 sinon.
     * @param {string} [newNode.id=uid()] - L'id du node, doit être unique. UID généré si vide.
     * @param {Object[]} [newNode.nodes] - Les enfants du node (pour les groupes). Peut soit être des nodes existants, soit des nodes à créer qui le seront en appelant addNode.
     * @param {Object} [newNode.values] - Les valeurs du node, au format { input: {var1: val1, var2: val2}, ouput: { var1: ...}}
     * @param {Object<node>} [parent=null] - le parent, root si null.
     * @returns
     */
    addNode(newNode, parent=null) {
      // ID check
      if (this.nodes.map(n => n.id).includes(newNode.id)) {
        console.error("Un node existe déjà avec cet id:", newNode.id)
        return
      }
      var id = newNode.id || uid()

      // Type check
      var type = newNode.type
      if (typeof(newNode.type) == "string") newNode.type = nodeTypes.value.find(t => t.id == newNode.type)
      if(!newNode.type) {
        console.error("Pas trouvé de type pour", type)
        return
      }

      // State (position)
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
        id: id,
        type: newNode.type,
        state: state || { x: 0, y: 0, open: true},
        graph: this,
        running: ref(false),
        nodes: [],
        inputs: ref({}),
        outputs: ref({}),
        title: ref(newNode.title),
      }

      // Useful functions
      node.save = () => this.saveNode(node)
      node.emit = (signal = null) => node.targets(signal).forEach(t => t.node.start(t.slot))
      node.remove = () => this.removeNode(node)
      node.targets = (signal = null) => this.targets(id, signal),
      // Retourne le type de paramètre pour 'paramId'
      node.findParam = function (paramId) {
        return _.find(this.inputs, p => p.id == paramId) || _.find(this.outputs, p => p.id == paramId)
      }
      // Retourne le nom du paramètre pour 'paramId'
      node.findParamName = function (paramId) {
        return _.findKey(this.inputs, p => p.id == paramId) || _.findKey(this.outputs, p => p.id == paramId)
      }
      node.compute = function () {
        if (node._computing) return
        console.log("Computing", node.title.value || node.type.title)
        node._computing = true
        if (node.type.compute) node.type.compute(node.values.value, node)
        node._computing = false
      }

      node.start = async function (slot="flow") {
        if (!slot) slot = "flow" // Pourquoi?? il y a une valeur par defaut "flow" non?
        console.log("STARTING", slot, "in", node.type.title, node.type.category)
        console.log("With params:", node.values.value)
        node.running.value = true

        // Main action
        if (slot == "flow") {
          if (node.type.action && node.type.active)
            await node.type.action(node.values.value, node)

            // Call connected nodes
            // Pas pour les groupes, parce qu'on appelle là suite que si des noeuds internes le demandent
            if(node.type.id != "group") {
              node.emit()
            }
            // Si connecté à un group, on appelle le groupe
            var group = node.graph.connections.filter(c => c.type == "flow" && c.from.id == node.id && c.from.parent.id == c.to.id)
            group.forEach(g => g.to.emit())
        }
        // Subroutine / function
        else if (node.type.slots && slot in node.type.slots) {
          await node.type.slots[slot](node)
        }

        node.running.value = false
        console.log("And done.", node.type.title)
      }
      node.setInput = function (obj, replace=false) { node.setPort("input", obj, replace) }
      node.setOutput = function (obj, replace=false) { node.setPort("output", obj, replace) }
      node.setPort = function (type, obj, replace = false) {
        if (!type) type = "input"
        if (!obj.name) obj.name = "unamed"
        if (!obj.id) obj.id = uid()
        if (!obj.type) obj.type = "*"
        obj.newVar = newVar
        if (replace) node[type+"s"].value = {}
        node[type+"s"].value[obj.name] = obj
        // On met la valeur par défaut si pas déjà de valeur
        if (!this.values.value[type][obj.name]) this.values.value[type][obj.name] = obj.newVar()
      }
      node.setInputName = function(newName, oldName) { node.setPortName("input", newName, oldName)}
      node.setOutputName = function(newName, oldName) { node.setPortName("output", newName, oldName)}
      node.setPortName = function(type, newName, oldName) {
        var port = node[type+"s"].value
        var values = this.values.value[type]
        // On change le nom dans l'object
        node[type+"s"].value = _.mapKeys(node[type+"s"].value, (val, key) => key == oldName ? newName : key)
        // On change le nom du port
        node[type+"s"].value[newName].name = newName
        // On change le nom des valeurs
        this.values.value[type] = _.mapKeys(this.values.value[type], (val, key) => key == oldName ? newName : key)
      }

      // Ports & values
      // On ajoute un ref au node à chaque port, ainsi qu'un id (dans le doute)
      // (mais surtout pour permettre de garder la connection en changeant le nom du port)
      node.values = ref({ input: {}, output: {}})
      // Inputs
      if(newNode.type.inputs) {
        node.inputs.value = _.mapValues(newNode.type.inputs, (param, name) => _.assign({ id: uid(), node, name }, param))
        _.mapValues(node.inputs.value, (type, name) => node.values.value.input[name] = type.newVar())
      }

      // Outputs
      if(newNode.type.outputs) {
        node.outputs.value = _.mapValues(newNode.type.outputs, (param, name) => _.assign({ id: uid(), node, name }, param))
        _.mapValues(node.outputs.value, (type, name) => node.values.value.output[name] = type.newVar())
      }
      console.log("Types:", newNode.type.outputs)
      console.log("Types:", node.outputs.value)

      console.log(newNode.values)
      if (newNode.values && node.type.id != "group") {
        _.forEach(newNode.values, (val, name) => node.values.value.input[name].val = val)
      }

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

      watch(() => node.values.value.input, (val, old) => {
        node.compute()
      }, { deep: true, immediate: true })

      // On assigne au parent
      if (!parent) parent = this
      node.parent = parent
      parent.nodes.push(node)
      // On retourne le node
      return node
    },
    addConnection({from, to, type="flow", input=null, output=null, slot=null, signal=null}) {

      if (typeof(from) == "string") from = this.findNode(from)
      if (typeof(to) == "string") to = this.findNode(to)

      if (!from || !to) {
        console.error("Il manque des nodes:", from, to)
        return
      }
      if (type == "param" || type == "clone") {
        // On essaie avec les ids
        var fromParam = from.findParam(output)
        var toParam = to.findParam(input)
        // Sinon avec les noms
        console.log(from.outputs, to.inputs, output, input)
        if (!fromParam) fromParam = from.outputs[output]
        if (!toParam) toParam = to.inputs[input]

        if (type == "param" && (!fromParam || !toParam) ||
            type == "clone" && (!fromParam && !toParam)) {
          console.error(`Les paramètres '${output}' et '${input}' sont introuvables.`)
          return
        }
      }

      // On vérifie si la connection existe déjà
      if(this.connections.find(
        // Memes paramètres
        c => (c.from.id == from.id && c.to.id == to.id && c.type == type &&
              c.input?.id == toParam?.id && c.output?.id == fromParam?.id &&
              c.slot == slot && c.signal == signal)
              // Connection temporaire (il ne peut y en avoir qu'une)
              || (c.type == "temporary" && type == "temporary"))) {
        console.log("Cette connection existe déjà")
        return
      }

      var connection = { from, to, output: fromParam, input: toParam, graph: this, type, slot, signal }
      connection.save = () => this.saveConnection(connection)
      connection.fromParamName = () => from.findParamName(fromParam?.id)
      connection.toParamName = () => to.findParamName(toParam?.id)
      connection.remove = () => this.removeConnection(connection)
      connection.id = uid()
      this.connections.push(connection)

      // Quand on crée une connections de paramètres, on lie les valeurs
      if (connection.type == "param" && !toParam.array) {
        to.values.input[toParam.name] = from.values.output[fromParam.name]
      }
      // Pour un tableau, on pousse la variable, et on garde une trace
      if (connection.type == "param" && toParam.array) {
        // to.values.input[toParam.name].val.push(_.assign(from.values.output[fromParam.name], { source: from }))
        to.values.input[toParam.name].val.push(from.values.output[fromParam.name])
        connection._toVarId = from.values.output[fromParam.name].id
      }
      // Quand on clone, on lie aussi les valeurs
      else if (connection.type == "clone") {
        if (input) {
          // FIXME: Si plusieurs connections avec le même nom de paramètres ça va bugger
          from.setInput(toParam)
          from.values.input[toParam.name] = to.values.input[toParam.name]
        }
        else {
          to.setOutput(fromParam)
          to.values.output[fromParam.name] = from.values.output[fromParam.name]
        }
      }
      return connection
    },
    removeConnection(connection) {
      // Si on supprime un lien, on recrée une variable
      if (connection.type == "param" && !connection.input.array)
        connection.to.values.input[connection.toParamName()] = connection.input.newVar()
      // Si c'est un array, on retire la variable
      if (connection.type == "param" && connection.input.array)
        connection.to.values.input[connection.toParamName()].val =
          connection.to.values.input[connection.toParamName()].val.filter(v => v.id != connection._toVarId)
      // Groups
      if (connection.type == "clone") {
        if (connection.input) delete connection.from.inputs[connection.toParamName()]
        else delete connection.to.outputs[connection.fromParamName()]
      }
      // On supprime la connection
      this.connections = this.connections.filter(c => c.id != connection.id)
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
      this.connections.filter(c => c.from.id == node.id || c.to.id == node.id).forEach(c => c.remove())

    },
    // La list des noeuds connectés depuis
    // On prend ceux qui ont le même parents, pour pas avoir les noeuds internes
    targets(nodeId, signal = null) {
      return this.connections.filter(
        c => c.from.id == nodeId &&
        c.type == "flow" &&
        c.from.parent.id == c.to.parent.id &&
        c.signal == signal
      ).map(c => ({node: c.to, slot: c.slot}))
    },
    // La list des noeuds connectés vers
    sources(targetNodeId) {
      return this.connections.filter(c => c.to.id == targetNodeId && c.type == "flow").map(c => c.from)
    },
    saveNode(parent) {
      var node = {
        type: parent.type.id,
        id: parent.id,
        state: parent.state,
      }
      // On ne sauve que les inputs
      // if (parent.values.value) node.values = _.mapValues(parent.values.value.input, v => v.val)
      node.values = {}
      _.forEach(parent.inputs.value, (type, name) => {
        if (!parent.inputs.value[name].array)
          node.values[name] = parent.values.value.input[name]?.val
      })
      if (parent.title) node.title = parent.title
      if (!_.isEmpty(parent.nodes)) node.nodes = parent.nodes.map(n => n.save())
      return node
    },
    saveConnection(connection) {
      var conn = {
        from: connection.from.id,
        to: connection.to.id,
        output: connection.fromParamName(),
        input: connection.toParamName(),
        type: connection.type,
        slot: connection.slot,
        signal: connection.signal
      }
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
        _.forEach(outputValues, (val, key) => n.values.value.output[key].val = val)
      })
      await nextTick() // Let reactivity do its thing
      nodes.forEach(n => n.start())
    },
    computeNodesForTypes(typeId) {
      var nodes = this.flatNodes().filter(n => n.type.id == typeId)
      nodes.forEach(n => n.compute())
    }
  })

  return {
    registerNodeType, nodeTypes,
    graph, varTypes,
    view, nodeTypesOptions
  }
})
