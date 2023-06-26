import { defineStore } from 'pinia'
import { ref, computed, watch, markRaw } from 'vue'
import _ from 'lodash'
import { useQuasar } from 'quasar'

import { useNodesBaklava } from './nodes_baklava';

export const useSystemNodes = defineStore('systemnodes', () => {

  const $q = useQuasar()
  const N = useNodesBaklava()


  // Default actions
  async function DA_wait (params) {
    console.log("AND WE WAIT", params.time, "ms")
    await delay(parseInt(params.time))
    console.log("AND WE ARE DONE WAITING", params.time, "ms")
  }

  N.registerNode("System", {
    type: "System:DisplayNode",
    title: "Display Node",
    inputs: { input: "" },
    outputs: { output: { type: "display", port: false} },
    calculate: opt => ({ output: opt.input }),
  })

  N.registerNode("System", {
    type: "System:RandomNumber",
    title: "Random Number",
    inputs: { min: {type: "integer", default: 0}, max: {type: "integer", default: 100} },
    outputs: { number: "integer" },
    calculate: ({min, max}) => ({ number: Math.floor(Math.random() * (max - min + 1) + min)})
  })

  function delay(time) {
    return new Promise(resolve => setTimeout(resolve, time));
  }
  N.registerNode("System", {
    type: "System:Wait",
    title: "Wait...",
    inputs: { time: {type: "integer", default: 1000, title: "Temps en ms" }},
    outputs: { then: "integer", time: "integer" },
    async calculate ({time}) {
      console.log("AND WE WAIT", time, "ms")
      console.log(this)
      this.start()
      var t = 0
      var interval = setInterval(() => {
        t += 1000
        console.log("... we waited", t, "ms")
        this.outputs.time.value = t
      }, 1000)
      await delay(time)
      clearInterval(interval)
      console.log("AND WE ARE DONE WAITING", time, "ms")
      return { then: true, time: time }
    }
  })

})
