<script lang="ts" setup>
import { ref, watch, type Ref } from 'vue'
import { useStepper } from '@vueuse/core'
import { useGPXParser } from '@/composables/useGPXParser'
import { useGeo } from '@/composables/useGeo'
import { useMapbox } from '@/composables/useMapbox'
import { useD3 } from '@/composables/useD3'

const power = ref(100)
const weight = ref(80)
const airPenetration = ref(0.2)
const friction = ref(1)
const minDistance = ref(100)
const maxSpeed = ref(75)
const svg = ref('')

const mapEl: Ref<HTMLDivElement | null> = ref(null)
const chartEl: Ref<HTMLDivElement | null> = ref(null)

const { points, isDragOver, fileName, open } = useGPXParser()
const { segments, denivPositive, distance, totalTime } = useGeo(
  points,
  power,
  friction,
  airPenetration,
  weight,
  minDistance,
  maxSpeed
)

const { currentPoint } = useD3(chartEl, segments, maxSpeed)
useMapbox(mapEl, points, currentPoint)

watch(fileName, () => goTo('dataviz'))

const { index, goTo } = useStepper(['upload', 'dataviz'])
</script>

<template>
  <main class="w-full max-w-lg">
    <form class="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4" :class="{ 'opacity-50 bg-gray-100 border border-blue-500': isDragOver }">
      <div v-if="index === 0">
        <button type="button" class="block mx-auto border px-4 py-2 rounded" @click="open()">
          Upload your GPX
        </button>
      </div>
      <div v-else-if="index === 1">
        <div class="mb-4">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="puissance">
            Constant power : {{ power }} Watts
          </label>
          <input
            class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            v-model="power"
            type="range"
            id="puissance"
            min="50"
            max="300"
          />
        </div>
        <div class="mb-4">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="poids">
            Total weight : {{ weight }} kilograms
          </label>
          <input
            class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            v-model="weight"
            type="range"
            id="poids"
            min="50"
            max="110"
          />
        </div>
        <!-- <div class="mb-4">
          <label class="block text-gray-700 text-sm font-bold mb-2" for="mindistance">
            Segment distance : {{ minDistance }} m
          </label>
          <input
            class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            v-model="minDistance"
            type="range"
            id="mindistance"
            min="100"
            max="10000"
            step="100"
          />
        </div> -->
        <div class="text-center">
          <h2 class="text-lg mb-2">{{ fileName }}</h2>
          <p>{{ Math.round(distance / 1000) }} kilometers | {{ denivPositive }} d+</p>
          <p class="font-bold">{{ totalTime.hours }} hours and {{ totalTime.minutes }} minutes</p>
          <p>{{ currentPoint.speed }} km/h</p>
        </div>
      </div>
    </form>
    <div v-if="index === 1" ref="mapEl" class="w-full h-40"></div>
    <div v-if="index === 1" ref="chartEl" class="w-full h-40" v-html="svg"></div>
  </main>
</template>
