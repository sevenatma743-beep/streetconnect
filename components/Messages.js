'use client'
import { useState, useEffect, useRef } from 'react'
import { MessageCircle, Search, Send, ArrowLeft, X } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'

export default function Messages({
  initialConversationId = null,
  returnTab = 'feed',
  onExit,
  onClearInitialConversation,
  onConversationModeChange // ✅ NEW
}) {
  const { user } = useAuth()

  const [inbox, setInbox] = useState([])
  const [loading, setLoading] = useState(true)

  const [activeConversation, setActiveConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showSearch, setShowSearch] = useState(false)
  const [creatingConversation, setCreatingConversation] = useState(false)

  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    if (user) loadInbox()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // ✅ tells parent if we're in conversation mode (hide bottom nav + header)
  useEffect(() => {
    if (typeof onConversationModeChange === 'function') {
      onConversationModeChange(!!activeConversation)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation])

  // ✅ Open convo instantly when Messages tab opens with initialConversationId
  useEffect(() => {
    if (user && initialConversationId) {
      openConversation(initialConversationId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, initialConversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (activeConversation?.id) {
      subscribeToMessages(activeConversation.id)
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.id])

  function getMemberId(member) {
    return member?.user_id ?? member?.userId ?? null
  }

  function getMemberProfile(member) {
    if (!member) return null
    const profile = member.profiles ?? member.profile ?? null
    if (Array.isArray(profile) && profile.length > 0) return profile[0]
    return profile
  }

  async function loadInbox() {
    try {
      setLoading(true)

      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          id,
          updated_at,
          conversation_members (
            user_id,
            last_read_at,
            profiles!conversation_members_user_id_fkey (
              id,
              username,
              avatar_url
            )
          ),
          messages (
            id,
            text,
            created_at,
            sender_id
          )
        `)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('❌ Error loading inbox:', error)
        setInbox([])
        return
      }

      const processedInbox = (conversations || []).map(conv => {
        const members = conv.conversation_members || []

        const otherMember = members.find(m => {
          const memberId = getMemberId(m)
          return memberId && memberId !== user.id
        })

        const otherUserProfile = getMemberProfile(otherMember)

        const sortedMessages = (conv.messages || []).sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at)
        )
        const lastMessage = sortedMessages[0]

        const currentUserMember = members.find(m => getMemberId(m) === user.id)
        const unread =
          lastMessage && currentUserMember?.last_read_at
            ? new Date(lastMessage.created_at) > new Date(currentUserMember.last_read_at)
            : false

        return {
          id: conv.id,
          otherUser: otherUserProfile,
          lastMessage: lastMessage || null,
          updatedAt: conv.updated_at,
          unread,
          memberCount: members.length
        }
      })

      // ✅ IMPORTANT: sort by last message timestamp (fallback to updatedAt)
      const sortedInbox = (processedInbox || []).sort((a, b) => {
        const ta = new Date(a?.lastMessage?.created_at || a?.updatedAt || 0).getTime()
        const tb = new Date(b?.lastMessage?.created_at || b?.updatedAt || 0).getTime()
        return tb - ta
      })

      setInbox(sortedInbox)
    } catch (err) {
      console.error('💥 Exception in loadInbox:', err)
      setInbox([])
    } finally {
      setLoading(false)
    }
  }

  async function openConversationWithUser(userId) {
    if (creatingConversation) return
    setCreatingConversation(true)

    try {
      const { data, error } = await supabase.rpc('create_or_get_dm', {
        other_user_id: userId
      })

      if (error) {
        console.error('❌ RPC create_or_get_dm error:', error)
        alert(`Erreur: ${error.message}`)
        return
      }

      const convoId = typeof data === 'string' ? data : data?.conversation_id
      if (!convoId) {
        console.error('❌ conversationId missing from response:', data)
        alert('ID de conversation manquant')
        return
      }

      openConversation(convoId)
    } catch (err) {
      console.error('💥 Exception in openConversationWithUser:', err)
      alert("Erreur lors de l'ouverture de la conversation")
    } finally {
      setCreatingConversation(false)
    }
  }

  async function openConversation(conversationId) {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          conversation_members (
            user_id,
            profiles!conversation_members_user_id_fkey (
              id,
              username,
              avatar_url
            )
          ),
          messages (
            id,
            text,
            created_at,
            sender_id,
            profiles!messages_sender_id_fkey (
              id,
              username,
              avatar_url
            )
          )
        `)
        .eq('id', conversationId)
        .single()

      if (error) {
        console.error('❌ Error loading conversation:', error)
        return
      }

      const members = data.conversation_members || []
      const otherMember = members.find(m => {
        const memberId = getMemberId(m)
        return memberId && memberId !== user.id
      })

      const otherUserProfile = getMemberProfile(otherMember)
      const sortedMessages = (data.messages || []).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      )

      const conversation = {
        id: data.id,
        otherUser: otherUserProfile,
        messages: sortedMessages,
        memberCount: members.length
      }

      setActiveConversation(conversation)
      setMessages(sortedMessages)

      await markAsRead(conversationId)

      if (typeof onClearInitialConversation === 'function') {
        onClearInitialConversation()
      }
    } catch (err) {
      console.error('💥 Exception in openConversation:', err)
    }
  }

  async function markAsRead(conversationId) {
    try {
      const { error } = await supabase
        .from('conversation_members')
        .update({ last_read_at: new Date().toISOString() })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)

      if (error) console.error('❌ Error marking as read:', error)
    } catch (err) {
      console.error('💥 Exception in markAsRead:', err)
    }
  }

  function subscribeToMessages(convoId) {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`conversation:${convoId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${convoId}`
        },
        async (payload) => {
          const inserted = payload?.new
          if (!inserted?.id) return

          if (inserted.sender_id === user.id) {
            loadInbox()
            return
          }

          try {
            const { data, error } = await supabase
              .from('messages')
              .select(`
                id,
                text,
                created_at,
                sender_id,
                profiles!messages_sender_id_fkey (
                  id,
                  username,
                  avatar_url
                )
              `)
              .eq('id', inserted.id)
              .single()

            if (error) {
              setMessages(prev =>
                prev.some(m => m.id === inserted.id) ? prev : [...prev, inserted]
              )
            } else {
              setMessages(prev =>
                prev.some(m => m.id === data.id) ? prev : [...prev, data]
              )
            }

            markAsRead(convoId)
            loadInbox()
          } catch (err) {
            console.error('💥 Exception in realtime handler:', err)
            setMessages(prev =>
              prev.some(m => m.id === inserted.id) ? prev : [...prev, inserted]
            )
            loadInbox()
          }
        }
      )
      .subscribe()

    channelRef.current = channel
  }

  async function handleSendMessage(e) {
    e.preventDefault()
    if (!newMessage.trim() || !activeConversation || sending) return

    setSending(true)

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: activeConversation.id,
          sender_id: user.id,
          text: newMessage.trim()
        })
        .select(`
          id,
          text,
          created_at,
          sender_id,
          profiles!messages_sender_id_fkey (
            id,
            username,
            avatar_url
          )
        `)
        .single()

      if (error) {
        console.error('❌ Error sending message:', error)
        return
      }

      setMessages(prev => (prev.some(m => m.id === data.id) ? prev : [...prev, data]))
      setNewMessage('')
      loadInbox()
    } catch (err) {
      console.error('💥 Exception in handleSendMessage:', err)
    } finally {
      setSending(false)
    }
  }

  async function handleSearch(query) {
    setSearchQuery(query)
    if (query.length === 0) {
      setSearchResults([])
      return
    }

    try {
      const { data: following } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)

      const followingIds = (following || []).map(f => f.following_id)
      if (followingIds.length === 0) {
        setSearchResults([])
        return
      }

      const { data: followers } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id)
        .in('follower_id', followingIds)

      const mutualIds = (followers || []).map(f => f.follower_id)
      if (mutualIds.length === 0) {
        setSearchResults([])
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', mutualIds)
        .ilike('username', `%${query}%`)
        .limit(10)

      if (error) {
        console.error('❌ Error searching:', error)
        setSearchResults([])
        return
      }

      setSearchResults(data || [])
    } catch (err) {
      console.error('💥 Exception in handleSearch:', err)
      setSearchResults([])
    }
  }

  function handleSelectUser(userId) {
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
    openConversationWithUser(userId)
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleBack() {
    if (activeConversation) {
      closeConversation()
      return
    }
    if (typeof onExit === 'function') onExit()
  }

  function closeConversation() {
    setActiveConversation(null)
    setMessages([])
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    loadInbox()
  }

  // ============================================
  // RENDER: ACTIVE CONVERSATION VIEW
  // ============================================
  if (activeConversation) {
    const displayName = activeConversation.otherUser?.username || 'Utilisateur'
    const displayAvatar =
      activeConversation.otherUser?.avatar_url ||
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'

    const isInvalidConversation = activeConversation.memberCount === 1

    return (
      <div className="flex flex-col h-screen bg-street-900">
        <div className="p-4 border-b border-street-700 bg-street-800 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 hover:bg-street-700 rounded-lg transition"
          >
            <ArrowLeft size={20} className="text-white" />
          </button>
          <img
            src={displayAvatar}
            alt={displayName}
            className="w-10 h-10 rounded-full border-2 border-street-accent"
          />
          <div className="flex-1">
            <p className="font-bold text-white">{displayName}</p>
            <p className="text-xs text-gray-400">
              {isInvalidConversation ? '⚠️ Conversation invalide (1 membre)' : `@${displayName}`}
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.map(msg => {
            const isMe = msg.sender_id === user.id
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[70%] px-4 py-2 rounded-2xl ${
                    isMe ? 'bg-street-accent text-street-900' : 'bg-street-800 text-white'
                  }`}
                >
                  <p className="text-sm">{msg.text}</p>
                  <p className="text-xs mt-1 opacity-70">
                    {new Date(msg.created_at).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={handleSendMessage}
          className="p-4 border-t border-street-700 bg-street-800"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message..."
              className="flex-1 px-4 py-2 bg-street-900 border border-street-700 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-street-accent"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="p-2 bg-street-accent text-street-900 rounded-full hover:bg-street-accentHover transition disabled:opacity-50"
            >
              <Send size={20} />
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ============================================
  // RENDER: INBOX VIEW (✅ sans gros titre + sans flèche)
  // ============================================
  return (
    <div className="p-4 bg-street-900 min-h-screen">
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => setShowSearch(true)}
          placeholder="Rechercher une conversation..."
          className="w-full bg-street-800 border border-street-700 rounded-xl pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-street-accent"
        />
        {showSearch && searchQuery && (
          <button
            onClick={() => {
              setShowSearch(false)
              setSearchQuery('')
              setSearchResults([])
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
          >
            <X size={20} />
          </button>
        )}

        {showSearch && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-street-800 border border-street-700 rounded-xl overflow-hidden z-10">
            {searchResults.map(result => (
              <button
                key={result.id}
                onClick={() => handleSelectUser(result.id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-street-700 transition"
              >
                <img
                  src={result.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'}
                  alt={result.username}
                  className="w-10 h-10 rounded-full border-2 border-street-accent"
                />
                <div className="text-left">
                  <p className="font-bold text-white">{result.username}</p>
                  <p className="text-xs text-gray-400">@{result.username}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-12">Chargement...</div>
      ) : inbox.length === 0 ? (
        <div className="text-center py-12">
          <div className="bg-street-800 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <MessageCircle size={40} className="text-gray-600" />
          </div>
          <p className="text-white font-bold text-lg mb-2">Aucune conversation</p>
          <p className="text-gray-400 text-sm">Recherche des amis pour commencer à discuter !</p>
        </div>
      ) : (
        <div className="space-y-3">
          {inbox.map(conv => {
            const displayName = conv.otherUser?.username || 'Utilisateur inconnu'
            const displayAvatar =
              conv.otherUser?.avatar_url ||
              'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'

            const isInvalidConversation = conv.memberCount === 1

            return (
              <div
                key={conv.id}
                onClick={() => openConversation(conv.id)}
                className="bg-street-800 border border-street-700 rounded-2xl p-4 hover:border-street-accent transition cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={displayAvatar}
                    alt={displayName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`font-bold ${conv.unread ? 'text-white' : 'text-gray-300'}`}>
                        {displayName}
                        {isInvalidConversation && (
                          <span className="ml-2 text-xs text-yellow-500">⚠️ 1 membre</span>
                        )}
                      </p>
                      <span className="text-xs text-gray-500">
                        {conv.lastMessage
                          ? new Date(conv.lastMessage.created_at).toLocaleDateString('fr-FR')
                          : ''}
                      </span>
                    </div>
                    <p
                      className={`text-sm truncate ${
                        conv.unread ? 'text-white font-semibold' : 'text-gray-400'
                      }`}
                    >
                      {conv.lastMessage?.text || 'Aucun message'}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
