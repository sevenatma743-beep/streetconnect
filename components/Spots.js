'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { getSpots } from '../lib/supabase'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })
const MapController = dynamic(
  () => import('react-leaflet').then(({ useMap }) => {
    function Controller({ onReady }) {
      const map = useMap()
      useEffect(() => { onReady(map) }, [map, onReady])
      return null
    }
    return Controller
  }),
  { ssr: false }
)

let leafletIconFixed = false
async function fixLeafletIconsOnce() {
  if (leafletIconFixed) return
  leafletIconFixed = true
  const L = await import('leaflet')
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

function isValidCoord(n) {
  return typeof n === 'number' && Number.isFinite(n)
}

export default function Spots() {
  const mapRef = useRef(null)
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [spots, setSpots] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')

  const center = useMemo(() => [43.6108, 3.8767], [])

  useEffect(() => {
    loadSpots()
  }, [])

  async function loadSpots() {
    try {
      setLoading(true)
      setErrorMsg('')
      await fixLeafletIconsOnce()
      const data = await getSpots()
      const clean = (data || [])
        .map(s => ({
          ...s,
          lat: typeof s.lat === 'string' ? parseFloat(s.lat) : s.lat,
          lng: typeof s.lng === 'string' ? parseFloat(s.lng) : s.lng,
        }))
        .filter(s => isValidCoord(s.lat) && isValidCoord(s.lng))
      setSpots(clean)
    } catch (e) {
      console.error(e)
      setErrorMsg("Erreur chargement spots.")
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return spots
    return spots.filter(s => `${s.name} ${s.city} ${s.address}`.toLowerCase().includes(q))
  }, [query, spots])

  const openItinerary = (spot) => {
    if (!isValidCoord(spot.lat) || !isValidCoord(spot.lng)) return
    const url = `https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}&travelmode=walking`
    window.open(url, '_blank')
  }

  const onMapReady = useCallback((map) => { mapRef.current = map }, [])

  const focusSpot = (spot) => {
    setActiveId(spot.id)
    const map = mapRef.current
    if (!map) return
    map.setView([spot.lat, spot.lng], 16, { animate: true })
  }

  return (
    <div className="pb-20 p-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-white mb-1">SPOTS</h2>
        <p className="text-gray-400 mb-4">Découvre les spots de street workout</p>
        {errorMsg && <p className="text-sm text-red-500 mb-2">{errorMsg}</p>}

        <div className="mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un spot..."
            className="w-full bg-street-800 border border-street-700 text-white p-3 rounded-xl"
          />
        </div>

        <div className="bg-street-800 border border-street-700 rounded-xl overflow-hidden mb-4">
          <div className="h-[50vh] w-full">
            <MapContainer
              center={center}
              zoom={12}
              scrollWheelZoom
              className="h-full w-full"
            >
              <MapController onReady={onMapReady} />
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filtered.map((s) => (
                <Marker key={s.id} position={[s.lat, s.lng]}>
                  <Popup>
                    <div>
                      <strong>{s.name}</strong><br />
                      {s.city}<br />
                      {s.address}<br />
                      <button
                        onClick={() => openItinerary(s)}
                        className="mt-2 text-sm bg-yellow-400 text-black font-bold px-3 py-1 rounded hover:bg-yellow-500"
                      >
                        🚶 Itinéraire
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>

        <div className="bg-street-800 border border-street-700 rounded-xl p-4 max-h-[400px] overflow-y-auto">
          {loading ? (
            <p className="text-gray-400 text-center">Chargement...</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400 text-center">Aucun spot trouvé.</p>
          ) : (
            <ul className="space-y-3">
              {filtered.map(s => (
                <li key={s.id} className={`p-3 rounded-xl transition ${activeId === s.id ? 'bg-street-900 border-street-accent' : 'bg-street-800'} border border-street-700`}>
                  <p className="text-white font-bold">{s.name}</p>
                  <p className="text-gray-400 text-sm">{s.city} — {s.address}</p>
                  {s.tags && s.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.tags.map((tag, i) => (
                        <span key={i} className="text-xs bg-street-700 text-gray-300 px-2 py-1 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => focusSpot(s)}
                      className="bg-street-700 text-white px-3 py-1 rounded hover:bg-street-600 text-sm"
                    >
                      📍 Voir sur la carte
                    </button>
                    <button
                      onClick={() => openItinerary(s)}
                      className="bg-street-accent text-street-900 px-3 py-1 rounded hover:bg-street-accentHover font-semibold text-sm"
                    >
                      🚶 Itinéraire
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}