import { XMLParser } from 'fast-xml-parser'
import { useEventListener } from '@vueuse/core'
import { ref, computed, type Ref } from 'vue'
import { fileOpen } from 'browser-fs-access'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true
})

ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
  const reader = this.getReader()
  try {
    while (true) {
      const {done, value} = await reader.read()
      if (done) return
      yield value
    }
  }
  finally {
    reader.releaseLock()
  }
}

export type Point = {
  ele: number
  lat: number
  lon: number
}

function parseGPX(gpx: string): Point[] {
  const parsing = parser.parse(gpx)
  return parsing.gpx.trk.trkseg.trkpt.map((d: any) => ({
    ele: d.ele || 0,
    lat: d['@_lat'],
    lon: d['@_lon']
  }))
}

export function useGPXParser() {
  const data: Ref<string | undefined> = ref()
  const fileName: Ref<string | undefined> = ref()

  async function open () {
    const file = await fileOpen({
      description: 'GPX files',
      mimeTypes: ['text/plain'],
      extensions: ['.gpx'],
      multiple: false
    })
    data.value = await file.text()
    fileName.value = file.name
  }

  const isDragOver = ref(false)

  useEventListener('dragover', e => {
    isDragOver.value = true
    e.preventDefault()
  })
  useEventListener('dragleave', e => {
    isDragOver.value = false
    e.preventDefault()
  })
  useEventListener('drop', async e => {
    e.preventDefault()
    isDragOver.value = false
    if (!e.dataTransfer || e.dataTransfer.items.length !== 1) return
    const item = e.dataTransfer.items[0]
    if (item.kind !== 'file') return
    const file = item.getAsFile()
    if (!file) return

    data.value = await file.text()
    fileName.value = file.name
  })

  const points = computed(() => (typeof data.value === 'string' ? parseGPX(data.value) : []))

  return { points, isDragOver, fileName, open }
}
