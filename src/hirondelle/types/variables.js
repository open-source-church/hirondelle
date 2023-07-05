import { defineStore } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import _ from 'lodash'
import { useQuasar, copyToClipboard, uid, colors } from 'quasar'
import { useHirondelle } from '../hirondelle'

const H = useHirondelle()

const categoryName = "Variables"

// Vars
H.registerNodeType({
  id: `BA:Var:Number`,
  title: "Number",
  type: "param",
  category: categoryName,
  active: true,
  inputs: {
    name: { type: "string", default: "number" },
    value: { type: "number" }
  },
  outputs: {
    number: { type: "number" },
  },
  compute (values, node) {
    var name = values.input.name.val || "number"
    // On change le nom du port
    if (!node._outputName) node._outputName = "number"
    if (name != node._outputName) {
      node.setOutputName(name, node._outputName)
      node._outputName = name
    }
    // On met à jour la valeur
    values.output[name].val = values.input.value.val
    node.title.value = `Number: ${name} (${values.input.value.val})`
  }
})
H.registerNodeType({
  id: `BA:Var:RandomNumber`,
  title: "Random Number",
  type: "param",
  category: categoryName,
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
    reset: (values, node) => node.compute(),
  },
  compute(values, node) {
    values.output.number.val = _.random(
      values.input.min.val, values.input.max.val, values.input.floating.val
    )
    node.title.value = node.type.title + ": " + values.output.number.val
  }
})
H.registerNodeType({
  id: `BA:Var:String`,
  title: "Text",
  type: "param",
  category: categoryName,
  info: "Au besoin, connectez des variables, et utilisez les dans la template, par exemple 'Merci [userName]!'",
  active: true,
  inputs: {
    name: { type: "string", default: "text" },
    vars: { type: "*", multiple: true },
    template: { type: "string" , default: ""},
    actions: { type: "string", default: [], checkbox: true, array: true, options: [
      { value: "split", label: "Split" },
      { value: "trim", label: "Trim" },
    ] },
    delimiter: { type: "string", default: "," },
  },
  outputs: {
    text: { type: "string" },
  },
  compute(values, node) {
    var name = values.input.name.val || "text"
    // On change le nom du port
    if (!node._outputName) node._outputName = "text"
    if (name != node._outputName) {
      node.setOutputName(name, node._outputName)
      node._outputName = name
    }
    // On met à jour la valeur
    var t = values.input.template.val || ""
    _.forEach(values.input.vars.val, v => {
      // var
      t = t.replaceAll(`[${v.name}]`, v.val)
    })
    // object
    // t = t.replaceAll(`/\[([^\.]+)\.([^\.]+)\]/`, (m, p1, p2) => {
    t = t.replaceAll(/\[([^\.]+)\.(\d+)\]/g, (m, p1, p2) => {
      console.log("Matching", m, p1, p2)
      var v = values.input.vars.val.find(v => v.name == p1)?.val[p2]
      return v || m
    })
    if (values.input.actions.val.includes("trim")) t = t.trim()

    if (values.input.actions.val.includes("split")) {
      t = t.split(values.input.delimiter.val)
      if (values.input.actions.val.includes("trim")) t = t.map(e => e.trim())
    }

    // FIXME: changer array comme ça n'est pas reactif quand on appel newVar
    node.outputs.value[name].array = values.input.actions.val.includes("split")
    values.output[name].val = t
    values.output[name].array = values.input.actions.val.includes("split")

    node.inputs.value.delimiter.hidden = !values.input.actions.val.includes("split")

    node.title.value = `Text: ${name} (${t})`
  }
})
H.registerNodeType({
  id: `BA:Var:Boolean`,
  title: "Boolean",
  type: "param",
  category: categoryName,
  active: true,
  inputs: {
    name: { type: "string", default: "boolean" },
    value: { type: "boolean" }
  },
  outputs: {
    boolean: { type: "boolean"},
  },
  slots: {
    setTrue: (values) => values.input.value.val = true,
    setFalse: (values) => values.input.value.val = false,
    toggle: (values) => values.input.value.val = !values.input.value.val,
  },
  compute (values, node) {
    console.log("COMPUTING VAR BOOLEAN")
    var name = values.input.name.val || "boolean"
    // On change le nom du port
    if (!node._outputName) node._outputName = "boolean"
    if (name != node._outputName) {
      node.setOutputName(name, node._outputName)
      node._outputName = name
    }
    // On met à jour la valeur
    values.output[name].val = values.input.value.val
    node.title.value = `Boolean: ${name} (${values.input.value.val})`
  }
})
H.registerNodeType({
  id: `BA:Var:Rect`,
  title: "Rect",
  type: "param",
  category: categoryName,
  active: true,
  inputs: {
    name: { type: "string", default: "rect" },
    split: { type: "boolean" },
    fromNumbers: { type: "boolean" },
    rect: { type: "rect" },
    left: { type: "number", hidden: true },
    top: { type: "number", hidden: true },
    width: { type: "number", hidden: true },
    height: { type: "number", hidden: true },
  },
  outputs: {
    rect: { type: "rect"},
    left: { type: "number", hidden: true },
    top: { type: "number", hidden: true },
    width: { type: "number", hidden: true },
    height: { type: "number", hidden: true },
  },
  compute (values, node) {
    var name = values.input.name.val || "rect"
    // On change le nom du port
    if (!node._outputName) node._outputName = "rect"
    if (name != node._outputName) {
      node.setOutputName(name, node._outputName)
      node._outputName = name
    }
    // On met à jour les valeurs
    var rect
    if (values.input.fromNumbers.val) {
      rect = { x: values.input.left.val, y: values.input.top.val,
               width: values.input.width.val, height: values.input.height.val }
    } else {
      rect = values.input.rect.val
    }
    values.output.left.val = rect.x
    values.output.top.val = rect.y
    values.output.width.val = rect.width
    values.output.height.val = rect.height
    values.output[name].val = rect
    // On gère l'affichage
    node.inputs.value.rect.hidden = values.input.fromNumbers.val
    node.outputs.value[name].hidden = values.input.split.val
    for (var p of ["left", "top", "width", "height"]) {
      node.inputs.value[p].hidden = !values.input.fromNumbers.val
      node.outputs.value[p].hidden = !values.input.split.val
    }
    node.title.value = `Rect: ${name}`
  }
})


H.registerNodeType({
  id: `BA:Var:Color`,
  title: "Color",
  type: "param",
  category: categoryName,
  active: true,
  inputs: {
    name: { type: "string", default: "color" },
    from: { type: "string", default: "string", checkbox: true, options: [
      { value: "string", label: "Text" },
      { value: "rgb", label: "RGB" },
      { value: "hsv", label: "HSV" },
    ]},
    to: { type: "string", default:["string"], checkbox: true, array: true, options: [
      { value: "string", label: "Text" },
      { value: "rgb", label: "RGB" },
      { value: "hsv", label: "HSV" },
    ]},
    color: { type: "color" },
    red: { type: "number", default: 215, slider: { min: 0, max: 255, color: "red" } },
    green: { type: "number", default: 0, slider: { min: 0, max: 255, color: "green" } },
    blue: { type: "number", default: 215, slider: { min: 0, max: 255, color: "blue" } },
    hue: { type: "number", default: 300, slider: { min: 0, max: 360 } },
    saturation: { type: "number", default: 100, slider: { min: 0, max: 100 } },
    value: { type: "number", default: 84, slider: { min: 0, max: 100 } },
    alpha: { type: "number", default: 100, slider: { min: 0, max: 100, color: "white" } },
  },
  outputs: {
    color: { type: "color"},
    red: { type: "number", hidden: true },
    green: { type: "number", hidden: true },
    blue: { type: "number", hidden: true },
    hue: { type: "number", hidden: true },
    saturation: { type: "number", hidden: true },
    value: { type: "number", hidden: true },
    alpha: { type: "number" },
  },
  compute (values, node) {
    var name = values.input.name.val || "color"
    // On change le nom du port
    if (!node._outputName) node._outputName = "color"
    if (name != node._outputName) {
      node.setOutputName(name, node._outputName)
      node._outputName = name
    }
    // On met à jour les valeurs
    var text = values.input.color.val
    var rgb = colors.hexToRgb(text)
    var hsv = colors.rgbToHsv(rgb)

    if (values.input.from.val == "rgb") {
      rgb = { r: values.input.red.val,
              g: values.input.green.val,
              b: values.input.blue.val,
              a: values.input.alpha.val }
      hsv = colors.rgbToHsv(rgb)
      text = colors.rgbToHex(rgb)
    }
    else if (values.input.from.val == "hsv") {
      hsv = { h: values.input.hue.val,
              s: values.input.saturation.val,
              v: values.input.value.val,
              a: values.input.alpha.val }
      rgb = colors.hsvToRgb(hsv)
      text = colors.rgbToHex(rgb)
    }
    else {
      var rgb = colors.hexToRgb(text)
      var hsv = colors.rgbToHsv(rgb)
    }

    values.output[name].val = text
    values.output.red.val = rgb.r
    values.output.green.val = rgb.g
    values.output.blue.val = rgb.b
    values.output.hue.val = hsv.h
    values.output.saturation.val = hsv.s
    values.output.value.val = hsv.v
    values.output.alpha.val = hsv.a || 100

    // On gère l'affichage
    node.inputs.value.color.hidden = values.input.from.val != "string"
    node.inputs.value.alpha.hidden = values.input.from.val == "string"
    node.outputs.value[name].hidden = !values.input.to.val.includes("string")
    for (var p of ["hue", "saturation", "value"]) {
      node.inputs.value[p].hidden = values.input.from.val != "hsv"
      node.outputs.value[p].hidden = !values.input.to.val.includes("hsv")
    }
    for (var p of ["red", "green", "blue"]) {
      node.inputs.value[p].hidden = values.input.from.val != "rgb"
      node.outputs.value[p].hidden = !values.input.to.val.includes("rgb")
    }
    node.title.value = `Color: ${name} (${text})`
  }
})
