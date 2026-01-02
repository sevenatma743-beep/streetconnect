'use client'
import { useState, useEffect } from 'react'
import { MessageCircle, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Messages() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Pour l'instant, juste une page placeholder
    // On ajoutera la vraie messagerie plus tard
    setLoading(false)
  }, [])

  return (
    <div className="p-4 pb-20 bg-street-900 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h2 className="font-display font-bold text-3xl text-white">MESSAGES</h2>
        <p className="text-sm text-gray-400 mt-1">Tes conversations</p>
      </div>

      {/* Barre de recherche */}
      <div className="mb-6 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
        <input
          type="text"
          placeholder="Rechercher une conversation..."
          className="w-full bg-street-800 border border-street-700 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-street-accent"
        />
      </div>

      {/* Liste des conversations */}
      {loading ? (
        <div className="text-center text-gray-400 py-12">Chargement...</div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-street-800 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <MessageCircle size={40} className="text-gray-600" />
          </div>
          <p className="text-white font-bold text-lg mb-2">Aucune conversation</p>
          <p className="text-gray-400 text-sm">
            Commence à discuter avec d'autres membres de la communauté !
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Exemple de conversation */}
          <div className="bg-street-800 border border-street-700 rounded-2xl p-4 hover:border-street-accent transition cursor-pointer">
            <div className="flex items-start gap-3">
              <img
                src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=50&h=50&fit=crop"
                alt="Avatar"
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-bold text-white">StreetWarrior</p>
                  <span className="text-xs text-gray-500">Il y a 2h</span>
                </div>
                <p className="text-sm text-gray-400 truncate">
                  Hey ! Tu viens t'entraîner demain ?
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-8 bg-street-800/50 border border-street-700 rounded-2xl p-4">
        <p className="text-xs text-gray-400 text-center">
          💬 La messagerie sera bientôt disponible !<br />
          En attendant, connecte-toi avec la communauté dans les commentaires.
        </p>
      </div>
    </div>
  )
}