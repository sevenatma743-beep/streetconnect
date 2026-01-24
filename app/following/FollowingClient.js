'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export default function FollowingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const u = searchParams?.get('u') || null

  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter((r) => (r?.profiles?.username || '').toLowerCase().includes(s))
  }, [rows, q])

  useEffect(() => {
    if (!u) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [u])

  async function load() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('follows')
        .select(
          `
          following_id,
          profiles:profiles!follows_following_id_fkey(id, username, avatar_url)
        `
        )
        .eq('follower_id', u)
        .order('created_at', { ascending: false })

      if (error) throw error
      setRows(data || [])
    } catch (e) {
      console.error(e)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  function backToProfile() {
    router.push(`/?tab=profile&u=${encodeURIComponent(u)}`)
  }

  function openProfile(userId) {
    router.push(`/?tab=profile&u=${encodeURIComponent(userId)}`)
  }

  return (
    <div className="min-h-screen bg-street-900">
      <div className="sticky top-0 z-20 bg-street-800/90 backdrop-blur border-b border-street-700">
        <div className="px-4 py-3 flex items-center gap-3">
          <button onClick={backToProfile} className="p-2 rounded-lg hover:bg-street-700 text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="text-white font-bold">Suivis</div>
        </div>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 bg-street-950 border border-street-700 rounded-xl px-3 py-2">
            <Search size={18} className="text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher"
              className="flex-1 bg-transparent outline-none text-white text-sm placeholder:text-gray-500"
            />
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="text-gray-400 text-center py-10">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="text-gray-500 text-center py-10">Aucun suivi</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const p = r.profiles
              return (
                <button
                  key={r.following_id}
                  onClick={() => openProfile(r.following_id)}
                  className="w-full flex items-center gap-3 bg-street-800 border border-street-700 rounded-xl px-3 py-3"
                >
                  <img
                    src={p?.avatar_url || 'https://placehold.co/80'}
                    className="w-10 h-10 rounded-full object-cover border border-street-700"
                    alt="avatar"
                  />
                  <div className="text-left">
                    <div className="text-white font-semibold text-sm">{p?.username || 'Utilisateur'}</div>
                    <div className="text-gray-500 text-xs">{r.following_id}</div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}