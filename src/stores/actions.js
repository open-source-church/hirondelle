import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import _ from 'lodash'
import { Peer } from "peerjs"
import { useQuasar, copyToClipboard } from 'quasar'

class Action {
  constructor(name) {
    this.name = name;
  }
}

export const useActions = defineStore('actions', () => {

  const $q = useQuasar()

  return {

  }
})
