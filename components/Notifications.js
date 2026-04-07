'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

export default function Notifications() {
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
        (payload) => {
          console.log('[NOTIF SCREEN]', payload.new)
          setNotifications((prev) => [payload.new, ...prev.slice()])
          supabase
            .from('notifications')
            .update({ is_read: true })
            .eq('id', payload.new.id)
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
      setNotifications(data || [])
    }
    setLoading(false)

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
  }

  return (
    <div className="p-4 pb-20 bg-street-900 min-h-screen">
      <h2 className="text-white font-bold text-lg mb-4">Notifications</h2>

      {loading ? (
        <div className="text-gray-400 py-8 text-center">Chargement...</div>
      ) : notifications.length === 0 ? (
        <div className="text-gray-400 py-8 text-center">Aucune notification</div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className="bg-street-800 border border-street-700 rounded-2xl p-3"
            >
              <p className="text-white text-sm font-semibold">{notif.type}</p>
              <p className="text-gray-400 text-xs mt-1">actor : {notif.actor_id}</p>
              {notif.post_id && (
                <p className="text-gray-400 text-xs">post : {notif.post_id}</p>
              )}
              <p className="text-gray-500 text-xs mt-1">
                {new Date(notif.created_at).toLocaleString('fr-FR')}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
