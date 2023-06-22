import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import _ from 'lodash'
import { useQuasar, copyToClipboard } from 'quasar'

export const useSettings = defineStore('settings', () => {

  const $q = useQuasar()

  const settings = ref($q.localStorage.getItem("settings") || {})

  const set = (path, value) => _.set(settings.value, path, value)
  const unset = (path) => _.unset(settings.value, path)

  const get = (path) => _.get(settings.value, path)

  watch(settings, () => $q.localStorage.set("settings", settings.value), { deep: true })

  return {
    settings, set, get, unset
  }
})
