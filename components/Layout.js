'use client'
import { useEffect, useState } from 'react'
import { Home, MapPin, ShoppingBag, PlusCircle, Trophy, User, BarChart2, MessageCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getProfile } from '../lib/supabase'

export default function Layout({ children, activeTab, setActiveTab }) {
  const { user } = useAuth()
  const [avatarUrl, setAvatarUrl] = useState(null)

  const tabs = [
    { id: 'feed', label: 'FLUX', icon: Home },
    { id: 'spots', label: 'SPOTS', icon: MapPin },
    { id: 'shop', label: 'SHOP', icon: ShoppingBag },
    { id: 'create', label: '', icon: PlusCircle, isMain: true },
    { id: 'tracker', label: 'TRACKER', icon: BarChart2 },
    { id: 'challenges', label: 'DÉFIS', icon: Trophy },
    { id: 'profile', label: 'PROFIL', icon: User },
  ]

  useEffect(() => {
    if (user) {
      loadAvatar()
    }
  }, [user])

  async function loadAvatar() {
    try {
      const profile = await getProfile(user.id)
      if (profile?.avatar_url) {
        setAvatarUrl(profile.avatar_url)
      }
    } catch (err) {
      console.error('Erreur chargement avatar:', err)
    }
  }

  return (
    <div className="min-h-screen bg-street-900 pb-24">
      {/* Header */}
      <header className="bg-street-800 border-b border-street-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="font-display font-bold text-3xl tracking-wider">
            <span className="text-white">STREET</span>
            <span className="text-street-accent">CONNECT</span>
          </h1>

          <div className="flex items-center gap-4">
            <button className="text-gray-400 hover:text-white transition-colors cursor-not-allowed" disabled>
              <MessageCircle size={24} />
            </button>
            <button 
              onClick={() => setActiveTab('profile')}
              className="w-10 h-10 rounded-full bg-street-700 overflow-hidden border-2 border-street-accent hover:border-street-accentHover transition cursor-pointer"
            >
              <img 
                src={avatarUrl || '/default-avatar.png'} 
                className="w-full h-full object-cover" 
                alt="Profile" 
              />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-street-800 border-t border-street-700 z-50">
        <div className="max-w-7xl mx-auto flex justify-around items-center px-2 py-3">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            if (tab.isMain) {
              return (
                <button
                  key={tab.id}
                  onClick={() => {/* TODO: Modal création post */}}
                  className="flex flex-col items-center justify-center -mt-8"
                >
                  <div className="bg-street-accent rounded-full p-4 shadow-lg shadow-street-accent/30 hover:scale-110 transition-transform">
                    <Icon size={28} className="text-street-900" strokeWidth={2.5} />
                  </div>
                </button>
              )
            }

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center py-2 px-3 rounded-lg transition-all ${
                  isActive
                    ? 'text-street-accent'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-bold uppercase tracking-wide mt-1">
                  {tab.label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}