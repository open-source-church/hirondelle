import { defineStore } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import _ from 'lodash'
import { useQuasar, copyToClipboard, uid, colors } from 'quasar'
import { useHirondelle } from '../hirondelle'

const H = useHirondelle()

// WAIT

function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

H.registerNodeType({
  id: `BA:Wait`,
  title: "Wait...",
  category: "Time",
  description: "Wait some time",
  active: true,
  inputs: {
    time: { type: "number", default: 3000}
  },
  outputs: {
    elapsedTime: { type: "number", slider: {min: 0, max: 3000} },
    running: { type: "boolean" }
  },
  slots: {
    start: (node) => node.start(),
    stop: (node) =>  {
      clearInterval(node._interval)
      node.values.value.output.running.val = false
    },
  },
  signals: {
    started: null,
    finished: null,
  },
  action: async (values, node) => {
    console.log("AND WE WAIT", values.input.time.val, "ms")
    var t = 0
    var delta = 200
    node.outputs.value.elapsedTime.slider.max = values.input.time.val
    node._interval = setInterval(() => {
      t += delta
      values.output.elapsedTime.val = t
    }, delta)
    values.output.running.val = true
    node.emit("started")
    await delay(values.input.time.val)
    if (!values.output.running.val) return
    node.emit("finished")
    values.output.running.val = false
    clearInterval(node._interval)
    values.output.elapsedTime.val = values.input.time.val
    console.log("AND WE ARE DONE WAITING", values.input.time.val, "ms")
    return
  },
  accepts_input: false,
  accepts_output: false
})

H.registerNodeType({
  id: `BA:Time Interval`,
  title: "Time interval",
  category: "Time",
  active: true,
  inputs: {
    time: { type: "number", default: 5000, description: "Interval en ms"},
    active: { type: "boolean", default: true},
  },
  outputs: {
    active: { type: "boolean", default: true},
  },
  slots: {
    start: (node) => node.values.value.input.active.val = true,
    pause: (node) => node.values.value.input.active.val = false
  },
  signals: {
    ping: null
  },
  compute: async (opt, node) => {
    if (node._interval)
      clearInterval(node._interval)
    if (opt.input.active.val)
      node._interval = setInterval(() => node.emit("ping"), opt.input.time.val)
    opt.output.active.val = opt.input.active.val
  },
  accepts_input: false,
  accepts_output: false
})

// Condition

H.registerNodeType({
  id: `BA:Condition`,
  title: "Conditions",
  category: "Logic",
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
    if (!node.state.filter) node.state.filter = {}
    if (values.input.logic.val == "and") {
      var f = _.every
      var ignore = true
    }
    else {
      var f = _.some
      var ignore = false
    }
    var test = f(values.input.vars.val, v => {
      var filter = node.state.filter[v.name]
      if (!filter) return ignore
      var filterType = filter.filterType
      if (!filterType) return ignore
      if (v.type == "string") {
        var p2 = v.val || ""
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
      else if (v.type == "number") {
        var p = parseFloat(v.val)
        if(filterType == "=") return p == filter.equals
        if(filterType == ">") return p > filter.greaterThan
        if(filterType == "<") return p < filter.lesserThan
        if(filterType == "< x <") return filter.greaterThan < p && p < filter.lesserThan
      }
      else if (v.type == "boolean") {
        if(filterType == "=") return v.val == filter.equals
      }
      return !ignore
    })
    values.output.result.val = test
  },
  action(values, node) {
    node.compute()
    if (values.output.result.val) node.emit("valid")
    else node.emit("invalid")
  }
})

// Text builder
H.registerNodeType({
  id: `BA:Text`,
  title: "Text Builder",
  type: "param",
  category: "Operations",
  description: "Connectez des variables, et utilisez les dans la template, par exemple 'Merci [userName]!'",
  active: true,
  inputs: {
    template: { type: "string", textarea: true },
    vars: { type: "*", array: true }
  },
  outputs: {
    text: { type: "string", textarea: true },
  },
  compute (values) {
    var t = values.input.template.val || ""
    _.forEach(values.input.vars.val, v => t = t.replaceAll(`[${v.name}]`, v.val))
    values.output.text.val = t
  },
})

// Text builder
H.registerNodeType({
  id: `BA:Counter`,
  title: "Couter",
  type: "action",
  category: "Utilities",
  description: "Augmente sa valeur ee 1 chaque fois qu'il est appelé.",
  active: true,
  slots: {
    count: node => node.start(),
    reset: node => node.values.value.output.count.val = 0,
  },
  outputs: {
    count: { type: "number", default: 0 },
  },
  action (values, node) {
    values.output.count.val += 1
  },
  accepts_input: false,
})

// Operations
H.registerNodeType({
  id: `BA:ArithmeticOperation`,
  title: "Arithmetic operations",
  type: "param",
  category: "Operations",
  active: true,
  inputs: {
    operation: { type: "string", default: "add", options: [
      {id: "add", label: "Addition"},
      {id: "sub", label: "Substraction"},
      {id: "mul", label: "Multiplication"},
      {id: "div", label: "Division"},
      {id: "modulo", label: "Modulo"},
      {id: "pow", label: "Power"}
    ]},
    val1: { type: "number" },
    val2: { type: "number" }
  },
  outputs: {
    result: { type: "number" },
  },
  compute (values, node) {
    if (values.input.operation.val == "add") {
      values.output.result.val = values.input.val1.val + values.input.val2.val
    }
    if (values.input.operation.val == "sub") {
      values.output.result.val = values.input.val1.val - values.input.val2.val
    }
    if (values.input.operation.val == "mul") {
      values.output.result.val = values.input.val1.val * values.input.val2.val
    }
    if (values.input.operation.val == "div") {
      values.output.result.val = values.input.val1.val / values.input.val2.val
    }
    if (values.input.operation.val == "modulo") {
      values.output.result.val = values.input.val1.val % values.input.val2.val
    }
    if (values.input.operation.val == "pow") {
      values.output.result.val = values.input.val1.val ** values.input.val2.val
    }
    node.title.value = `Arithmetic operations: (${values.output.result.val})`
  },
})

// Pourcentage
H.registerNodeType({
  id: `BA:Percentage`,
  title: "Percentage",
  type: "param",
  category: "Operations",
  active: true,
  inputs: {
    type: { type: "number", default: 1, options: [
      { id: 1, label: "Sur 1" }, { id: 100, label: "Sur 100" }
    ]},
    value: { type: "number", default: 10 },
    min: { type: "number", default: 0 },
    max: { type: "number", default: 100 },
  },
  outputs: {
    percentage: { type: "number" },
  },
  compute (values, node) {
    values.output.percentage.val = (values.input.value.val - values.input.min.val) /
        (values.input.max.val - values.input.min.val)
    if (values.input.type.val == 100) values.output.percentage.val *= 100
    node.title.value = `Percentage: ${values.output.percentage.val} ${values.input.type.val == 100 ? '%' : ''}`
  }
})

// Logic
H.registerNodeType({
  id: `BA:LogicOperations`,
  title: "Boolean Logic",
  type: "param",
  category: "Logic",
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
  compute (values) {
    if (values.input.operation.val == "and") {
      values.output.result.val = _.every(values.input.values.val.map(v => v.val))
    }
    if (values.input.operation.val == "or") {
      values.output.result.val = _.some(values.input.values.val.map(v => v.val))
    }
    if (values.input.operation.val == "not") {
      values.output.result.val = !_.some(values.input.values.val.map(v => v.val))
    }
    if (values.input.operation.val == "eq") {
      values.output.result.val = _.uniq(Object.values(values.input.values.val.map(v => v.val))).length == 1
    }
    if (values.input.operation.val == "dif") {
      values.output.result.val = _.uniq(Object.values(values.input.values.val.map(v => v.val))).length == Object.values(values.input.values.val.map(v => v.val)).length
    }
  },
})


H.registerNodeType({
  id: `BA:ValueChanged`,
  title: "Value changed",
  type: "param",
  category: "Utilities",
  active: true,
  description: "Triggers whenever the value changed.",
  inputs: {
    watch: { type: "*" },
  },
  signals: {
    changed: null,
  },
  compute(values, node) {
    if (values.input.watch.val != node._lastwatch) node.emit("changed")
    node._lastwatch = _.cloneDeep(values.input.watch.val)
  }
})
