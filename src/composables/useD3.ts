import { scaleLinear, extent, max, area, axisBottom, axisLeft, type Selection, scaleDiverging, interpolateRdYlGn, scaleSequential, interpolateSpectral, format, scaleUtc, pointer, select, bisector } from 'd3'
import { reactive, computed, watchEffect, type ComputedRef, type Ref, ref } from 'vue'
import { type Segment } from '@/composables/useGeo'
import { useElementSize } from '@vueuse/core'

function convertHoursToMilli (hours: number) {
  return hours*60*60*1000
}

function milliToString(milliSeconds: any, maxValue: any, showDays = false) {
  const negative = milliSeconds < 0;
  if (negative) {
    milliSeconds = -milliSeconds;
  }
  let d;
  if (showDays) {
    d = Math.trunc(milliSeconds / (60000 * 60 * 24));
    milliSeconds = milliSeconds - 60000 * 60 * 24 * d;
  }
  const h = Math.trunc(milliSeconds / (60000 * 60));
  milliSeconds = milliSeconds - 60000 * 60 * h;
  const m = Math.trunc(milliSeconds / 60000);
  milliSeconds = milliSeconds - 60000 * m;
  const s = Math.trunc(milliSeconds / 1000);
  milliSeconds = milliSeconds - 1000 * s;
  const frac = milliSeconds;
  let result = m ? m + ' m ' : ''; // start with minutes
  if (maxValue < 60000 * 60) {
    if (s) {
      result = result + s + ' s '; // add seconds value
    }
  }
  if (maxValue < 5000) {
    // include milliseconds
    result = frac ? result + frac + ' ms ' : result;
  }
  if (h) {
    result = h + ' h ' + result;
  }
  if (d) {
    result = d + 'd ' + result;
  }
  if (negative) {
    result = '-' + result;
  }
  return result.trim();
}

export function useD3(el: Ref<HTMLElement | null>, segments: ComputedRef<Segment[]>, maxSpeed: Ref<number>) {
  const currentPoint = reactive({
    speed: 0,
    lat: 0,
    lon: 0
  })
  const { width, height } = useElementSize(el)

  const margin = {
    right: 20,
    left: 40,
    top: 20,
    bottom: 20
  }

  const points = computed(() => {
    if (segments.value.length === 0) return []
    return [segments.value[0].start, ...segments.value.map(segment => segment.end)]
  })

  const xDistExtent = computed(
    () => [0, points.value[points.value.length - 1].distance] as [number, number]
  )
  const xDistScale = computed(() =>
    scaleLinear(xDistExtent.value, [margin.left, width.value - margin.right]).nice()
  )
  const xTimeExtent = computed(
    () => points.value.length === 0 ? [0, 0] : [0, convertHoursToMilli(points.value[points.value.length - 1].time)] as [number, number]
  )
  const xTimeScale = computed(() =>
    scaleUtc(xTimeExtent.value, [margin.left, width.value - margin.right])
  )
  const yExtent = computed(
    () => [0, max(points.value, d => d.ele)] as [number, number]
  )
  const yScale = computed(() =>
    scaleLinear(yExtent.value, [height.value - margin.bottom, margin.top])
  )
  const colorPenteExtent = computed(
    () => extent(segments.value, d => d.pente) as [number, number]
  )
  const colorPenteScale = computed(() => 
    scaleDiverging([colorPenteExtent.value[1], 0, colorPenteExtent.value[0]], interpolateRdYlGn)
  )
  const colorSpeedExtent = computed(
    () => [0, maxSpeed.value]
  )
  const colorSpeedScale = computed(() => 
    scaleSequential([0, colorSpeedExtent.value[1]], interpolateSpectral)
  )
  const areaPath = computed(() =>
    area<{x: number, y1: number}>()
      .x((d) => xTimeScale.value(d.x))
      .y0(yScale.value(0))
      .y1((d) => yScale.value(d.y1))
  )

  const xDistAxis = computed(() => axisBottom(xDistScale.value).ticks(width.value / 80).tickFormat(format(".0f")).tickSizeOuter(0))
  const xTimeTicks = computed(() => xTimeScale.value.ticks(width.value / 80))
  const xTimeFormat = computed(() => xTimeTicks.value.map(d => milliToString(d, xTimeTicks.value[xTimeTicks.value.length - 1])))
  const xTimeAxis = computed(() => axisBottom(xTimeScale.value).tickValues(xTimeTicks.value).tickFormat((f,i) => xTimeFormat.value[i]))
  const yAxis = computed(() => axisLeft(yScale.value).ticks(height.value / 40))

  function path (selection: Selection<SVGSVGElement, any, any, any>) {
    return selection
    .selectAll('path')
    .data(segments.value)
    .enter()
    .append('path')
    .attr('fill', segment => colorSpeedScale.value(segment.speed))
    .attr('shape-rendering', 'optimizeSpeed')
    .attr('d', segment => areaPath.value([segment.start, segment.end].map(point => ({
      x: convertHoursToMilli(point.time),
      y1: point.ele
    }))))
  }

  function createXAxis (selection: Selection<SVGSVGElement, any, any, any>) {
    return selection.append('g')
      .attr('transform', `translate(0,${height.value - margin.bottom})`)
      .call(xTimeAxis.value)
  }

  function createYAxis (selection: Selection<SVGSVGElement, any, any, any>) {
    return selection.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(yAxis.value)
      .call(g => g.select('.domain').remove())
      .call(g =>
      g
        .selectAll('.tick line')
        .clone()
        .attr('x2', width.value - margin.left - margin.right)
        .attr('stroke-opacity', 0.1)
    )
    .call(g =>
      g
        .append('text')
        .attr('x', -margin.left)
        .attr('y', 10)
        .attr('fill', 'currentColor')
        .attr('text-anchor', 'start')
        .text('↑ meters')
    )
  }

  const bisect = bisector((segment: Segment) => convertHoursToMilli(segment.start.time)).left;

  watchEffect(() => {
    if (!el.value) return
    const svg = select(el.value).html('')
      .append('svg')
      .attr('width', width.value)
      .attr('height', height.value)
      .attr('viewBox', [0, 0, width.value, height.value])
      .attr('style', 'max-width: 100%; height: auto; pointer-events: all;')
      .on('mousemove touchmove', e => {
        if (pointer(e)[0] <= margin.left || pointer(e)[0] >= width.value-margin.right) return 
        const mouse = xTimeScale.value.invert(pointer(e)[0])
        rule.attr("transform", `translate(${xTimeScale.value(mouse) + 0.5},0)`)
        const i = bisect(segments.value, +mouse, 0, segments.value.length - 1)
        currentPoint.speed = segments.value[i-1].speed
        currentPoint.lat = segments.value[i-1].start.lat
        currentPoint.lon = segments.value[i-1].start.lon
        e.preventDefault()
      })
      .call(path)
      .call(createXAxis)
      .call(createYAxis)

    const rule = svg.append("g")
      .append("line")
      .attr("y1", height.value)
      .attr("y2", 0)
      .attr("stroke", "black")
    // console.log(svg)
    // el.value.innerHTML = svg.value.node()?.outerHTML || ''
  })

  return { currentPoint }
}
