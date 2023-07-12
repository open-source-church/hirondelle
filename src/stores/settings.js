import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import _ from 'lodash'
import { useQuasar, copyToClipboard } from 'quasar'

export const useSettings = defineStore('settings', () => {

  const $q = useQuasar()

  const settings = ref($q.localStorage.getItem("hirondelle") || {})
  const changed = ref(false)

  const unset = (path) => {
    _.unset(settings.value, path)
    changed.value = true
  }
  const get = (path) => _.get(settings.value, path)
  const set = (path, value) => {
    if (get(path) == value) return
    _.set(settings.value, path, value)
    changed.value = true
  }

  const countNodes = parent => {
    if (!parent?.nodes) return 0
    return parent.nodes.length + parent.nodes.reduce((r, n) => r + countNodes(n), 0)
  }

  // Backups
  const backups = ref($q.localStorage.getItem("hirondelleBackups") || [])
  const backupsChanged = ref(false)
  const lastNNodes = computed(() => countNodes(backups.value.at(-1)?.data?.graph?.state))
  const lastNConnections = computed(() => backups.value.at(-1)?.data?.graph?.state?.connections?.length || 0)

  watch(changed, (val) => {
    if (!val) return

    // Make backup?
    var nNodes = countNodes(settings.value.graph?.state)
    var nConnections = settings.value.graph.state.connections.length
    if (Math.abs(nNodes + nConnections - lastNNodes.value - lastNConnections.value) > 10) {
      B.createBackup()
    }

    // Store in local storage
    $q.localStorage.set("hirondelle", settings.value)
    changed.value = false
  })

  const B = {
    removeBackup: timestamp => {
      backups.value = backups.value.filter(b => b.date != timestamp)
      backupsChanged.value = true
    },
    renameBackup: (timestamp, name) => {
      backups.value.find(b => b.date == timestamp).name = name
      backupsChanged.value = true
    },
    createBackup: () => {
      var nNodes = countNodes(settings.value.graph?.state)
      var nConnections = settings.value.graph.state.connections.length
      console.log(`Creating backup.s for ${nNodes} nodes and ${nConnections} connections.`)
      var data = _.cloneDeep(settings.value)
      delete data.obs
      delete data.twitch
      backups.value.push({
        date: Date.now(),
        nodes: nNodes,
        connections: nConnections,
        data: data
      })
      backupsChanged.value = true
    }
  }

  watch(backupsChanged, (val) => {
    if (!val) return
    // Store in local storage
    $q.localStorage.set("hirondelleBackups", backups.value)
    backupsChanged.value = false
  })

  return {
    settings, set, get, unset,
    backups, B
  }
})
