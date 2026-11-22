'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { Map as LMap, Marker, LayerGroup } from 'leaflet'
import { cn } from '@/lib/utils'

export type Pin = { lat: number; lng: number; label?: string; href?: string; sub?: string }

/** Ghana, roughly centred. */
const GHANA: [number, number] = [7.95, -1.03]

const pinIcon = (L: typeof import('leaflet'), tone = '#0b3d91') => L.divIcon({
  className: '',
  html: `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.3 0 0 6.2 0 13.9 0 24.3 14 38 14 38s14-13.7 14-24.1C28 6.2 21.7 0 14 0z" fill="${tone}"/><circle cx="14" cy="14" r="5.5" fill="#fff"/></svg>`,
  iconSize: [28, 38], iconAnchor: [14, 38], popupAnchor: [0, -34],
})

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/**
 * OpenStreetMap map (no API key needed). Shows pins; with `onPick`, tapping the map places a single pin.
 */
export function MapView({ pins = [], onPick, className, zoom }: { pins?: Pin[]; onPick?: (p: { lat: number; lng: number }) => void; className?: string; zoom?: number }) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<LMap | null>(null)
  const layer = useRef<LayerGroup | null>(null)
  const lib = useRef<typeof import('leaflet') | null>(null)
  const pick = useRef(onPick)
  pick.current = onPick

  useEffect(() => {
    let alive = true
    import('leaflet').then((L) => {
      if (!alive || !el.current || map.current) return
      lib.current = L
      const m = L.map(el.current, { scrollWheelZoom: false, attributionControl: true }).setView(GHANA, 6)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(m)
      layer.current = L.layerGroup().addTo(m)
      m.on('click', (e) => pick.current?.({ lat: +e.latlng.lat.toFixed(6), lng: +e.latlng.lng.toFixed(6) }))
      map.current = m
      draw()
    })
    return () => { alive = false; map.current?.remove(); map.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const draw = () => {
    const L = lib.current, m = map.current, g = layer.current
    if (!L || !m || !g) return
    g.clearLayers()
    const markers: Marker[] = pins.map((p) => {
      const mk = L.marker([p.lat, p.lng], { icon: pinIcon(L, onPick ? '#c8102e' : '#0b3d91'), title: p.label })
      if (p.label) mk.bindPopup(p.href ? `<a href="${esc(p.href)}" style="font-weight:600">${esc(p.label)}</a>${p.sub ? `<br><span style="color:#64748b">${esc(p.sub)}</span>` : ''}` : esc(p.label))
      return mk.addTo(g)
    })
    if (markers.length === 1) m.setView([pins[0].lat, pins[0].lng], zoom ?? 15)
    else if (markers.length > 1) m.fitBounds(L.featureGroup(markers).getBounds().pad(0.15))
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [JSON.stringify(pins)])

  return <div ref={el} className={cn('z-0 h-72 w-full overflow-hidden rounded-2xl border', onPick && 'cursor-crosshair', className)} role="region" aria-label="Map" />
}
