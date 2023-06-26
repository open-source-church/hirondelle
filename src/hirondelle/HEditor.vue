<template>
  <div
    class="Heditor"
    @wheel.self="PZ.mouseWheel"
    @pointermove.self="PZ.onPointerMove"
    @pointerdown="PZ.onPointerDown"
    @pointerup="PZ.onPointerUp"
  >
    <div class="Hbackground" :style="styles">Hirondelle</div>
    <div class="H-node-container" :style="view.style">
      <q-btn label="Coucou" color="accent" icon="add" class="" style="left:100px; top: 200px;"/>
    </div>
  </div>
</template>

<script setup>

import { ref, computed, reactive, watch, onMounted } from 'vue'
import { useHirondelle } from "./hirondelle.js"
import { useMovePanZoom } from "./movePanZoom.js"

const H = useHirondelle()
const PZ = useMovePanZoom()
const view = H.editor.view

// Events


// Background
const gridSize = 100
const subGridSize = 20
const styles = computed(() => {
  return {
    backgroundPosition: `left ${view.panning.x}px top ${view.panning.y}px`,
    backgroundSize: `${gridSize * view.scaling}px ${gridSize * view.scaling}px,
                     ${gridSize * view.scaling}px ${gridSize * view.scaling}px,
                     ${subGridSize * view.scaling}px ${subGridSize * view.scaling}px,
                     ${subGridSize * view.scaling}px ${subGridSize * view.scaling}px`
  }
})

const color = "#222222"
const lineColor = "#333333"

// const styles = computed(() => {
  //   const config = viewModel.value.settings.background;
//   const positionLeft = graph.value.panning.x * graph.value.scaling;
//   const positionTop = graph.value.panning.y * graph.value.scaling;
//   const size = graph.value.scaling * config.gridSize;
//   const subSize = size / config.gridDivision;
//   const backgroundSize = `${size}px ${size}px, ${size}px ${size}px`;
//   const subGridBackgroundSize =
//       graph.value.scaling > config.subGridVisibleThreshold
//           ? `, ${subSize}px ${subSize}px, ${subSize}px ${subSize}px`
//           : "";
//   return {
  //       backgroundPosition: `left ${positionLeft}px top ${positionTop}px`,
//       backgroundSize: `${backgroundSize} ${subGridBackgroundSize}`,
//   }
// })

</script>

<style lang="scss">


.Heditor {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
  outline: none !important;
  touch-action: none;

  .Hbackground {
    background-color: v-bind("color");
    background-image: linear-gradient(v-bind("lineColor") 2px, transparent 2px),
        linear-gradient(90deg, v-bind("lineColor") 2px, transparent 2px),
        linear-gradient(v-bind("lineColor") 1px, transparent 1px),
        linear-gradient(90deg, v-bind("lineColor") 1px, transparent 1px);
    background-repeat: repeat;
    width: 100%;
    height: 100%;
    pointer-events: none !important;
  }

  .H-node-container {
    position: absolute;
    top: 0;
    left: 0;
  }
}

</style>
