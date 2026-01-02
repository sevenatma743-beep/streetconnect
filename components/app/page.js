'use client'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Feed from '../components/Feed'
import Profile from '../components/Profile'
import Navbar from '../components/Navbar'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  // État pour gérer quelle vue afficher
  const [currentView, setCurrentView] = useState('feed') // 'feed' ou 'profile'
  const [viewingUserId, setViewingUserId] = useState(null) // ID du profil à afficher

  // Redirection si pas connecté
  if (!loading && !user) {
    router.push('/auth')
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-street-900 flex items-center justify-center">
        <div className="text-white">Chargement...</div>
      </div>
    )
  }

  // Fonction pour aller sur un profil
  function handleUserClick(userId) {
    setViewingUserId(userId)
    setCurrentView('profile')
  }

  // Fonction pour retourner au feed
  function handleBackToFeed() {
    setCurrentView('feed')
    setViewingUserId(null)
  }

  return (
    <div className="min-h-screen bg-street-900">
      <Navbar />
      
      {/* Bouton retour si on est sur un profil */}
      {currentView === 'profile' && (
        <div className="max-w-4xl mx-auto p-4 pt-20">
          <button
            onClick={handleBackToFeed}
            className="mb-4 px-4 py-2 bg-street-700 text-white rounded-lg hover:bg-street-600 transition flex items-center space-x-2"
          >
            <span>←</span>
            <span>Retour au feed</span>
          </button>
        </div>
      )}

      {/* Contenu dynamique */}
      <div className="pt-16">
        {currentView === 'feed' ? (
          <Feed onUserClick={handleUserClick} />
        ) : (
          <Profile viewUserId={viewingUserId} />
        )}
      </div>
    </div>
  )
}