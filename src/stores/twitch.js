import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import _ from 'lodash'
import { Peer } from "peerjs"
import { useQuasar, copyToClipboard } from 'quasar'
import ComfyJS from 'comfy.js'


export const useTwitch = defineStore('twitch', () => {

  const $q = useQuasar()

  ComfyJS.onCommand = ( user, command, message, flags, extra ) => {
    console.log("USER", user)
    console.log("command", command)
    console.log("message", message)
    console.log("flags", flags)
    console.log("extra", extra)
    if( flags.broadcaster && command === "test" ) {
      console.log( "!test was typed in chat" )
    }
  }
  ComfyJS.Init( "theolog33k" )


  return {

  }
})
