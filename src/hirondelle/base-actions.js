import { defineStore } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import _ from 'lodash'
import { useQuasar, copyToClipboard, uid } from 'quasar'
import { useHirondelle } from './hirondelle'

export const useBaseActions = defineStore('baseActions', () => {

  const H = useHirondelle()

  // WAIT

  function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }

  H.registerNodeType({
    id: `BA:Wait`,
    title: "Wait...",
    category: "Base",
    active: true,
    inputs: {
      time: { type: "number"}
    },
    outputs: {
      elapsedTime: { type: "number" },
      running: { type: "boolean" }
    },
    action: async (opt) => {
      console.log("AND WE WAIT", opt.input.time, "ms")
      var t = 0
      var delta = 100
      var interval = setInterval(() => {
        t += delta
        console.log("... we waited", t, "ms")
        opt.output.elapsedTime = t
      }, delta)
      opt.output.running = true
      await delay(opt.input.time)
      opt.output.running = false
      clearInterval(interval)
      opt.output.elapsedTime = opt.input.time
      console.log("AND WE ARE DONE WAITING", opt.input.time, "ms")
      return
    }
  })

  H.registerNodeType({
    id: `BA:Time Interval`,
    title: "Time interval",
    category: "Base",
    active: true,
    inputs: {
      time: { type: "number", default: 5000, description: "Interval en ms"},
      active: { type: "boolean", default: true},
    },
    compute: async (opt, node) => {
      if (node._interval)
        clearInterval(node._interval)
      if (opt.input.active)
        node._interval = setInterval(node.start, opt.input.time)
    },
    accepts_input: false
  })

  // Condition

  H.registerNodeType({
    id: `BA:Condition`,
    title: "Conditions",
    category: "Base",
    active: true,
    inputs: {},
    outputs: {},
    accepts_output: false,
    options: {  },
    action(opt, node) {
      var source = node.graph.sources(node.id)
      if (source.length != 1) {
        throw new Error("Il doit y avoir exactement une source pour les conditions.")
        return
      }
      var source = source[0]
      var valid = true
      var test = _.every(source.values.output, (p, k) => {
        var filter = node.options[k]
        if (!filter) return true
        var filterType = filter.filterType
        if (!filterType) return true
        if (source.type.outputs[k].type == "string") {
          var p2 = p
          var ftext = filter.filterText
          if (!filter.matchCase) {
            p2 = p2.toLowerCase()
            ftext = ftext.toLowerCase()
          }
          if(filterType == "=") return p2 == ftext
          if(filterType == "Contient") return p2.includes(ftext)
          if(filterType == "Est contenu dans") return ftext.includes(p2)
          if(filterType == "regex") return p2.match(new RegExp(ftext)) != null
        }
        else if (source.type.outputs[k].type == "number") {
          p = parseFloat(p)
          if(filterType == "=") return p == filter.equals
          if(filterType == ">") return p > filter.greaterThan
          if(filterType == "<") return p < filter.lesserThan
          if(filterType == "< x <") return filter.greaterThan < p && p < filter.lesserThan
        }
        else if (source.type.outputs[k].type == "boolean") {
          if(filterType == "=") return p == filter.equals
        }
        return false
      })
      // opt.output.test = test
      // On appelle tous les noeuds connectés selon le résultat
      var targets = node.graph.targetsCondition(node.id)
      targets[test].forEach(n => n.start())
    }
  })

  // Text builder
  H.registerNodeType({
    id: `BA:Text`,
    title: "Text Builder",
    type: "param",
    category: "Base",
    info: "Connectez des variables, et utilisez les dans la template, par exemple 'Merci [userName]!'",
    active: true,
    inputs: {
      template: { type: "string", textarea: true },
      vars: { type: "*", array: true }
    },
    outputs: {
      text: { type: "string", textarea: true },
    },
    compute (params) {
      console.log("Computing Text Builder")
      var t = params.input.template || ""
      _.forEach(params.input.vars, (val, param) => t = t.replaceAll(`[${param}]`, val))
      params.output.text = t
    },
  })

  // Text builder
  H.registerNodeType({
    id: `BA:Counter`,
    title: "Couter",
    type: "action",
    category: "Base",
    info: "Augmente sa valeur de 1 chaque fois qu'il est appelé.",
    active: true,
    outputs: {
      count: { type: "number" },
    },
    action (params, node) {
      node.values.value.output.count += 1
    },
  })

  // Operations
  H.registerNodeType({
    id: `BA:ArithmeticOperation`,
    title: "Arithmetic operations",
    type: "param",
    category: "Base",
    info: "Connectez des variables, et utilisez les dans la template, par exemple 'Merci [userName]!'",
    active: true,
    inputs: {
      operation: { type: "string", default: "add", options: [
        {id: "add", text: "Addition"},
        {id: "sub", text: "Substraction"},
        {id: "mul", text: "Multiplication"},
        {id: "div", text: "Division"},
      ]},
      val1: { type: "number" },
      val2: { type: "number" }
    },
    outputs: {
      result: { type: "number" },
    },
    compute (params) {
      console.log("OPERATION", params)
      if (params.input.operation == "add") {
        params.output.result = params.input.val1 + params.input.val2
      }
      if (params.input.operation == "sub") {
        params.output.result = params.input.val1 - params.input.val2
      }
      if (params.input.operation == "mul") {
        params.output.result = params.input.val1 * params.input.val2
      }
      if (params.input.operation == "div") {
        params.output.result = params.input.val1 / params.input.val2
      }
    },
  })

  // Logic
  H.registerNodeType({
    id: `BA:LogicOperations`,
    title: "Logic",
    type: "param",
    category: "Base",
    active: true,
    inputs: {
      operation: { type: "string", default: "and", options: [
        {id: "and", text: "Et"},
        {id: "or", text: "Ou"},
        {id: "not", text: "Not"},
        {id: "eq", text: "Égal"},
        {id: "dif", text: "Different"}
      ]},
      values: { type: "boolean", array: true },
    },
    outputs: {
      result: { type: "boolean" },
    },
    compute (params) {
      console.log("LOGIC", params)
      if (params.input.operation == "and") {
        params.output.result = _.every(params.input.values)
      }
      if (params.input.operation == "or") {
        params.output.result = _.some(params.input.values)
      }
      if (params.input.operation == "not") {
        params.output.result = !params.input.values[Object.keys(params.input.values)[0]]
      }
      if (params.input.operation == "eq") {
        params.output.result = _.uniq(Object.values(params.input.values)).length == 1
      }
      if (params.input.operation == "dif") {
        params.output.result = _.uniq(Object.values(params.input.values)).length == Object.values(params.input.values).length
      }
    },
  })

  // Split
  H.registerNodeType({
    id: `BA:SplitRect`,
    title: "Split Rect",
    type: "param",
    category: "Base",
    active: true,
    inputs: {
      rect: { type: "rect" },
    },
    outputs: {
      x: { type: "number" },
      y: { type: "number" },
      width: { type: "number" },
      height: { type: "number" },
    },
    compute (params) {
      params.output.x = params.input.rect.x
      params.output.y = params.input.rect.y
      params.output.width = params.input.rect.width
      params.output.height = params.input.rect.height
    },
  })

  // Create Rect
  H.registerNodeType({
    id: `BA:CreateRect`,
    title: "Create Rect",
    type: "param",
    category: "Base",
    active: true,
    inputs: {
      x: { type: "number" },
      y: { type: "number" },
      width: { type: "number" },
      height: { type: "number" },
    },
    outputs: {
      rect: { type: "rect" },
    },
    compute (params) {
      params.output.rect.x = params.input.x
      params.output.rect.y = params.input.y
      params.output.rect.width = params.input.width
      params.output.rect.height = params.input.height
    },
  })

  // Vars
  H.registerNodeType({
    id: `BA:Var:Number`,
    title: "Nombre",
    type: "param",
    category: "Base",
    active: true,
    outputs: {
      number: { type: "number" },
    },
  })
  H.registerNodeType({
    id: `BA:Var:String`,
    title: "Texte",
    type: "param",
    category: "Base",
    active: true,
    outputs: {
      text: { type: "string" },
    },
  })
  H.registerNodeType({
    id: `BA:Var:Boolean`,
    title: "Boolean",
    type: "param",
    category: "Base",
    active: true,
    outputs: {
      boolean: { type: "boolean" },
    },
    slots: {
      setTrue: (node) => node.values.value.output.boolean = true,
      setFalse: (node) => node.values.value.output.boolean = false,
      toggle: (node) => node.values.value.output.boolean = !node.values.value.output.boolean,
    },
  })
  H.registerNodeType({
    id: `BA:RandomNumber`,
    title: "Random Number",
    type: "param",
    category: "Base",
    active: true,
    inputs: {
      min: { type: "number", default: 0 },
      max: { type: "number", default: 100},
      floating: { type: "boolean", default: false, description: "Retourne un nombre à virgule"}
    },
    outputs: {
      number: { type: "number" },
    },
    slots: {
      reset: (node) => node.compute(),
    },
    compute(values, node) {
      values.output.number = _.random(
        values.input.min, values.input.max, values.input.floating
      )
    }
  })


  return {}
})
