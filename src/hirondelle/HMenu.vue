<template>
  <q-list dense style="min-width: 100px">
    <q-item clickable :v-close-popup="!item.items" v-for="item in items" :key="item.title">
      <q-item-section>{{ item.title }}</q-item-section>
      <q-item-section side v-if="item.type">
        <q-badge v-if="item.type.isTrigger" square class="bg-accent text-white">trigger</q-badge>
        <q-badge v-if="item.type.isAction" square class="bg-primary text-dark">action</q-badge>
        <q-badge v-if="item.type.isParam" square class="bg-grey-8 text-white">param</q-badge>
      </q-item-section>
      <q-item-section side v-if="item.items">
        <q-icon name="keyboard_arrow_right" />
      </q-item-section>
      <q-menu anchor="top end" self="top start" v-if="item.items">
        <HMenu :items="item.items" />
      </q-menu>
    </q-item>
  </q-list>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import HMenu from "src/hirondelle/HMenu.vue"

const props = defineProps({
  items : { Object, required: true }
})

defineEmits(["selected"])

</script>

<style lang="scss">


</style>
