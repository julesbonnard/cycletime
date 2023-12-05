import mapboxgl from 'mapbox-gl'
import { type ComputedRef, type Ref, watchEffect, watch } from 'vue'
import type { Point } from '@/composables/useGPXParser'
import 'mapbox-gl/dist/mapbox-gl.css'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

export function useMapbox(el: Ref<HTMLDivElement | null>, points: ComputedRef<Point[]>, currentPoint: { lat: number, lon: number }) {
  let map: mapboxgl.Map
  const marker = new mapboxgl.Marker({ color: '#F84C4C' })
  watch(currentPoint, () => {
    marker.setLngLat([currentPoint.lon, currentPoint.lat])
  })
  watchEffect(() => {
    if (!el.value || points.value.length === 0) return
    const bounds = new mapboxgl.LngLatBounds(points.value[0], points.value[0])
    for (const coord of points.value) {
      bounds.extend(coord)
    }
    el.value.innerHTML = ''
    map = new mapboxgl.Map({
      container: el.value,
      style: 'mapbox://styles/mapbox/streets-v12',
      bounds,
      fitBoundsOptions: {
        padding: 20
      },
      interactive: false
    })
    marker.setLngLat([points.value[0].lat, points.value[0].lon]).addTo(map)

    map.on('load', () => {
      map
        .addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: points.value.map((point) => [point.lon, point.lat])
            },
            properties: {
              name: 'Route'
            }
          }
        })
        .addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#000',
            'line-width': 3
          }
        })
    })
  })
}
