'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Notifications({ onUserClick }) {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState([])

  useEffect(() => {
    if (user) loadNotifications()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('notifications-screen')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          console.log('[NOTIF SCREEN]', payload.new)
          const notif = payload.new
          const { data: actor } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', notif.actor_id)
            .single()
          setNotifications((prev) => [{ ...notif, actor }, ...prev.slice()])
          supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', notif.id)
            .then(() => {})
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  async function loadNotifications() {
    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, actor_id, post_id, created_at, is_read')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) {
      console.error('❌ notifications error:', error)
      setNotifications([])
    } else {
      const rows = data || []
      const actorIds = [...new Set(rows.map(n => n.actor_id).filter(Boolean))]
      let actorMap = {}
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', actorIds)
        for (const p of profiles || []) actorMap[p.id] = p
      }
      setNotifications(rows.map(n => ({ ...n, actor: actorMap[n.actor_id] || null })))
    }
    setLoading(false)

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
  }

  function getNotifText(type, username) {
    const u = username || 'Quelqu\'un'
    if (type === 'like') return `${u} a aimé ta publication`
    if (type === 'comment') return `${u} a commenté ta publication`
    if (type === 'follow') return `${u} a commencé à te suivre`
    return `${u} a interagi avec toi`
  }

  function handleCardClick(notif) {
    if ((notif.type === 'like' || notif.type === 'comment') && notif.post_id) {
      router.push(`/p/${notif.post_id}?from=notifications`)
    } else if (notif.actor_id && notif.actor) {
      onUserClick(notif.actor_id)
    }
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'à l\'instant'
    if (m < 60) return `${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    const d = Math.floor(h / 24)
    if (d < 7) return `${d}j`
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="p-4 pb-20 bg-street-900 min-h-screen">
      <h2 className="text-white font-bold text-lg mb-4">Notifications</h2>

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Chargement...</div>
      ) : notifications.length === 0 ? (
        <div className="text-gray-400 py-8 text-center">Aucune notification</div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => {
            const username = notif.actor?.username
            const avatarUrl = notif.actor?.avatar_url
            const initial = username ? username[0].toUpperCase() : '?'

            return (
              <div
                key={notif.id}
                onClick={() => handleCardClick(notif)}
                className={`flex items-center gap-3 rounded-2xl p-3 border cursor-pointer ${
                  notif.is_read
                    ? 'bg-street-800 border-street-700'
                    : 'bg-street-800 border-street-accent/40'
                }`}
              >
                {/* Avatar */}
                <div
                  onClick={notif.actor ? (e) => { e.stopPropagation(); onUserClick(notif.actor_id) } : undefined}
                  className={`w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-street-700 flex items-center justify-center ${notif.actor ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-sm font-bold">{initial}</span>
                  )}
                </div>

                {/* Texte + date */}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm leading-snug">
                    <span
                      onClick={notif.actor ? (e) => { e.stopPropagation(); onUserClick(notif.actor_id) } : undefined}
                      className={`font-semibold ${notif.actor ? 'cursor-pointer hover:underline' : ''}`}
                    >
                      {username || 'Quelqu\'un'}
                    </span>
                    {' '}{notif.type === 'like' && 'a aimé ta publication'}
                    {notif.type === 'comment' && 'a commenté ta publication'}
                    {notif.type === 'follow' && 'a commencé à te suivre'}
                    {!['like','comment','follow'].includes(notif.type) && 'a interagi avec toi'}
                  </p>
                  <p className="text-gray-500 text-xs mt-0.5">{timeAgo(notif.created_at)}</p>
                </div>

                {/* Indicateur non lu */}
                {!notif.is_read && (
                  <span className="w-2 h-2 rounded-full bg-street-accent flex-shrink-0" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
