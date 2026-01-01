'use client'

import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import Feed from '../components/Feed'
import Profile from '../components/Profile'
import Shop from '../components/Shop'
import Spots from '../components/Spots'
import Tracker from '../components/Tracker'
import Challenges from '../components/Challenges'
import Layout from '../components/Layout'

export default function HomePage() {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState('feed')

  // Afficher un loader pendant la vérification de l'auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    )
  }

  // Rediriger vers /auth si non connecté
  if (!user) {
    // Dans Next.js, utiliser router.push('/auth') ou window.location.href
    // Pour l'instant, afficher un message
    if (typeof window !== 'undefined') {
      window.location.href = '/auth'
    }
    return null
  }

  // Fonction pour rendre le composant actif
  function renderActiveComponent() {
    switch (activeTab) {
      case 'feed':
        return <Feed />
      case 'profile':
        return <Profile />
      case 'shop':
        return <Shop />
      case 'spots':
        return <Spots />
      case 'tracker':
        return <Tracker />
      case 'challenges':
        return <Challenges />
      default:
        return <Feed />
    }
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="min-h-screen bg-gray-50">
        {renderActiveComponent()}
      </div>
    </Layout>
  )
}