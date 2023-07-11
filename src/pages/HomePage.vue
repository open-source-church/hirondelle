<template>
  <q-page>
    <div class="row" style="max-width: 1000px; margin: auto;">
      <div class="col-12 row q-my-xl" >
        <div class="col-12 text-center">
          <q-img src="icon.png" width="200px"/>
        </div>
        <div class="col-12 text-center">
          <div class="text-weight-bold q-my-md q-mt-xl">
            <span v-if="$q.screen.lt.sm" class="gradiant text-h2">Hirondelle</span>
            <span v-else class="gradiant text-h1">Hirondelle</span>
          </div>
          <div class="text-h5 q-px-md">Control OBS and create bot for twitch graphically.</div>
        </div>
      </div>

      <div class="col-12 q-mb-xl text-center" >
        <q-btn to="/obs" label="Get started" size="lg" class="bg-primary text-dark"/>
      </div>

      <div class="col-12 q-my-xl">
        <q-carousel
          swipeable
          animated
          arrows
          v-model="slide"
          infinite
          :autoplay="autoplay"
          @mouseenter="autoplay = false"
          @mouseleave="autoplay = true"
          navigation
          :height="{'xs': '40rem', 'sm': '35rem', 'md': '35rem', 'lg': '35rem', 'xl': '35rem' }[$q.screen.name]"
        >
          <q-carousel-slide :name="1">
            <div class="row justify-center">
              <div class="col-12 col-sm-8">
                <q-img src="screenshots/obs-2.jpg" position="50% 50%" fit="scale-down"/>
              </div>
              <div class="col-12 col-sm-4 row col justify-center">
                <div class="bg-black q-pa-md text-cream" style="border-radius: 1em;">
                <div class="text-h3">Control <span class="gradiant">OBS</span></div>
                <div class="text-subtitle1" v-html="marked(`
  - Live preview
  - Scene switching and transition
  - Start / stop recording and stream
  - Monitor stream status
  - Add custom actions

                `)"></div>

                </div>
              </div>
            </div>
          </q-carousel-slide>
          <q-carousel-slide :name="2">
            <div class="row justify-center">
              <div class="col-12 col-sm-8">
                <q-img src="screenshots/source-1.jpg" position="50% 50%" fit="scale-down"/>
              </div>
              <div class="col-12 col-sm-4 q-pl-lg row col justify-center">
                <div class="bg-black q-pa-md text-cream" style="border-radius: 1em;">
                  <div class="text-h3">Add fun <span class="gradiant">effects</span> to your stream</div>
                  <div class="text-subtitle1" v-html="marked(`
  - Confettis
  - Messages boxes
  - Sounds
  - Images and GIFs
  - Progress bars
  - …
                  `)"></div>
                </div>
              </div>
            </div>
          </q-carousel-slide>
          <q-carousel-slide :name="3">
            <div class="row justify-center">
              <div class="col-12 col-sm-8">
                <q-img src="screenshots/actions-1.jpg" position="50% 50%" fit="scale-down"/>
              </div>
              <div class="col-12 col-sm-4 q-pl-lg row col justify-center">
                <div class="bg-black q-pa-md text-cream" style="border-radius: 1em;">
                  <div class="text-h3">Interracts with <span class="gradiant">twitch</span> and <span class="gradiant">OBS</span></div>
                  <div class="text-subtitle1" v-html="marked(`
  - Reacts to subs, follows, messages, channel point redemptions, etc.
  - Send messages, announcements, play sounds, etc.
  - Change scenes, toggles items, etc.
                  `)"></div>
                </div>
              </div>
            </div>
          </q-carousel-slide>
          <q-carousel-slide :name="4">
            <div class="row justify-center">
              <div class="col-12 col-sm-8">
                <q-img src="screenshots/nodes-1.jpg" position="50% 50%" fit="scale-down"/>
              </div>
              <div class="col-12 col-sm-4 q-pl-lg row col justify-center">
                <div class="bg-black q-pa-md text-cream" style="border-radius: 1em;">
                  <div class="text-h3">Create <span class="gradiant">awesome</span> actions</div>
                  <div class="text-subtitle1" v-html="marked(`
  - Add nodes that represents events or actions
  - Connects them by drag n drop
                  `)"></div>
                </div>
              </div>
            </div>
          </q-carousel-slide>
        </q-carousel>
      </div>

      <div class="col-12 q-mt-xl row q-col-gutter-lg q-pl-md">
        <div class="col-12 text-center">
          <div class="text-h2">Features</div>
        </div>
        <div v-for="(f, i) in features" :key="i" class="col-12 col-sm-4 text-center">
          <q-card flat
            :style="`background: radial-gradient(circle, ${f.color}22 0%, ${f.color}44 100%)`"
          >
            <q-card-section>
              <q-icon :name="f.icon" size="xl" class="q-ma-md"/>
              <div class="text-h5">{{ f.title }}</div>
              <div class="text-subtitle1" v-html="marked(f.text)"></div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <div
        class="col-12 row q-my-xl"
        @mouseenter="autoFeatures = false"
        @mouseleave="autoFeatures = true"
      >

        <q-tabs
          v-model="featuresTab"
          :vertical="$q.screen.gt.xs"
          class="text-secondary col-12 col-sm-2 offset-sm-1"
          content-class="q-pa-md"
          active-class="bg-cyan-10"
        >
          <q-tab v-for="a in actions" :key="a.name" :name="a.name" :icon="a.icon" content-class="q-my-lg" />
        </q-tabs>

        <q-tab-panels
          v-model="featuresTab"
          animated
          :transition-prev="$q.screen.gt.xs ? 'slide-down' : 'slide-left'"
          :transition-next="$q.screen.gt.xs ? 'slide-up' : 'slide-right'"
          class="col-12 col-sm-8"
        >
          <q-tab-panel v-for="a in actions" :key="a.name" :name="a.name" class="row">
            <div class="text-h4 col-12 q-mb-md">
              <q-icon :name="a.icon" />
              {{ a.name }}
            </div>
            <div v-for="item in a.items" :key="item.name" class="col-12 col-sm-6 q-mb-md">
              <div class="text-h6 q-mb-md text-grey">{{ item.name }}</div>
              <ul>
                <li v-for="p in item.items" :key="p">{{ p }}</li>
              </ul>
            </div>
          </q-tab-panel>
        </q-tab-panels>
      </div>

      <div class="col-12 q-mb-md row justify-center">
        <div class="col-12 text-center text-warning text-subtitle1">
          <q-icon name="warning" size="sm" color="warning" />
          Hirondelle is in early developpement.
          <q-icon name="warning" size="sm" color="warning" />
        </div>
        <div class="col-auto text-grey">
          <ul>
            <li>Features are coming</li>
            <li>Data format may (and probably will) change</li>
            <li>Make backups (<q-badge class="bg-black text-cream"><q-icon name="settings" />Settings > Export</q-badge>)</li>
            <li>Report bugs on <a href="https://github.com/open-source-church/hirondelle/issues" target="_blank">github</a></li>
            <li>Join the OSC on <a href="https://discord.gg/7FG3WvW" target="_blank">Discord</a></li>
          </ul>
        </div>
        <div>
        </div>
      </div>

      <div class="col-12 row items-center text-center">
        <div class="col column q-mt-xl q-pa-xl items-center q-gutter-md">
          <a href="https://www.open-source.church">
            <q-img src="https://www.open-source.church/images/logo/logo.webp" width="100px" />
          </a>
          <p class="q-mb-xs">Made by <a href="https://www.open-source.church" target="_blank">Open Source Church</a>.</p>
          <p class="text-caption">Fork me on <a href="https://github.com/open-source-church/hirondelle" target="_blank">github</a>.</p>
        </div>
      </div>

    </div>
    <!-- Github banner -->
    <github-banner />
  </q-page>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted, toRef } from 'vue'
import { useQuasar, copyToClipboard } from 'quasar'
import _ from 'lodash'
import { useSettings } from 'stores/settings'
import { marked } from 'marked'
import JSConfetti from 'js-confetti'

const jsConfetti = new JSConfetti()

const $q = useQuasar()
const S = useSettings()

const slide = ref(1)
const autoplay = ref(true)

marked.use({
  mangle: false,
  headerIds: false,
})

watch(slide, (val) => {
  if (val == 2)
    jsConfetti.addConfetti({ confettiColors: ["#ffd400", "#00ffdd", "#d700d7"], confettiNumber: 60 })
})

const features = [
  {
    icon: "code",
    title: "Free and open-source",
    text: "Fork me on [github](https://github.com/open-source-church/hirondelle)",
    color: "#ffd400"
  },
  {
    icon: "file_download_off",
    title: "No installation",
    text: "Use directly in your browser.",
    color: "#00ffdd"
  },
  {
    icon: "comments_disabled",
    title: "No data collected",
    text: "No need to login.",
    color: "#d700d7"
  },
]

const actions = [
{
    name: "OBS",
    icon: "img:icons/obs.png",
    items: [
      {
        name: "Events",
        items: ["Scene changed", "Preview scene changed", "Stream state changed", "Studio mode changed"]
      },
      {
        name: "Actions",
        items: ["Set scene", "Set preview scene", "Start streaming", "Stop streaming", "Get source rect"]
      },
      {
        name: "Special Hirondelle actions",
        items: ["Confettis", "Message box", "Progress bar", "Play sound", "Show image"]
      },
    ]
  },
  {
    name: "Twitch",
    icon: "img:icons/twitch.png",
    items: [
      {
        name: "Events",
        items: ["Reward redeemed", "New follower", "New subscription", "Poll", "Chat message"]
      },
      {
        name: "Actions",
        items: ["Send message", "Send announcement"]
      },
      {
        name: "Tools",
        items: ["Manage redemptions", "Switch channel"]
      },
    ]
  },
  {
    name: "Hirondelle",
    icon: "img:icon.png",
    items: [
      {
        name: "Actions",
        items: ["Wait", "Timer", "Test condition", "Counter", "For loop", "Arithmetic operations", "Logic operations"]
      },
      {
        name: "Node editor",
        items: ["Graphic node interface", "Auto save in browser storage", "Copy/paste", "Group"]
      },
    ]
  }
]
const featuresTab = ref(actions[0].name)
const autoFeatures = ref(true)
setInterval(() => {
  if (!autoFeatures.value) return
  var i = _.findIndex(actions, a => a.name == featuresTab.value)
  featuresTab.value = actions[(i + 1) % actions.length].name
}, 5000)

</script>

<style>
.gradiant {
  background-clip: text;
  -webkit-text-fill-color: transparent;
  background-image: -webkit-linear-gradient(0deg,#ffd400,#ffd400 20%,#00ffddff 40%,#00ffddff 60%,#d700d7ff 80%, #d700d7ff);
}

.custom-caption {
  background-color: rgba(0, 0, 0, .3);
}
</style>
