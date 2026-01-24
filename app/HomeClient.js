'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import Layout from '../components/Layout'
import Feed from '../components/Feed'
import Profile from '../components/Profile'
import Spots from '../components/Spots'
import Challenges from '../components/Challenges'
import Tracker from '../components/Tracker'
import Shop from '../components/Shop'
import Messages from '../components/Messages'
import SearchUsers from '../components/SearchUsers'
import Notifications from '../components/Notifications'
import { useFeed } from '../hooks/useFeed'

export default function HomePage() {
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

  // ✅ Marquer le boot une seule fois quand le loading initial est terminé
  useEffect(() => {
    if (!loading && !hasBooted) setHasBooted(true)
  }, [loading, hasBooted])

  // ✅ Lire l’URL (?tab=...&u=...) pour les retours depuis /p/[id], /followers, /following
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
      onOpenMessages={() => handleOpenMessages(activeTab)}
      onOpenNotifications={handleOpenNotifications}
      onOpenSearch={handleOpenSearch}
    >
      {activeTab === 'feed' && <Feed onUserClick={handleUserClick} feed={feed} />}

      {activeTab === 'spots' && <Spots />}
      {activeTab === 'challenges' && <Challenges />}
      {activeTab === 'tracker' && <Tracker />}
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