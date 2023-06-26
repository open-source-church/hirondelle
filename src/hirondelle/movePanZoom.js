import { defineStore } from 'pinia'
import { ref, computed, watch, toRef } from 'vue'
import _ from 'lodash'
import { useHirondelle } from './hirondelle'

export const useMovePanZoom = defineStore('movePanZoom', () => {

  const H = useHirondelle()
  const view = H.editor.view

  const setScaling = (pos, newScale) => {
    const point = [ pos.x / view.scaling - view.panning.x, pos.y / view.scaling - view.panning.y ]
    view.scaling = newScale
    const point2 = [ pos.x / view.scaling - view.panning.x, pos.y / view.scaling - view.panning.y ]
    view.panning.x += point2[0] - point[0]
    view.panning.y += point2[1] - point[1]
    view.lastPost = pos
  }

  const mouseWheel = event => {
    const p = { x: event.offsetX, y: event.offsetY }
    if(event.deltaY < 0) setScaling(p, view.scaling * 1.3)
    else setScaling(p, view.scaling / 1.3)
  }

  var pointersStart = []
  var pointersLast = []
  var pointerDistance
  var viewState
  const onPointerMove = event => {
    pointersLast = pointersLast.filter(p => p.pointerId != event.pointerId)
    pointersLast.push(event)
    // Mouse or one finger
    if (pointersStart.length == 1) {
      view.panning.x = viewState.panning.x - (pointersStart[0].pageX - event.pageX) / view.scaling
      view.panning.y = viewState.panning.y - (pointersStart[0].pageY - event.pageY) / view.scaling
    }
    // Two fingers
    if (pointersStart.length == 2) {
      // Pan
      view.panning.x = viewState.panning.x - (midPoint(...pointersStart).x - midPoint(...pointersLast).x) / view.scaling
      view.panning.y = viewState.panning.y - (midPoint(...pointersStart).y - midPoint(...pointersLast).y) / view.scaling
      // Zoom
      setScaling(midPoint(...pointersLast), viewState.scaling * distance(...pointersLast) / pointerDistance)
    }
  }

  const midPoint = (event1, event2) => ({
    x: (event1.pageX + event2.pageX) / 2,
    y: (event1.pageY + event2.pageY) / 2
  })
  const distance = (event1, event2) => Math.sqrt((event1.pageX - event2.pageX)**2 + (event1.pageY - event2.pageY)**2 )

  const onPointerDown = event => {
    pointersStart.push(event)
    pointersLast.push(event)
    viewState = _.cloneDeep(view)
    if (pointersLast.length == 2) pointerDistance = distance(...pointersLast)
  }

  const onPointerUp = event => {
    pointersStart = pointersStart.filter(p => p.pointerId != event.pointerId)
    pointersLast = pointersLast.filter(p => p.pointerId != event.pointerId)
  }

  return {
    mouseWheel, onPointerMove, onPointerDown, onPointerUp, pointers: pointersStart
  }
})
