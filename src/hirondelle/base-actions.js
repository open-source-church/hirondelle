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
      time: { type: Number}
    },
    outputs: {
      elapsedTime: { type: Number }
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
      await delay(opt.input.time)
      clearInterval(interval)
      opt.output.elapsedTime = opt.input.time
      console.log("AND WE ARE DONE WAITING", opt.input.time, "ms")
      return
    }
  })


  return {}
})
