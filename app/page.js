'use client'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import Feed from '../components/Feed'
import Profile from '../components/Profile'
import Spots from '../components/Spots'
import Challenges from '../components/Challenges'
import Tracker from '../components/Tracker'
import Shop from '../components/Shop'
import Messages from '../components/Messages'

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState('feed')
  const [viewingUserId, setViewingUserId] = useState(null)

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
    console.log('🟢 handleUserClick appelé avec:', userId)
    setViewingUserId(userId)
    setActiveTab('profile')
  }

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'feed' && <Feed onUserClick={handleUserClick} />}
      {activeTab === 'spots' && <Spots />}
      {activeTab === 'challenges' && <Challenges />}
      {activeTab === 'tracker' && <Tracker />}
      {activeTab === 'shop' && <Shop />}
      {activeTab === 'messages' && <Messages />}
      {activeTab === 'profile' && <Profile viewUserId={viewingUserId} />}
    </Layout>
  )
}