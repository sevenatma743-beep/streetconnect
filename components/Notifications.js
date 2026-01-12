'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Notifications({ onUserClick }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [followers, setFollowers] = useState([])
  const [followingIds, setFollowingIds] = useState(new Set())
  const [actionLoading, setActionLoading] = useState(null)

  useEffect(() => {
    if (user) loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function loadData() {
    setLoading(true)
    try {
      // People who follow me
      const { data: followerRows, error: e1 } = await supabase
        .from('follows')
        .select('follower_id, created_at, profiles!follows_follower_id_fkey(id, username, avatar_url)')
        .eq('following_id', user.id)
        .order('created_at', { ascending: false })

      if (e1) {
        console.error('❌ load followers error:', e1)
        setFollowers([])
      } else {
        setFollowers(followerRows || [])
      }

      // People I follow
      const { data: followingRows, error: e2 } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)

      if (e2) {
        console.error('❌ load following error:', e2)
        setFollowingIds(new Set())
      } else {
        setFollowingIds(new Set((followingRows || []).map((r) => r.following_id)))
      }
    } catch (e) {
      console.error('💥 notifications exception:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleFollowBack(targetUserId) {
    if (!targetUserId) return
    if (followingIds.has(targetUserId)) return

    setActionLoading(targetUserId)
    try {
      const { error } = await supabase.from('follows').insert({
        follower_id: user.id,
        following_id: targetUserId
      })

      if (error) {
        console.error('❌ follow back error:', error)
        return
      }

      setFollowingIds((prev) => new Set(prev).add(targetUserId))
    } catch (e) {
      console.error('💥 follow back exception:', e)
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="p-4 pb-20 bg-street-900 min-h-screen">
      {/* Small title only */}
      <h2 className="text-white font-bold text-lg mb-4">Notifications</h2>

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Chargement...</div>
      ) : followers.length === 0 ? (
        <div className="text-gray-400 py-8 text-center">Aucune notification</div>
      ) : (
        <div className="space-y-3">
          {followers.map((row) => {
            const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
            const uid = row.follower_id
            const username = p?.username || 'Utilisateur'
            const avatar =
              p?.avatar_url ||
              'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'

            const alreadyFollowingBack = followingIds.has(uid)

            return (
              <div
                key={uid + (row.created_at || '')}
                className="bg-street-800 border border-street-700 rounded-2xl p-3 flex items-center gap-3"
              >
                <button
                  onClick={() => onUserClick?.(uid)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <img src={avatar} alt={username} className="w-11 h-11 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{username}</p>
                    <p className="text-gray-400 text-sm truncate">a commencé à te suivre</p>
                  </div>
                </button>

                <button
                  onClick={() => handleFollowBack(uid)}
                  disabled={alreadyFollowingBack || actionLoading === uid}
                  className={`px-4 py-2 rounded-xl font-bold transition ${
                    alreadyFollowingBack
                      ? 'bg-street-900 text-gray-400 border border-street-700'
                      : 'bg-street-accent text-street-900 hover:bg-street-accentHover'
                  }`}
                >
                  {alreadyFollowingBack ? 'Suivi' : actionLoading === uid ? '...' : 'Suivre'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}