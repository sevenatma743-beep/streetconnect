'use client'
import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function SearchUsers({ onUserClick }) {
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (user) loadSuggestions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function loadSuggestions() {
    try {
      // Suggestions : derniers profils (tu peux changer en random si tu veux)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .neq('id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        console.error('❌ suggestions error:', error)
        setSuggestions([])
        return
      }

      setSuggestions(data || [])
    } catch (e) {
      console.error('💥 suggestions exception:', e)
      setSuggestions([])
    }
  }

  async function handleSearch(value) {
    setQuery(value)

    const q = value.trim()
    if (!q) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .ilike('username', `%${q}%`)
        .neq('id', user.id)
        .limit(25)

      if (error) {
        console.error('❌ search profiles error:', error)
        setResults([])
        return
      }

      setResults(data || [])
    } catch (e) {
      console.error('💥 search exception:', e)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const listToShow = query.trim() ? results : suggestions
  const emptyLabel = query.trim() ? 'Aucun résultat' : 'Aucune suggestion'

  return (
    <div className="p-4 pb-20 bg-street-900 min-h-screen">
      {/* Search bar only */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Rechercher un utilisateur..."
          className="w-full bg-street-800 border border-street-700 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-street-accent"
        />
      </div>

      {/* Small section title like Facebook */}
      {!query.trim() && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-gray-300 font-semibold">Suggestions</p>
          <button
            onClick={loadSuggestions}
            className="text-street-accent font-semibold text-sm hover:opacity-80"
          >
            Actualiser
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-gray-400 text-center py-10">Chargement...</div>
      ) : listToShow.length === 0 ? (
        <div className="text-gray-400 text-center py-10">{emptyLabel}</div>
      ) : (
        <div className="space-y-3">
          {listToShow.map((p) => (
            <button
              key={p.id}
              onClick={() => onUserClick?.(p.id)}
              className="w-full bg-street-800 border border-street-700 rounded-2xl p-4 hover:border-street-accent transition flex items-center gap-3"
            >
              <img
                src={
                  p.avatar_url ||
                  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'
                }
                alt={p.username}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="text-left">
                <p className="text-white font-bold">{p.username}</p>
                <p className="text-gray-400 text-sm">@{p.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}