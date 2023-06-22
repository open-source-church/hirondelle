<template>
  <router-view />
</template>

<script setup>
import { useQuasar } from 'quasar'
import { useTwitch } from 'stores/twitch'

const $q = useQuasar()
const twitch = useTwitch()

console.log(document.location.hash)

if (document.location.hash) {
  var p = new URLSearchParams(document.location.hash.substring(1))
  var token = p.get("access_token")
  var state = p.get("state")
  console.log(token, state)
  console.log(twitch.state)
  if (token && state && state == twitch.state) {
    twitch.access_token = token
    var redirect = $q.localStorage.getItem("twitch_redirect")
    if (redirect) {
      $q.localStorage.remove("twitch_redirect")
      window.location.href = window.location.origin + redirect
    }
  }
}

</script>
