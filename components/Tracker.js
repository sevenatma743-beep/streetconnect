'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Tracker() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [newSession, setNewSession] = useState({
    type: '',
    reps: '',
    weight: '',
    notes: ''
  })

  useEffect(() => {
    if (user) loadSessions()
  }, [user])

  async function loadSessions() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setSessions(data || [])
    } catch (e) {
      console.error('Erreur chargement sessions:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddSession(e) {
    e.preventDefault()
    if (!user) return alert('Connecte-toi')
    try {
      const { error } = await supabase.from('workout_sessions').insert({
        user_id: user.id,
        type: newSession.type,
        reps: parseInt(newSession.reps),
        weight: parseFloat(newSession.weight),
        notes: newSession.notes
      })
      if (error) throw error
      setNewSession({ type: '', reps: '', weight: '', notes: '' })
      await loadSessions()
    } catch (e) {
      console.error('Erreur ajout séance:', e)
    }
  }

  return (
    <div className="p-4 min-h-screen pb-32">
      <h2 className="font-display font-bold text-3xl text-white mb-4">TRACKER</h2>

      <form onSubmit={handleAddSession} className="bg-street-800 border border-street-700 rounded-xl p-4 mb-6">
        <h3 className="text-white font-bold mb-3">Nouvelle Séance</h3>
        <div className="grid grid-cols-2 gap-3">
          <input className="bg-street-900 text-white p-2 rounded" placeholder="Exercice (ex: Dips)" required value={newSession.type} onChange={(e) => setNewSession({ ...newSession, type: e.target.value })} />
          <input className="bg-street-900 text-white p-2 rounded" placeholder="Reps" required value={newSession.reps} onChange={(e) => setNewSession({ ...newSession, reps: e.target.value })} />
          <input className="bg-street-900 text-white p-2 rounded" placeholder="Poids (kg)" value={newSession.weight} onChange={(e) => setNewSession({ ...newSession, weight: e.target.value })} />
          <input className="bg-street-900 text-white p-2 rounded col-span-2" placeholder="Notes" value={newSession.notes} onChange={(e) => setNewSession({ ...newSession, notes: e.target.value })} />
        </div>
        <button type="submit" className="mt-4 w-full bg-street-accent text-street-900 font-bold py-2 rounded hover:bg-street-accentHover">
          Enregistrer
        </button>
      </form>

      <h3 className="text-white font-bold mb-2">Historique</h3>
      {loading ? (
        <p className="text-gray-400">Chargement...</p>
      ) : sessions.length === 0 ? (
        <p className="text-gray-600">Aucune séance enregistrée.</p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li key={s.id} className="bg-street-800 border border-street-700 rounded-xl p-3">
              <p className="text-white font-bold">{s.type}</p>
              <p className="text-gray-400 text-sm">{s.reps} reps — {s.weight} kg</p>
              {s.notes && <p className="text-gray-500 text-sm italic">{s.notes}</p>}
              <p className="text-xs text-gray-600 mt-1">{new Date(s.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
