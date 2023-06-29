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
    type: `BA:Wait`,
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

  // Condition

  H.registerNodeType({
    type: `BA:Condition`,
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
      console.log(test)
      // On appelle tous les noeuds connectés selon le résultat
      var targets = node.graph.targetsCondition(node.id)
      targets[test].forEach(n => n.start())
    }
  })

  // Text builder
  H.registerNodeType({
    type: `BA:Text`,
    title: "Text Builder",
    category: "Base",
    info: "Connectez des variables, et utilisez les dans la template, par exemple 'Merci [userName]!'",
    active: true,
    inputs: {
      template: { type: "textarea" },
      vars: { type: "object" }
    },
    outputs: {
      text: { type: "textarea" },
    },
    compute (params) {
      console.log("COMPUTING", params)
      var t = params.input.template
      _.forEach(params.input.vars, (val, param) => t = t.replaceAll(`[${param}]`, val))
      params.output.text = t
    },
    accepts_output: false,
    accepts_input: false,
  })


  return {}
})
