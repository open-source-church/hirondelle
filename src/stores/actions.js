import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import _, { sortedIndexBy } from 'lodash'
import { Peer } from "peerjs"
import { useQuasar, copyToClipboard } from 'quasar'
import { useSettings } from './settings'

class Action {
  constructor(name) {
    this.name = name;
  }
}

export const useActions = defineStore('actions', () => {

  const $q = useQuasar()
  const S = useSettings()

  const actions = ref([])
  const signals = ref(S.get("actions.signals") || [])

  /*
    Register actions and returns a trigger.

    @param name: nom de l'action
    @param source: nom de la source
    @param description: description de l'action
    @param active<ref>: une valeure qui dit si la source est active
    @param callback: function appelée quand on déclanche l'action
    @param params: array de {name: 'nom', description: 'description du paramètre', ?options<ref>: ['valeurs possibles']}
  */
  const register_action = (opt) => {
    var action = {
      name: opt.name,
      source: opt.source,
      signature() {
        return `${this.source}:${this.name}`
      },
      description: opt.description,
      active: opt.active || true,
      callback: opt.callback,
      params: opt.params || [],
      triggers: [], // Les actions à appeler
      started: false
    }
    // On ajoute la fonction de lancement
    action.start = async function  (params) {
      this.started = true
      console.log("STARTED", this.name, "with", params)

      // On appelle le callback s'il y en a un
      if (this.callback) this.callback(params)

      // On regarde s'il y a des actions connectées
      var r = await check_triggers(this.triggers, params)

      this.started = false
    }
    actions.value.push(action)
    return action
  }

  // load user actions
  var act = S.get("actions.user") || []
  act.forEach(a => register_action(a))
  // S.set("actions", {})

  const save = () => {
    console.log("SAVING")
    var _actions = _.cloneDeep(actions.value)
    // User actions
    var act = _actions.filter(a => a.source == "User")
    .map(a => {
      delete a.start
      delete a.triggers
      return a
    })
    S.set("actions.user", act)

    // Signals
    _actions = _.cloneDeep(actions.value)
    _actions.forEach(a => {
      a.triggers.forEach(t => t.source = a.signature())
      a.triggers.forEach(t => t.target = t.target.signature())
    })
    var _signals = _.flatten(_actions.map(a => a.triggers)).concat(signals.value)
    S.set("actions.signals", _signals)
  }
  var debounced_save = _.debounce(save, 1000, { 'leading': true, 'trailing': true })

  // On enregistre les actions et on ajoute les éventuels signaux
  watch(actions, () => {
    // On ajoute les signaux depuis la sauvegarde s'il y en a
    if (signals.value.length) {
      signals.value.forEach(sig => {
        var source = actions.value.find(a => a.signature() == sig.source)
        var target = actions.value.find(a => a.signature() == sig.target)
        if (source && target) {
          source.triggers.push({
            target: target,
            params: sig.params
          })
          signals.value = signals.value.filter(s => s != sig)
        }
      })
    }
    // On sauvegarde
    debounced_save()
  }, { deep: true })

  const get_param_value = (txt, params) => {
    var m = txt.match(/{(.*)}/)
    if (m) return params[m[1]]
    return txt
  }
  const signature = obj => `${obj.source}:${obj.name}`

  const check_triggers = (triggers, params) => {
    console.log(triggers, params)
    triggers.filter(t => {
      if(!t.condition) return true
      console.log("CONDITION", t.condition)
      // Check condictions
      var a = get_param_value(t.condition[0], params)
      var b = get_param_value(t.condition[2], params)
      if (t.condition[1] == "=") return a == b
    })
    .forEach(t => {
      var p = Object.fromEntries(
        Object.keys(t.params).map(k => [k, get_param_value(t.params[k], params)])
      )
      t.target.start(p)
    })
  }

  return {
    actions, signals,
    register_action
  }
})
