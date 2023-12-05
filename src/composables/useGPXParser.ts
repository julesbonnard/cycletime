import { XMLParser } from 'fast-xml-parser'
import { useFileSystemAccess, useEventListener } from '@vueuse/core'
import { ref, computed, type Ref } from 'vue'

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
  const { data: manualData, fileName: manualFileName, open } = useFileSystemAccess({
    dataType: 'Text',
    types: [
      {
        description: 'gpx',
        accept: {
          'text/plain': ['.gpx']
        }
      }
    ],
    excludeAcceptAllOption: true
  })

  const dragData: Ref<string | undefined> = ref()
  const dragFileName: Ref<string | undefined> = ref()
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
    dragFileName.value = file.name
    const stream = await file.stream()
    let fileString = ''
    for await (const chunk of stream) {
      const chunkString = new TextDecoder("utf-8").decode(chunk, { stream: true })
      fileString += chunkString
    }
    dragData.value = fileString
  })

  const data = computed(() => manualData.value || dragData.value)
  const fileName = computed(() => manualFileName.value || dragFileName.value)

  const points = computed(() => (typeof data.value === 'string' ? parseGPX(data.value) : []))

  return { points, isDragOver, fileName, open }
}
