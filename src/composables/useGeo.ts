import haversine from 'haversine-distance'
import { ref, type Ref, computed } from 'vue'
import type { Point } from '@/composables/useGPXParser'

export type Segment = {
  length: number,
  pente: number,
  speed: number,
  duration: number,
  start: Point & { time: number, distance: number },
  end: Point & { time: number, distance: number }
}

export function calcDistance(pointsArray: Point[]) {
  return pointsArray.reduce((acc, cur, i, array) => {
    if (i === 0) return 0
    const prev = array[i - 1]
    const diff = haversine(
      {
        latitude: prev.lat,
        longitude: prev.lon
      },
      {
        latitude: cur.lat,
        longitude: cur.lon
      }
    )
    return acc + diff
  }, 0)
}

function createSegments(pointsArray: Point[], minDistance: number) {
  return pointsArray.reduce(
    (acc, cur, i, array) => {
      if (i === 0) {
        return {
          segments: [[cur]],
          tempDistance: 0
        }
      }
      const prev = array[i - 1]
      acc.tempDistance += calcDistance([prev, cur])
      acc.segments[acc.segments.length - 1].push(cur)
      if (acc.tempDistance > minDistance && acc.segments[acc.segments.length - 1].length > 1) {
        acc.segments.push([cur])
        acc.tempDistance = 0
      }
      return acc
    },
    {
      segments: [] as Point[][],
      tempDistance: 0
    }
  ).segments
}

function calcPower(f: number, p: number, W: number, Cx: number, V: number) {
  return ((f + p) * W * V) / 36 + (250 / 11664) * Cx * Math.pow(V, 3)
}
function findSpeed(P: number, f: number, p: number, W: number, Cx: number, V: number = 0) {
  if (calcPower(f, p, W, Cx, V) < P) return findSpeed(P, f, p, W, Cx, V + 0.5)
  return V
}

export function toHoursAndMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)

  return { hours, minutes }
}

export function useGeo(
  points: Ref<Point[]>,
  power: Ref<number>,
  friction: Ref<number>,
  airPenetration: Ref<number>,
  weight: Ref<number>,
  minDistance: Ref<number> = ref(1000),
  maxSpeed: Ref<number> = ref(60)
) {
  const denivPositive = computed(() =>
    points.value.reduce((acc, cur, i, array) => {
      if (i === 0) return 0
      const prev = array[i - 1]
      const diff = cur.ele - prev.ele
      if (diff > 0) return Math.round(acc + diff)
      return acc
    }, 0)
  )

  const distance = computed(() => calcDistance(points.value))

  const segments = computed(() =>
    createSegments(points.value, minDistance.value)
      .map((segment) => {
      const length = calcDistance(segment)
      const pente = length === 0 ? 0 : (100 * (segment[segment.length - 1].ele - segment[0].ele)) / length
      const speed = findSpeed(
        power.value,
        friction.value,
        pente,
        weight.value,
        airPenetration.value
      )
      const limitedSpeed = speed > maxSpeed.value ? maxSpeed.value : speed
      const duration = length / 1000 / limitedSpeed
      return {
        length,
        pente,
        speed: limitedSpeed,
        duration,
        start: {
          ...segment[0],
          distance: 0,
          time: 0
        },
        end: {
          ...segment[segment.length - 1],
          distance: 0,
          time: 0
        }
      }
    })
    .filter(segment => segment.duration > 0)
    .reduce((acc, cur, i, array) => {
      if (i > 0) {
        cur.start.distance = array[i - 1].end.distance
        cur.start.time = array[i - 1].end.time
      }
      cur.end.distance = cur.start.distance + cur.length
      cur.end.time = cur.start.time + cur.duration
      return acc.concat([cur])
    }, [] as Segment[])
  )

  const totalTime = computed(() =>
    toHoursAndMinutes(segments.value.reduce((acc, cur) => (acc += cur.duration), 0) * 60)
  )

  return { segments, denivPositive, distance, totalTime }
}
