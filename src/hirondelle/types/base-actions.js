import { defineStore } from 'pinia'
import { ref, computed, watch, toRef, nextTick } from 'vue'
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
    start: (values, node) => node.start(),
    stop: (values, node) =>  {
      clearInterval(node._interval)
      values.output.running.val = false
    },
  },
  signals: {
    started: null,
    finished: null,
  },
  action: async (values, node) => {
    console.log("AND WE WAIT", values.input.time.val, "ms")
    var t = 0
    var delta = 1000
    node.outputs.value.elapsedTime.slider.max = values.input.time.val
    values.output.elapsedTime.val = 0
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
    start: (values, node) => values.input.active.val = true,
    pause: (values, node) => values.input.active.val = false
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
    logic: { type: "string", default: "and", checkbox:true, options: [
      { value: "and", label: "AND" },
      { value: "or", label: "OR" }
    ]},
    vars: { type: "*", multiple: true}
  },
  outputs: {
    result: { type: "boolean" }
  },
  accepts_output: false,
  accepts_input: false,
  slots: {
    test: (values, node) => node.start()
  },
  signals: {
    valid: null,
    invalid: null
  },
  compute(values, node) {
    // On s'assure que le state filter existe
    if (!node.state.filter) node.state.filter = {}
    // On ajoute les options du filtre dans les propriétés du noeuds
    values.input.vars.val.forEach(v => {
      if (!(v.name in node.state.filter)) node.state.filter[v.name] = {}
    })
    // On cache l'option logique s'il n'y a pas assez de variables pour que ça ait du sens
    node.inputs.value.logic.hidden = values.input.vars.val.length < 2
    // On test
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
  id: `BA:Counter`,
  title: "Couter",
  type: "action",
  category: "Utilities",
  description: "Augmente sa valeur ee 1 chaque fois qu'il est appelé.",
  active: true,
  slots: {
    count: (values, node) => node.start(),
    reset: (values) => values.output.count.val = 0,
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
      {value: "add", label: "Addition"},
      {value: "sub", label: "Substraction"},
      {value: "mul", label: "Multiplication"},
      {value: "div", label: "Division"},
      {value: "modulo", label: "Modulo"},
      {value: "pow", label: "Power"}
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
    type: { type: "number", default: 1, checkbox: true, options: [
      { value: 1, label: "Sur 1" }, { value: 100, label: "Sur 100" }
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
      {value: "and", label: "Et"},
      {value: "or", label: "Ou"},
      {value: "not", label: "Not"},
      {value: "eq", label: "Égal"},
      {value: "dif", label: "Different"}
    ]},
    values: { type: "boolean", multiple: true },
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


H.registerNodeType({
  id: `BA:Array`,
  title: "Array",
  type: "param",
  category: "Utilities",
  active: true,
  description: "To manipulate arrays.",
  inputs: {
    action: { type: "string", default: "spread", options: [
      { value: "spread", label: "Spread" },
      { value: "merge", label: "Merge" },
      { value: "get", label: "Get Value" },
    ] },
    arrays: { type: "*", multiple: true },
    name: { type: "string", default: "array" },
    index: { type: "number", slider : {min: 0, max: 0} },
    loop: { type: "boolean" },
  },
  slots: {
    startLoop: async (values, node) => {
      values.input.index.val = 0
      await nextTick()
      node.emit("forEach")
    },
    next: async (values, node) => {
      var i = values.input.index.val
      if (values.input.loop.val)
        values.input.index.val = (values.input.index.val + 1) % values.output.count.val
      else
        values.input.index.val = Math.min(values.input.index.val + 1, values.output.count.val -1)
      if (i != values.input.index.val) {
        await nextTick()
        node.emit("forEach")
      }
    },
  },
  signals: {
    forEach: null,
  },
  compute(values, node) {
    console.log("ARRAY STUFF")
    // On récupère toutes les valeurs dans une liste
    var vals = []
    values.input.arrays.val.forEach(val => {
      if (val.array)
        vals = vals.concat(val.val.map((v, i) => ({ name: `${val.name}-${i}`, type: val.type, val: v })))
      else
        vals.push({ name: val.name, type: val.type, val: val.val })
    })

    // Spread: on présente les valeurs toutes plates
    if (values.input.action.val == "spread") {
      node.outputs.value = {}
      vals.forEach((v) => {
        node.setOutput({ name: v.name, type: v.type, val: v.val})
      })
    }

    // Merge
    else if (values.input.action.val == "merge") {
      var name = values.input.name.val || "array"
      // On essaie de déterminer le type
      var types = _.uniq(values.input.arrays.val.map(v => v.type))
      var type = types.length == 1 ? types[0] : "*"
      // On change le nom du port
      node.setOutput({ id: "output-name", name, type, array: true, val: vals.map(v => v.val)}, true)
      // var v = node.outputs.value[name].newVar(vals.map(v => v.val), name)
      // values.output[name].val = v
    }

    // Get
    else if (values.input.action.val == "get") {
      // On change le nom du port
      node.inputs.value.index.slider.max = vals.length -1
      var val = vals.at(values.input.index.val)
      node.outputs.value = {}
      if (val) {
        val.id = "output-val"
        val.name = "value"
        node.setOutput(val)
      }
      node.setOutput({ id: "output-index", name: "index", type: "number", val: values.input.index.val })
    }
    // Dans tous les cas on rajoute un count
    node.setOutput({ id: "output-name", name: "count", type: "number", val: vals.length})

    node.inputs.value.name.hidden = values.input.action.val != "merge"
    node.inputs.value.index.hidden = values.input.action.val != "get"
    node.inputs.value.loop.hidden = values.input.action.val != "get"

    _.set(node._state, "slots.next.hidden", values.input.action.val != "get")
    _.set(node._state, "slots.startLoop.hidden", values.input.action.val != "get")
    _.set(node._state, "signals.forEach.hidden", values.input.action.val != "get")

    console.log(values.input.action.val, node.outputs.value)
  }
})
