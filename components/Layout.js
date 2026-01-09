'use client'
import { Home, MapPin, Award, ShoppingCart, User, MessageCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Layout({ activeTab, setActiveTab, children }) {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    if (user) {
      getProfile()
    }
  }, [user])

  async function getProfile() {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (error) throw error
      setProfile(data)
    } catch (e) {
      console.error('Erreur chargement profil:', e)
    }
  }

  const tabs = [
    { id: 'feed', icon: Home, label: 'FEED' },
    { id: 'spots', icon: MapPin, label: 'SPOTS' },
    { id: 'challenges', icon: Award, label: 'CHALLENGES' },
    { id: 'tracker', icon: User, label: 'TRACKER' },
    { id: 'shop', icon: ShoppingCart, label: 'SHOP' },
    { id: 'profile', icon: User, label: 'PROFIL' }
  ]

  const avatarUrl = profile?.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'

  return (
    <div className="flex flex-col h-screen bg-street-900">
      {/* Header */}
      <header className="bg-street-800 border-b border-street-700 px-4 py-3 flex items-center justify-between">
        <h1 className="font-display text-2xl font-black">
          <span className="text-white">STREET</span>
          <span className="text-street-accent">CONNECT</span>
        </h1>
        <div className="flex items-center gap-3">
          {/* Icône message */}
          <button 
            onClick={() => setActiveTab('messages')}
            className="relative p-2 hover:bg-street-700 rounded-lg transition"
            aria-label="Messages"
          >
            <MessageCircle size={24} className="text-gray-400 hover:text-street-accent" />
          </button>
          {/* Avatar */}
          <button
            onClick={() => setActiveTab('profile')}
            className="relative"
          >
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-10 h-10 rounded-full border-4 border-street-accent object-cover"
            />
          </button>
        </div>
      </header>

      {/* Main Content - Added bottom padding for fixed nav */}
      <main 
        className="flex-1 overflow-y-auto" 
        style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}
      >
        {children}
      </main>

      {/* Bottom Navigation - FIXED for mobile visibility */}
      <nav 
        className="fixed bottom-0 left-0 right-0 bg-street-800 border-t border-street-700 px-2 py-2 flex items-center justify-around z-50" 
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'text-street-accent'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
              <span className={`text-[10px] font-bold mt-1 ${
                activeTab === tab.id ? 'text-street-accent' : 'text-gray-500'
              }`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}