import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import _ from 'lodash'
import { Peer } from "peerjs"
import { useQuasar, copyToClipboard } from 'quasar'

export const usePeer = defineStore('peer', () => {

  const $q = useQuasar()

  const conn = ref({})
  const connected = computed(() => conn.value.connectionId != null)

  // PEER Connection
  const peer_id = ref($q.localStorage.getItem("peer_id"))

  // New peer with peer_id from local storage or new
  var peer = new Peer(peer_id.value)
  // On store l'id
  peer.on("open", id => {
    $q.localStorage.set("peer_id", id)
    peer_id.value = id
  })

  // Connection
  peer.on("connection", c => {
    console.log("Connection", c)
    conn.value = c
  })

  peer.on("error", err => {
    console.log("Error", err)
  })

  // Debug send function
  const send = () => {
    conn.value.send("Coucou: " + Math.random().toString(36).substring(4))
  }

  // Source URL
  const source_url = computed(() => window.location.origin + "/source/" + peer_id.value)
  const copyURL = () => {
    copyToClipboard(source_url.value)
    $q.notify("URL copiée dans le presse-papier.")
  }


  return {
    connected,
    send,
    source_url, copyURL
  }
})
