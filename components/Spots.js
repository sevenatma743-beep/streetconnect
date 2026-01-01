'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useAuth } from '../contexts/AuthContext'
import { getSpots, createSpot } from '../lib/supabase'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })

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

// Fonction de géocodage via Nominatim (OpenStreetMap)
async function geocodeAddress(address, city) {
  try {
    const query = `${address}, ${city}, France`
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'StreetConnect/1.0' // Nominatim requiert un User-Agent
      }
    })
    
    const data = await response.json()
    
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      }
    }
    
    return null
  } catch (error) {
    console.error('Erreur géocodage:', error)
    return null
  }
}

export default function Spots() {
  const mapRef = useRef(null)
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState(null)
  const [spots, setSpots] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [newSpot, setNewSpot] = useState({ name: '', city: '', address: '', tags: '' })

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

  const focusSpot = async (spot) => {
    setActiveId(spot.id)
    await fixLeafletIconsOnce()
    const map = mapRef.current
    if (!map) return
    map.setView([spot.lat, spot.lng], 16, { animate: true })
  }

  async function handleCreateSpot(e) {
    e.preventDefault()
    if (!user) return alert('Non connecté')
    
    try {
      setGeocoding(true)
      setErrorMsg('')
      
      // Géocoder l'adresse automatiquement
      const coords = await geocodeAddress(newSpot.address, newSpot.city)
      
      if (!coords) {
        setErrorMsg('Impossible de trouver les coordonnées de cette adresse. Vérifie l\'adresse et la ville.')
        setGeocoding(false)
        return
      }
      
      const spotData = {
        name: newSpot.name,
        city: newSpot.city,
        address: newSpot.address,
        lat: coords.lat,
        lng: coords.lng,
        tags: newSpot.tags.split(',').map(t => t.trim()).filter(t => t)
      }
      
      await createSpot(spotData)
      setNewSpot({ name: '', city: '', address: '', tags: '' })
      await loadSpots()
    } catch (e) {
      console.error('Erreur ajout spot:', e)
      setErrorMsg('Erreur lors de l\'ajout du spot')
    } finally {
      setGeocoding(false)
    }
  }

  return (
    <div className="pb-20 p-4">
      <div className="max-w-6xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-white mb-1">SPOTS</h2>
        <p className="text-gray-400 mb-4">Trouve ou ajoute un spot de street workout</p>
        {errorMsg && <p className="text-sm text-red-500 mb-2">{errorMsg}</p>}

        <form onSubmit={handleCreateSpot} className="bg-street-800 border border-street-700 rounded-xl p-4 mb-6">
          <h3 className="text-white font-bold mb-2">Ajouter un Spot</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input 
              className="bg-street-900 text-white p-2 rounded" 
              placeholder="Nom du spot" 
              value={newSpot.name} 
              onChange={e => setNewSpot({ ...newSpot, name: e.target.value })} 
              required 
            />
            <input 
              className="bg-street-900 text-white p-2 rounded" 
              placeholder="Ville" 
              value={newSpot.city} 
              onChange={e => setNewSpot({ ...newSpot, city: e.target.value })} 
              required 
            />
            <input 
              className="bg-street-900 text-white p-2 rounded md:col-span-2" 
              placeholder="Adresse complète (ex: 208 Quai de Bercy)" 
              value={newSpot.address} 
              onChange={e => setNewSpot({ ...newSpot, address: e.target.value })} 
              required 
            />
            <input 
              className="bg-street-900 text-white p-2 rounded md:col-span-2" 
              placeholder="Tags (séparés par virgule, ex: barres, anneaux, trx)" 
              value={newSpot.tags} 
              onChange={e => setNewSpot({ ...newSpot, tags: e.target.value })} 
            />
          </div>
          <button 
            type="submit" 
            disabled={geocoding}
            className="mt-4 w-full bg-street-accent text-street-900 font-bold py-2 rounded hover:bg-street-accentHover disabled:opacity-50"
          >
            {geocoding ? 'Recherche des coordonnées...' : 'Ajouter le spot'}
          </button>
          <p className="text-xs text-gray-500 mt-2">
            💡 Les coordonnées GPS seront trouvées automatiquement
          </p>
        </form>

        <div className="mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un spot..."
            className="w-full bg-street-800 border border-street-700 text-white p-3 rounded-xl"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-street-800 border border-street-700 rounded-xl p-4 max-h-[500px] overflow-y-auto">
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
                    <p className="text-gray-500 text-xs">GPS: {s.lat.toFixed(4)}, {s.lng.toFixed(4)}</p>
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
                      {/* Bouton Voir temporairement désactivé 
                      <button 
                        onClick={() => focusSpot(s)} 
                        className="bg-street-700 text-white px-3 py-1 rounded hover:bg-street-600"
                      >
                        📍 Voir
                      </button>
                      */}
                      <button 
                        onClick={() => openItinerary(s)} 
                        className="bg-street-accent text-street-900 px-3 py-1 rounded hover:bg-street-accentHover font-semibold"
                      >
                        🚶 Itinéraire
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-street-800 border border-street-700 rounded-xl overflow-hidden">
            <div className="h-[500px] w-full">
              <MapContainer
                center={center}
                zoom={12}
                scrollWheelZoom
                className="h-full w-full"
              >
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
        </div>
      </div>
    </div>
  )
}