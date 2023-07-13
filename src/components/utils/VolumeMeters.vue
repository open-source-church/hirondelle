<template>
  <div v-for="(level, i) in levels" :key="i" class="row">
    <!-- Input peak -->
    <div class="q-mt-xs q-mr-xs col-auto" :style="{
      height: height + 'px',
      width: height + 'px',
      background: level[2] < -50 ? 'darkgreen' :
                  level[2] < -20 ? 'green' :
                  level[2] < -9 ? 'orange' :
                  level[2] < -0.5 ? 'red' : 'white'}"></div>
    <div class="bg-dark q-mt-xs col" :style="{height: height + 'px'}">
      <template v-if="level[1] != -100">
        <!-- Background -->
        <div class="float-left" :style="{opacity: .2, height: height + 'px', width: 40/60*100+'%', background: 'green'}" ></div>
        <div class="float-left" :style="{opacity: .2, height: height + 'px', width: 11/60*100+'%', background: 'orange'}" ></div>
        <div class="float-left" :style="{opacity: .2, height: height + 'px', width: 9/60*100+'%', background: 'red'}" ></div>

        <!-- Meter: peak -->
        <div class="absolute bar" :style="{height: height + 'px', width: Math.max((level[1] + 60) / 60 * width, 0) + 'px'}">
          <div class="absolute" :style="{width: width + 'px'}">
            <div class="float-left" :style="{opacity: 1, height: height + 'px', width: 40/60*100+'%', background: 'green'}" ></div>
            <div class="float-left" :style="{opacity: 1, height: height + 'px', width: 11/60*100+'%', background: 'orange'}" ></div>
            <div class="float-left" :style="{opacity: 1, height: height + 'px', width: 9/60*100+'%', background: 'red'}" ></div>
          </div>
        </div>
      </template>
      <!-- Mute -->
      <template v-else>
        <!-- Background -->
        <div class="float-left" :style="{opacity: .2, height: height + 'px', width: 40/60*100+'%', background: 'lightgrey'}" ></div>
        <div class="float-left" :style="{opacity: .2, height: height + 'px', width: 11/60*100+'%', background: 'darkgrey'}" ></div>
        <div class="float-left" :style="{opacity: .2, height: height + 'px', width: 9/60*100+'%', background: 'grey'}" ></div>

        <!-- Meter: peak -->
        <div class="absolute bar" :style="{height: height + 'px', width: Math.max((level[2] + 60) / 60 * width, 0) + 'px'}">
          <div class="absolute" :style="{width: width + 'px'}">
            <div class="float-left" :style="{opacity: 1, height: height + 'px', width: 40/60*100+'%', background: 'darkgrey'}" ></div>
            <div class="float-left" :style="{opacity: 1, height: height + 'px', width: 11/60*100+'%', background: 'grey'}" ></div>
            <div class="float-left" :style="{opacity: 1, height: height + 'px', width: 9/60*100+'%', background: 'lightgrey'}" ></div>
          </div>
        </div>
      </template>
      <q-resize-observer @resize="setWidth" />
    </div>
  </div>
  <div v-if="scale" class="row justify-between q-pa-none" :style="{ 'margin-left': height + 4 + 'px'}">
    <span class="col-auto text-caption text-grey" v-for="v in _.range(-60, 5, 5)" :key="v">{{ v }}</span>
  </div>
</template>

<script setup>

import { ref, computed } from 'vue'
import _ from 'lodash'

const props = defineProps({
  levels: { type: Object, required: true},
  height: { type: Number, default: 10 },
  scale: { type: Boolean, default: true }
})

const width = ref()
const setWidth = size => width.value = size.width

</script>

<style lang="scss" scoped>

.bar {
  transition: all 0.2s;
  overflow: hidden;
}

</style>
