'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Challenges() {
  const { user } = useAuth()
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState({}) // Pour tracker quel challenge est en cours de join

  useEffect(() => {
    loadChallenges()
  }, [])

  async function loadChallenges() {
    try {
      setLoading(true)
      
      // Charger les challenges avec le compte de participants
      const { data: challengesData, error: challengesError } = await supabase
        .from('challenges')
        .select(`
          *,
          challenge_participants(count)
        `)
        .order('created_at', { ascending: false })
      
      if (challengesError) throw challengesError
      
      // Formater les données pour ajouter le vrai count
      const formattedChallenges = (challengesData || []).map(challenge => ({
        ...challenge,
        participants_count: challenge.challenge_participants?.[0]?.count || 0
      }))
      
      setChallenges(formattedChallenges)
    } catch (e) {
      console.error('Erreur chargement challenges:', e)
      alert('Erreur lors du chargement des défis')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin(challengeId) {
    if (!user) return alert('Connecte-toi pour participer !')
    
    try {
      setJoining(prev => ({ ...prev, [challengeId]: true }))
      
      const { error } = await supabase
        .from('challenge_participants')
        .insert({ 
          user_id: user.id, 
          challenge_id: challengeId 
        })
      
      if (error) {
        // Si l'erreur est due à une participation déjà existante
        if (error.code === '23505') {
          alert('Tu participes déjà à ce défi !')
        } else {
          throw error
        }
      } else {
        alert('✅ Tu participes maintenant à ce défi !')
        await loadChallenges()
      }
    } catch (e) {
      console.error('Erreur participation:', e)
      alert(`❌ Erreur : ${e.message}`)
    } finally {
      setJoining(prev => ({ ...prev, [challengeId]: false }))
    }
  }

  return (
    <div className="p-4 min-h-screen pb-32">
      <h2 className="font-display font-bold text-3xl text-white mb-4">DÉFIS</h2>

      {loading ? (
        <p className="text-gray-400">Chargement...</p>
      ) : challenges.length === 0 ? (
        <p className="text-gray-500">Aucun défi pour l'instant.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {challenges.map((challenge) => (
            <div key={challenge.id} className="bg-street-800 border border-street-700 rounded-2xl p-5">
              <h3 className="text-xl font-bold text-white mb-1">{challenge.title}</h3>
              <p className="text-gray-400 text-sm mb-2">{challenge.description}</p>
              <p className="text-gray-500 text-xs mb-3">{challenge.participants_count || 0} participant(s)</p>
              <button
                onClick={() => handleJoin(challenge.id)}
                disabled={joining[challenge.id]}
                className="bg-street-accent text-street-900 font-bold px-4 py-2 rounded hover:bg-street-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {joining[challenge.id] ? 'En cours...' : 'Je participe'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}