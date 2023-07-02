import { defineStore } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import _ from 'lodash'
import { useQuasar, copyToClipboard, uid, colors } from 'quasar'
import { useHirondelle } from './hirondelle'

export const useBaseActions = defineStore('baseActions', () => {

  const H = useHirondelle()
  const $q = useQuasar()

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
    slots: {
      start: (node) => node.start(),
      stop: (node) => clearInterval(node._interval),
    },
    signals: {
      started: null,
      finished: null,
    },
    action: async (opt, node) => {
      console.log("AND WE WAIT", opt.input.time, "ms")
      var t = 0
      var delta = 100
      node._interval = setInterval(() => {
        t += delta
        console.log("... we waited", t, "ms")
        opt.output.elapsedTime = t
      }, delta)
      opt.output.running = true
      node.emit("started")
      await delay(opt.input.time)
      node.emit("finished")
      opt.output.running = false
      clearInterval(node._interval)
      opt.output.elapsedTime = opt.input.time
      console.log("AND WE ARE DONE WAITING", opt.input.time, "ms")
      return
    },
    accepts_input: false,
    accepts_output: false
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
    outputs: {
      active: { type: "boolean", default: true},
    },
    slots: {
      start: (node) => node.values.value.input.active = true,
      pause: (node) => node.values.value.input.active = false
    },
    signals: {
      ping: null
    },
    compute: async (opt, node) => {
      if (node._interval)
        clearInterval(node._interval)
      if (opt.input.active)
        node._interval = setInterval(() => node.emit("ping"), opt.input.time)
      opt.output.active = opt.input.active
    },
    accepts_input: false,
    accepts_output: false
  })

  // Condition

  H.registerNodeType({
    id: `BA:Condition`,
    title: "Conditions",
    category: "Base",
    active: true,
    inputs: {
      logic: { type: "string", default: "and", options: [
        { id: "and", label: "AND" },
        { id: "or", label: "OR" }
      ]},
      vars: { type: "*", array: true}
    },
    outputs: {
      result: { type: "boolean" }
    },
    accepts_output: false,
    accepts_input: false,
    slots: {
      test: node => node.start()
    },
    signals: {
      valid: null,
      invalid: null
    },
    compute(values, node) {
      if (values.input.logic == "and") {
        var f = _.every
        var ignore = true
      }
      else {
        var f = _.some
        var ignore = false
      }
      var test = f(values.input.vars, (p, k) => {
        var filter = node.state.filter[k]
        if (!filter) return ignore
        var filterType = filter.filterType
        if (!filterType) return ignore
        if (node._paramSourcesType[k].type == "string") {
          var p2 = p || ""
          var ftext = filter.filterText || ""
          if (!filter.matchCase) {
            p2 = p2.toLowerCase()
            ftext = ftext.toLowerCase()
          }
          if(filterType == "=") return p2 == ftext
          if(filterType == "Contient") return p2.includes(ftext)
          if(filterType == "Est contenu dans") return ftext.includes(p2)
          if(filterType == "regex") return p2.match(new RegExp(ftext)) != null
        }
        else if (node._paramSourcesType[k].type == "number") {
          p = parseFloat(p)
          if(filterType == "=") return p == filter.equals
          if(filterType == ">") return p > filter.greaterThan
          if(filterType == "<") return p < filter.lesserThan
          if(filterType == "< x <") return filter.greaterThan < p && p < filter.lesserThan
        }
        else if (node._paramSourcesType[k].type == "boolean") {
          if(filterType == "=") return p == filter.equals
        }
        return !ignore
      })
      values.output.result = test
    },
    action(values, node) {
      if (values.output.result) node.emit("valid")
      else node.emit("invalid")
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
    slots: {
      count: node => node.start(),
      reset: node => node.values.value.output.count = 0,
    },
    outputs: {
      count: { type: "number" },
    },
    action (params, node) {
      node.values.value.output.count += 1
    },
    accepts_input: false,
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
        {id: "add", label: "Addition"},
        {id: "sub", label: "Substraction"},
        {id: "mul", label: "Multiplication"},
        {id: "div", label: "Division"},,
        {id: "modulo", label: "Modulo"},
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
      if (params.input.operation == "modulo") {
        params.output.result = params.input.val1 % params.input.val2
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
        {id: "and", label: "Et"},
        {id: "or", label: "Ou"},
        {id: "not", label: "Not"},
        {id: "eq", label: "Égal"},
        {id: "dif", label: "Different"}
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
    id: `BA:Rect:Split`,
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
    id: `BA:Rect:Create`,
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
    inputs: {
      text: { type: "string" },
    },
    outputs: {
      text: { type: "string" },
    },
    compute(values) {
      values.output.text = values.input.text
    }
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
    }
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
      node.title = node.type.title + ": " + values.output.number
    }
  })
  H.registerNodeType({
    id: `BA:ValueChanged`,
    title: "Value changed",
    type: "param",
    category: "Base",
    active: true,
    inputs: {
      watch: { type: "*" },
    },
    signals: {
      changed: null,
    },
    compute(values, node) {
      console.log("COMPUTING WATCH")
      if (values.input.watch != node._lastwatch) node.emit("changed")
      node._lastwatch = values.input.watch
    }
  })
  H.registerNodeType({
    id: `BA:Color:Split`,
    title: "Color split",
    type: "param",
    category: "Base",
    active: true,
    inputs: {
      color: { type: "color" },
    },
    outputs: {
      red: { type: "number" },
      green: { type: "number" },
      blue: { type: "number" },
      hue: { type: "number" },
      saturation: { type: "number" },
      value: { type: "number" },
      alpha: { type: "number" },
    },
    compute(values, node) {
      var rgb = colors.hexToRgb(values.input.color)
      var hsv = colors.rgbToHsv(rgb)
      values.output = {
        red: rgb.r, green: rgb.g, blue: rgb.b,
        hue: hsv.h, saturation: hsv.s, value: hsv.v,
        alpha: rgb.a || 100
      }
    }
  })
  H.registerNodeType({
    id: `BA:Color:RGBA`,
    title: "Color mix RGBA",
    type: "param",
    category: "Base",
    active: true,
    inputs: {
      red: { type: "number", default: 215, slider: { min: 0, max: 255, color: "red" } },
      green: { type: "number", default: 0, slider: { min: 0, max: 255, color: "green" } },
      blue: { type: "number", default: 215, slider: { min: 0, max: 255, color: "blue" } },
      alpha: { type: "number", default: 100, slider: { min: 0, max: 100, color: "white" } },
    },
    outputs: {
      color: { type: "color" },
    },
    compute(values, node) {
      values.output.color = colors.rgbToHex({
        r: values.input.red,
        g: values.input.green,
        b: values.input.blue,
        a: values.input.alpha,
      })
    }
  })
  H.registerNodeType({
    id: `BA:Color:HSV`,
    title: "Color mix HSV",
    type: "param",
    category: "Base",
    active: true,
    inputs: {
      hue: { type: "number", default: 300, slider: { min: 0, max: 360 } },
      saturation: { type: "number", default: 100, slider: { min: 0, max: 100 } },
      value: { type: "number", default: 84, slider: { min: 0, max: 100 } },
      alpha: { type: "number", default: 100, slider: { min: 0, max: 100 } },
    },
    outputs: {
      color: { type: "color" },
    },
    compute(values, node) {
      var rgb = colors.hsvToRgb({
        h: values.input.hue,
        s: values.input.saturation,
        v: values.input.value,
        a: values.input.alpha,
      })
      values.output.color = colors.rgbToHex(rgb)
    }
  })


  return {}
})
