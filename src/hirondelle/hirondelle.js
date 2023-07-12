import { defineStore } from 'pinia'
import { ref, computed, watch, markRaw, toRef, nextTick, shallowRef, reactive } from 'vue'
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
    "*": { default: null, color: "grey"}
  }

  // Installée sur les types, permet de créer une variable facilement
  const newVar = function (val, name) {
    return reactive({
      id: uid(),
      type: this.type,
      val: val || this.default || ((this.array || this.multiple) ? [] : varTypes[this.type].default),
      // name: this.name,
      name: computed(() => name || this.displayName || this.name),
      options: computed(() => this.options),
      array: this.array,
      getType: () => this,
      // _type: markRaw(this)
    })
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
    opt.isGroup = opt.id == "group"

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
      console.log(targets)
      targets.forEach(c => c.to.start(c.slot))
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
      height: 0,
      top: 0 // La hauteur de viewport
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
      autoCloseNodes: false,
      autoSave: false
    },
    newGroup(nodes) {
      if(_.isEmpty(nodes)) return
      var parent = nodes[0].parent
      // Finding average position
      var x = nodes.map(n => n.state.x).reduce((a, b) => a + b) / nodes.length
      var y = nodes.map(n => n.state.y).reduce((a, b) => a + b) / nodes.length

      // On prend les connections qui sont vers/depuis ce groupe de noeuds mais pas dans
      var groupIds = _.flattenDeep([nodes.map(n => n.id), nodes.map(n => this.flatNodes(n).map(n => n.id))])
      var connections = this.connections.filter(c =>
        groupIds.includes(c.from.id) && !groupIds.includes(c.to.id) ||
        !groupIds.includes(c.from.id) && groupIds.includes(c.to.id)
        )

      var group = this.addNode({
        type: "group",
        title: "New group",
        nodes: nodes,
        state: { x, y, open: true}
        }, parent)

      // Fixing connections
      connections.forEach(c => {
        console.log(c)
        // Depuis le groupe
        if (!groupIds.includes(c.to.id)) {
          if (c.type == "flow") {
            const nodeId = c.from.id
            // On fait aller la connection depuis le groupe
            c.from = group
            // On ajoute une connection depuis le groupe
            this.addConnection({from: nodeId, to: group.id, type: "flow"})
          }
          else if (c.type == "param") {
            // On ajoute une connection clone
            this.addConnection({from: c.from.id, to: group.id, type: "clone", output: c.output.id})
          }
        }
        // Vers le groupe
        else if (!groupIds.includes(c.from.id)) {
          if (c.type == "flow") {
            const nodeId = c.to.id
            // On fait aller la connection vers le groupe
            c.to = group
            // On ajoute une connection depuis le groupe
            this.addConnection({from: group.id, to: nodeId, type: "flow"})
          }
          else if (c.type == "param") {
            this.addConnection({from: group.id, to: c.to.id, type: "clone", input: c.input.id})
          }
        }
        else console.error("BG", c.from.title, c.from.parent.title, c.to.parent.title)
      })

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
        _state: reactive({}), // state things that dont get saved, pray for them
        graph: this,
        running: ref(false),
        nodes: [],
        inputs: ref({}),
        outputs: ref({}),
        title: ref(newNode.title),
        parent: ref(null)
      }

      // Useful functions
      node.save = () => this.saveNode(node)
      node.emit = (signal = null) => node.targets(signal).forEach(t => t.node.start(t.slot))
      node.remove = () => this.removeNode(node)
      node.targets = (signal = null) => this.targets(id, signal),
      node.connectionsFrom = computed(() => this.connections.filter( c => c.from.id == node.id))
      node.connectionsTo = computed(() => this.connections.filter( c => c.to.id == node.id))
      node.ancestors = computed(() => node.parent?.value.ancestors?.concat([node.parent.value.id]) || [null])
      node.active = computed(() => node.type.active && _.every(node.nodes.map(n => n.active.value)))
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
        // console.log("STARTING", slot, "in", node.type.title, node.type.category)
        // console.log("With params:", node.values.value)
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
          await node.type.slots[slot](node.values.value, node)
        }

        node.running.value = false
        // console.log("And done.", node.type.title)
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
        // On met la valeur par défaut si pas déjà de valeur ou si une est fournie
        if (!this.values.value[type][obj.name] || obj.val != undefined) this.values.value[type][obj.name] = obj.newVar(obj.val)
        // On remet à jour les valeurs connectées je pense
        node.graph.connections.filter(c => c.output?.id == obj.id).forEach(c => c.updateVars())
      }

      // Ports & values
      // On ajoute un ref au node à chaque port, ainsi qu'un id (dans le doute)
      // (mais surtout pour permettre de garder la connection en changeant le nom du port)
      node.values = ref({ input: {}, output: {}})
      // Inputs
      if(newNode.type.inputs) {
        node.inputs.value = _.mapValues(newNode.type.inputs, (param, name) => _.assign(
          { id: uid(), node, name }, _.cloneDeep(param)))
        // Pour que "type.options" soit réactif, il faut le passer dans une function
        // Je crois que c'est parce que pinia wrap le store avec reactive, et unwrap automatiquement les ref à l'intérieur
        // Cf. https://pinia.vuejs.org/core-concepts/plugins.html#augmenting-a-store
        // Donc quand on access les options ici, elles sont unwrappées
        _.forEach(newNode.type.inputs, (param, name) => {
          if (param.options && typeof(param.options) == "function") node.inputs.value[name].options = param.options()
        })
        _.mapValues(node.inputs.value, (type, name) => node.values.value.input[name] = type.newVar())
      }

      // Outputs
      if(newNode.type.outputs) {
        node.outputs.value = _.mapValues(newNode.type.outputs, (param, name) => _.assign(
          { id: uid(), node, name, var: computed(() => node.values.value.output[name]) }, _.cloneDeep(param)))
        // See comment above
        _.forEach(newNode.type.outputs, (param, name) => {
          if (param.options && typeof(param.options) == "function") node.outputs.value[name].options = param.options()
        })
        _.mapValues(node.outputs.value, (type, name) => node.values.value.output[name] = type.newVar())
      }

      // On charge les valeurs
      if (newNode.values && node.type.id != "group") {
        _.forEach(newNode.values, async (val, name) => {
          try {
            node.values.value.input[name].val = val
            // On permet au node de se mettre à jour s'il a besoin
            node.compute()
          } catch (err) { console.error(err)}
        })
      }

      // On ajoute les éventuels enfants
      if (newNode.nodes?.length) {
        // Est-ce que le node a déjà été crée ?
        if (newNode.nodes[0].start)
          newNode.nodes.forEach(n => {
            console.log(n.parent, typeof(n.parent))
            n.parent.nodes = n.parent.nodes.filter(nn => nn != n)
            n.parent = node
            node.nodes.push(n)
          })
        else
          newNode.nodes.forEach(n => this.addNode(n, node))
      }

      // On place un garde devant la porte
      watch(() => node.values.value.input, (val, old) => {
        node.compute()
      }, { deep: true, immediate: true })

      // On assigne au parent
      if (!parent) parent = this
      node.parent.value = parent
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
        if (!fromParam) fromParam = from.outputs[output]
        if (!toParam) toParam = to.inputs[input]
        if (type == "param" && (!fromParam || !toParam) ||
            type == "clone" && (!fromParam && !toParam)) {

          console.error(`Les paramètres '${output}' et '${input}' sont introuvables. Maybe it will be fixed with a second pass. If this shows only once, everything is alright.`)
          return false
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
      connection.fromParamName = () => from.findParamName(fromParam?.id) || fromParam?.name
      connection.toParamName = () => to.findParamName(toParam?.id) || toParam?.name
      connection.remove = () => this.removeConnection(connection)
      connection.commonAncestor = computed(() =>  {
        if (connection.type == "temporary") return null
        var fromAncestors = connection.from.ancestors.value || connection.from.ancestors
        var toAncestors = connection.to.ancestors.value || connection.to.ancestors
        return fromAncestors.filter(a => toAncestors.includes(a)).at(-1)
      })
      connection.id = uid()
      this.connections.push(connection)
      connection.updateVars = function () {
        // Quand on crée une connections multiple, on ajoute la val à une liste et on garde une trace
        if (connection.type == "param" && toParam.multiple) {
          to.values.input[toParam.name].val = to.values.input[toParam.name].val.filter(v => !connection._toVarIds?.includes(v.id))
          to.values.input[toParam.name].val.push(from.values.output[fromParam.name])
          connection._toVarIds = [from.values.output[fromParam.name].id]
        }
        // Pour un tableau, on pousse la variable
        else if (connection.type == "param" && toParam.array) {
          // FIXME: c'est pas réactif
          to.values.input[toParam.name].val.push(from.values.output[fromParam.name].val)
        }
        // Quand on crée une connections de paramètres, on lie les valeurs
        else if (connection.type == "param" && !toParam.array) {
          to.values.input[toParam.name] = from.values.output[fromParam.name]
        }
      }
      connection.updateVars()
      if (connection.type == "param")
        watch(() => from.values, () => {
          console.error("Connection from value changed")
          connection.updateVars()
        })

      return connection
    },
    removeConnection(connection) {
      var val = connection.to.values.input?.[connection.toParamName()]
      // Si on supprime depuis multiple, on utilise la trace
      if (connection.type == "param" && connection.input.multiple)
        val.val = val.val.filter(v => !connection._toVarIds.includes(v.id))
      // Si c'est un array, on retire la première valeur égale
      else if (connection.type == "param" && connection.input.array) {
        var v = connection.from.values.output[connection.fromParamName()].val
        var i = val.val.findIndex(i => i == v)
        val.val.splice(i, 1)
      }
      // Si on supprime un lien, on recrée une variable
      else if (connection.type == "param" && !connection.input.array)
        val = connection.input.newVar()

      // Groups
      if (connection.type == "clone") {
        // On supprime les autres connection depuis ou vers ce param
        if (connection.input)
        this.connections.filter(c =>
          c.id != connection.id &&
          c.input?.id == connection.input.id &&
          c.from.parent == connection.from.parent
          ).forEach (c => c.remove())
        else this.connections.filter(c =>
          c.id != connection.id &&
          c.output?.id == connection.output?.id &&
          c.to.parent == connection.to.parent
          ).forEach (c => c.remove())
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
        if (!parent.inputs.value[name].multiple)  // && !parent.inputs.value[name].array
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
    async load(obj, replace=false)  {
      console.log("LOADING", obj, replace)
      this._loading = true

      if (replace) {
        this.nodes = []
        this.connections = []
      }

      if (obj.nodes)
        obj.nodes.forEach(n => this.addNode(_.cloneDeep(n)))

      await nextTick()

      if (obj.connections) {
        // Si les connections sont vers des ports dynamiques, parfois au chargement ça ne les trouve pas
        // Alors on ressaie un peu plus tard
        var unfound_connections = obj.connections.filter(c => !this.addConnection(c))
        if (unfound_connections) setTimeout(() => unfound_connections.forEach(c => this.addConnection(c)), 100)
      }

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
    async startNodeType(typeId, outputValues, signal) {
      var nodes = this.flatNodes()
      nodes = nodes.filter(n => n.type.id == typeId)
      nodes.forEach(n => {
        _.forEach(outputValues, (val, key) => {
          // if (n.outputs[key].array)
          // else
          n.values.output[key].val = val
        })
      })
      await nextTick() // Let reactivity do its thing
      nodes.forEach(n => n.start(signal))
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
