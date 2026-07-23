'use client'
import { useEffect, useRef, useState } from 'react'

// ─── Minimal Google Maps typings (หลีกเลี่ยงพึ่งพา @types/google.maps) ───────
type GLatLng = { lat: () => number; lng: () => number }
type GMap = { setCenter: (p: unknown) => void; setZoom: (z: number) => void }
type GMarker = { setPosition: (p: unknown) => void; getPosition: () => GLatLng; addListener: (e: string, cb: () => void) => void }
type GAutocomplete = { addListener: (e: string, cb: () => void) => void; getPlace: () => { formatted_address?: string; name?: string; geometry?: { location: GLatLng } } }
interface GoogleNS {
  maps: {
    Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap
    Marker: new (opts: Record<string, unknown>) => GMarker
    Geocoder: new () => { geocode: (req: Record<string, unknown>, cb: (results: { formatted_address: string }[], status: string) => void) => void }
    LatLng: new (lat: number, lng: number) => unknown
    event: { clearInstanceListeners: (o: unknown) => void }
    places: { Autocomplete: new (el: HTMLInputElement, opts: Record<string, unknown>) => GAutocomplete }
  }
}
declare global { interface Window { google?: GoogleNS } }

interface Props {
  apiKey: string
  address: string
  lat?: number | null
  lng?: number | null
  onChange: (v: { address: string; lat?: number; lng?: number }) => void
}

let scriptLoadingPromise: Promise<void> | null = null
function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps?.places) return Promise.resolve()
  if (scriptLoadingPromise) return scriptLoadingPromise
  scriptLoadingPromise = new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=th&region=TH`
    script.async = true
    script.onload = () => resolve()
    document.head.appendChild(script)
  })
  return scriptLoadingPromise
}

export default function AddressMapPicker({ apiKey, address, lat, lng, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<GMap | null>(null)
  const markerInstance = useRef<GMarker | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [localAddress, setLocalAddress] = useState(address)

  useEffect(() => { setLocalAddress(address) }, [address])

  useEffect(() => {
    if (!apiKey) return
    loadGoogleMaps(apiKey).then(() => setLoaded(true))
  }, [apiKey])

  useEffect(() => {
    if (!loaded || !mapRef.current || !inputRef.current || !window.google) return
    const g = window.google
    const center = { lat: lat || 13.7563, lng: lng || 100.5018 }
    const map = new g.maps.Map(mapRef.current, { center, zoom: lat ? 16 : 11, disableDefaultUI: true, zoomControl: true })
    mapInstance.current = map
    const marker = new g.maps.Marker({ position: center, map, draggable: true })
    markerInstance.current = marker

    function reverseGeocodeAndEmit(position: GLatLng) {
      const geocoder = new g.maps.Geocoder()
      geocoder.geocode({ location: { lat: position.lat(), lng: position.lng() } }, (results, status) => {
        const addr = status === 'OK' && results?.[0] ? results[0].formatted_address : localAddress
        setLocalAddress(addr)
        onChange({ address: addr, lat: position.lat(), lng: position.lng() })
      })
    }

    marker.addListener('dragend', () => reverseGeocodeAndEmit(marker.getPosition()))

    const autocomplete = new g.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'th' },
      fields: ['formatted_address', 'geometry', 'name'],
    })
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace()
      if (!place.geometry?.location) return
      const loc = place.geometry.location
      map.setCenter({ lat: loc.lat(), lng: loc.lng() })
      map.setZoom(16)
      marker.setPosition({ lat: loc.lat(), lng: loc.lng() })
      const addr = place.formatted_address || place.name || localAddress
      setLocalAddress(addr)
      onChange({ address: addr, lat: loc.lat(), lng: loc.lng() })
    })

    return () => { g.maps.event.clearInstanceListeners(marker); g.maps.event.clearInstanceListeners(map) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  function useCurrentLocation() {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords
      const g = window.google
      if (!g || !mapInstance.current || !markerInstance.current) return
      mapInstance.current.setCenter({ lat: latitude, lng: longitude })
      mapInstance.current.setZoom(17)
      markerInstance.current.setPosition({ lat: latitude, lng: longitude })
      const geocoder = new g.maps.Geocoder()
      geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
        const addr = status === 'OK' && results?.[0] ? results[0].formatted_address : localAddress
        setLocalAddress(addr)
        onChange({ address: addr, lat: latitude, lng: longitude })
      })
    })
  }

  if (!apiKey) {
    // Fallback: ไม่มี API key ให้กรอกที่อยู่แบบข้อความอย่างเดียว
    return (
      <input required value={localAddress}
        onChange={e => { setLocalAddress(e.target.value); onChange({ address: e.target.value }) }}
        className="input" placeholder="ที่อยู่สำหรับช่าง" />
    )
  }

  return (
    <div>
      <input ref={inputRef} required value={localAddress}
        onChange={e => { setLocalAddress(e.target.value); onChange({ address: e.target.value }) }}
        className="input" placeholder="ค้นหาที่อยู่จาก Google Maps..." />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
        <button type="button" onClick={useCurrentLocation} style={{
          padding: '6px 10px', fontSize: 12, fontWeight: 600, borderRadius: 8,
          border: '1px solid var(--border)', background: '#fff', color: 'var(--brand)', cursor: 'pointer',
        }}>📍 ใช้ตำแหน่งปัจจุบัน</button>
        {!!lat && !!lng && (
          <span style={{ fontSize: 11, color: '#aaa' }}>พิกัด: {lat.toFixed(5)}, {lng.toFixed(5)}</span>
        )}
      </div>
      <div ref={mapRef} style={{ width: '100%', height: 220, borderRadius: 10, overflow: 'hidden', border: '1px solid #eee', background: '#f5f5f5' }} />
      <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
        พิมพ์ค้นหาที่อยู่ หรือลากหมุด/แตะบนแผนที่เพื่อปรับตำแหน่งให้ตรงจุดติดตั้งจริง
      </div>
    </div>
  )
}
