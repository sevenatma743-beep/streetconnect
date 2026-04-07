'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Layout from '../components/Layout'
import Feed from '../components/Feed'
import Profile from '../components/Profile'
import Spots from '../components/Spots'
import Shop from '../components/Shop'
import Messages from '../components/Messages'
import SearchUsers from '../components/SearchUsers'
import Notifications from '../components/Notifications'
import { useFeed } from '../hooks/useFeed'
import { supabase } from '../lib/supabase'

export default function HomeClient() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()

  // ✅ Feed global (1 fetch + cache + revalidate)
  const feed = useFeed(user?.id)

  // ✅ Ne montrer l'écran "Chargement..." qu'au tout premier boot
  const [hasBooted, setHasBooted] = useState(false)

  const [activeTab, setActiveTab] = useState('feed')
  const [viewingUserId, setViewingUserId] = useState(null)

  // 🔙 Pour retour intelligent quand on ouvre un profil depuis search / notifications / feed…
  const [profileReturnTab, setProfileReturnTab] = useState('feed')

  // Messages state-based
  const [messagesInitialConversationId, setMessagesInitialConversationId] = useState(null)
  const [messagesReturnTab, setMessagesReturnTab] = useState('feed')

  // know if we are inside a conversation screen
  const [messagesIsInConversation, setMessagesIsInConversation] = useState(false)

  // Badge messages non lus
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const activeTabRef = useRef(activeTab)
  const conversationIdsRef = useRef([])
  const conversationOpenRef = useRef(false)

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  useEffect(() => {
    conversationOpenRef.current = messagesIsInConversation
  }, [messagesIsInConversation])

  // ✅ Marquer le boot une seule fois quand le loading initial est terminé
  useEffect(() => {
    if (!loading && !hasBooted) setHasBooted(true)
  }, [loading, hasBooted])

  // Listener badge messages non lus
  useEffect(() => {
    if (!user) return

    let channel

    async function setupMessagesListener() {
      const { data: members } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id)

      const memberList = members || []
      conversationIdsRef.current = memberList.map(m => m.conversation_id)

      // Initialisation du badge depuis les non-lus existants
      if (conversationIdsRef.current.length > 0) {
        const { data: existingMsgs } = await supabase
          .from('messages')
          .select('conversation_id, created_at')
          .in('conversation_id', conversationIdsRef.current)
          .neq('sender_id', user.id)

        const lastReadMap = Object.fromEntries(
          memberList.map(m => [m.conversation_id, m.last_read_at])
        )

        const unreadConvs = new Set()
        for (const msg of existingMsgs || []) {
          const lastRead = lastReadMap[msg.conversation_id]
          if (lastRead && new Date(msg.created_at) > new Date(lastRead)) {
            unreadConvs.add(msg.conversation_id)
          }
        }
        setUnreadMessagesCount(unreadConvs.size)
      }

      channel = supabase
        .channel('global-messages-badge')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            const msg = payload.new
            if (!msg) return
            if (msg.sender_id === user.id) return
            if (!conversationIdsRef.current.includes(msg.conversation_id)) return
            if (activeTabRef.current === 'messages' || conversationOpenRef.current) return
            setUnreadMessagesCount(prev => prev + 1)
          }
        )
        .subscribe()
    }

    setupMessagesListener()

    return () => {
      if (channel) supabase.removeChannel(channel)
    }
  }, [user])

  // ✅ Lire l'URL (?tab=...&u=...) pour les retours depuis /p/[id], /followers, /following
  useEffect(() => {
    const tab = searchParams?.get('tab')
    const u = searchParams?.get('u')

    if (tab) {
      setActiveTab(tab)
      if (tab === 'profile') setViewingUserId(u || null)
      if (tab !== 'profile') setViewingUserId(null)
    }
  }, [searchParams])

  // Redirect if not logged (quand on a une info fiable)
  if (!loading && !user) {
    router.push('/auth')
    return null
  }

  // ✅ Loader uniquement au premier chargement
  if (!hasBooted && loading) {
    return (
      <div className="min-h-screen bg-street-900 flex items-center justify-center">
        <div className="text-white">Chargement...</div>
      </div>
    )
  }

  function handleUserClick(userId) {
    setProfileReturnTab(activeTab || 'feed')
    setViewingUserId(userId)
    setActiveTab('profile')
  }

  function handleBackFromProfile() {
    setViewingUserId(null)
    setActiveTab(profileReturnTab || 'feed')
  }

  function handleOpenConversation(conversationId, fromTab = 'feed') {
    setMessagesReturnTab(fromTab)
    setMessagesInitialConversationId(conversationId)
    setActiveTab('messages')
  }

  function handleOpenMessages(fromTab = 'feed') {
    setMessagesReturnTab(fromTab)
    setMessagesInitialConversationId(null) // inbox
    setActiveTab('messages')
  }

  function handleOpenNotifications() {
    setActiveTab('notifications')
  }

  function handleOpenSearch() {
    setActiveTab('search')
  }

  // hide layout header + bottom nav ONLY when in a conversation
  const hideLayoutHeader = activeTab === 'messages' && messagesIsInConversation
  const hideBottomNav = activeTab === 'messages' && messagesIsInConversation

  return (
    <Layout
      activeTab={activeTab}
      setActiveTab={(tab) => {
        if (tab === 'profile') setViewingUserId(null)
        setActiveTab(tab)
      }}
      hideHeader={hideLayoutHeader}
      hideBottomNav={hideBottomNav}
      unreadMessagesCount={unreadMessagesCount}
      onOpenMessages={() => handleOpenMessages(activeTab)}
      onOpenNotifications={handleOpenNotifications}
      onOpenSearch={handleOpenSearch}
    >
      {activeTab === 'feed' && <Feed onUserClick={handleUserClick} feed={feed} />}

      {activeTab === 'spots' && <Spots />}
      {activeTab === 'shop' && <Shop />}

      {activeTab === 'search' && <SearchUsers onUserClick={handleUserClick} />}

      {activeTab === 'notifications' && <Notifications onUserClick={handleUserClick} />}

      {activeTab === 'messages' && (
        <Messages
          initialConversationId={messagesInitialConversationId}
          returnTab={messagesReturnTab}
          onExit={() => {
            setMessagesIsInConversation(false)
            setActiveTab(messagesReturnTab || 'feed')
          }}
          onClearInitialConversation={() => setMessagesInitialConversationId(null)}
          onConversationModeChange={(isOpen) => setMessagesIsInConversation(isOpen)}
          onConversationRead={() => setUnreadMessagesCount(prev => Math.max(0, prev - 1))}
        />
      )}

      {activeTab === 'profile' && (
        <Profile
          viewUserId={viewingUserId}
          returnTab={profileReturnTab}
          onBack={handleBackFromProfile}
          onUserClick={handleUserClick}
          onOpenConversation={(conversationId) => handleOpenConversation(conversationId, 'profile')}
          onOpenMessages={() => handleOpenMessages('profile')}
        />
      )}
    </Layout>
  )
}