import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import _ from 'lodash'
import { Peer } from "peerjs"
import { useQuasar, copyToClipboard } from 'quasar'
import { useSettings } from './settings'

export const usePeer = defineStore('peer', () => {

  const $q = useQuasar()
  const S = useSettings()

  const conn = ref({})
  const connected = computed(() => conn.value.connectionId != null)

  // PEER Connection
  const peer_id = ref(S.get("peer.id"))

  // New peer with peer_id from local storage or new
  var peer = new Peer(peer_id.value)
  // On store l'id
  peer.on("open", id => {
    S.set("peer.id", id)
    peer_id.value = id
  })

  peer.on('disconnected', () => {
    console.log("Connection lost :(")
  });

  peer.on("error", err => {
    console.log("Error", err)
  })

  // Connection
  peer.on("connection", c => {
    console.log("Connection", c)
    conn.value = c
    conn.value.on("close", () => {
      console.log("Connection closed")
      conn.value = {}
    })
    conn.value.on("error", (err) => {
      console.log("Connection error", err)
      conn.value = {}
    })
  })

  // Debug send function
  const send = (d) => {
    conn.value.send(d)
  }

  // Source URL
  const source_url = computed(() => window.location.origin + "/source/" + peer_id.value)
  const copyURL = () => {
    copyToClipboard(source_url.value)
    $q.notify("URL copiée dans le presse-papier.")
  }


  return {
    connected, conn,
    send,
    source_url, copyURL
  }
})
