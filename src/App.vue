<template>
  <router-view />
</template>

<script setup>
import { useQuasar } from 'quasar'
import { useTwitch } from 'stores/twitch'
import { useSettings } from 'stores/settings'

const $q = useQuasar()
const twitch = useTwitch()
const S = useSettings()

console.log(document.location.hash)

if (document.location.hash) {
  var p = new URLSearchParams(document.location.hash.substring(1))
  var token = p.get("access_token")
  var state = p.get("state")
  if (token && state && state == twitch.state) {
    twitch.access_token = token
    var redirect = S.get("twitch.redirect")
    if (redirect) {
      S.unset("twitch.redirect")
      window.location.href = window.location.origin + redirect
    }
  }
}

</script>
