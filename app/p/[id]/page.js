// app/p/[id]/page.js
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Heart, MessageCircle, Send } from 'lucide-react'
import Image from 'next/image'

import { useAuth } from '../../../contexts/AuthContext'
import { supabase, deletePost } from '../../../lib/supabase'

function formatTime(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (diff < 60000) return 'à l\'instant'
  if (m < 60) return `${m} min`
  if (h < 24) return `${h} h`
  if (d < 7) return `${d} j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function PostPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const { user } = useAuth()

  const postId = useMemo(() => {
    const raw = params?.id
    return Array.isArray(raw) ? raw[0] : raw
  }, [params])

  // u = userId du profil source (pour charger la liste)
  const fromUserId = searchParams?.get('u') || null
  const fromTab = searchParams?.get('from') || null

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // ✅ ownerId déterministe pour le bouton retour
  const [ownerId, setOwnerId] = useState(null)

  // Feed Instagram (liste des posts du profil)
  const [posts, setPosts] = useState([])

  // comments input par postId
  const [commentTextByPost, setCommentTextByPost] = useState({})
  const [sendingCommentByPost, setSendingCommentByPost] = useState({})
  const [likingByPost, setLikingByPost] = useState({})
  const [deletingByPost, setDeletingByPost] = useState({})
  const [deleteErrorByPost, setDeleteErrorByPost] = useState({})
  const [openPostMenu, setOpenPostMenu] = useState(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [expandedComments, setExpandedComments] = useState({})
  const [expandedCaptions, setExpandedCaptions] = useState({})
  const [postImageIndexes, setPostImageIndexes] = useState({})

  const scrollRef = useRef(null)
  const redirectingAfterDeleteRef = useRef(false)

  useEffect(() => {
    if (!postId) return
    loadFeed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user?.id])

  // ✅ Retour logique (SPA + bon profil + navbar)
  function handleBack() {
    if (fromTab === 'notifications') {
      router.push('/?tab=notifications')
      return
    }
    if (fromUserId) {
      router.push(`/?tab=profile&u=${encodeURIComponent(fromUserId)}`)
      return
    }
    if (ownerId) {
      router.push(`/?tab=profile&u=${encodeURIComponent(ownerId)}`)
      return
    }
    router.push('/?tab=feed')
  }

  async function loadFeed() {
    try {
      setLoading(true)
      setError(null)

      // 1) Charger le post ouvert (pour récupérer son user_id si besoin)
      const { data: openedPost, error: openedErr } = await supabase
        .from('posts')
        .select(
          `
          id,
          user_id,
          caption,
          media_url,
          images,
          type,
          created_at,
          profiles:profiles(id, username, avatar_url)
        `
        )
        .eq('id', postId)
        .single()

      if (openedErr) throw openedErr

      // Depuis notifications : afficher uniquement le post ciblé
      if (fromTab === 'notifications') {
        const [likesCountRes, iLikedRes, commentsRes] = await Promise.all([
          supabase.from('likes').select('id', { count: 'exact', head: true }).eq('post_id', openedPost.id),
          user?.id
            ? supabase.from('likes').select('id').eq('post_id', openedPost.id).eq('user_id', user.id).maybeSingle()
            : Promise.resolve({ data: null }),
          supabase.from('comments').select('id, post_id, user_id, text, created_at, profiles:profiles(id, username, avatar_url)').eq('post_id', openedPost.id).order('created_at', { ascending: true })
        ])
        setPosts([{
          ...openedPost,
          likes_count: likesCountRes?.count || 0,
          i_liked: !!iLikedRes?.data,
          comments: commentsRes?.data || []
        }])
        setOwnerId(openedPost.user_id)
        setLoading(false)
        return
      }

      // 2) Déterminer quel profil on doit afficher (priorité au param ?u=)
      const profileOwnerId = fromUserId || openedPost.user_id
      setOwnerId(profileOwnerId)

      // 3) Charger TOUS les posts de ce profil (comme Instagram)
      const { data: rawPosts, error: postsErr } = await supabase
        .from('posts')
        .select(
          `
          id,
          user_id,
          caption,
          media_url,
          images,
          type,
          created_at,
          profiles:profiles(id, username, avatar_url)
        `
        )
        .eq('user_id', profileOwnerId)
        .order('created_at', { ascending: false })

      if (postsErr) throw postsErr

      // 4) Enrichir chaque post: likes_count, i_liked, comments[]
      const enriched = await Promise.all(
        (rawPosts || []).map(async (p) => {
          const [likesCountRes, iLikedRes, commentsRes] = await Promise.all([
            supabase.from('likes').select('id', { count: 'exact', head: true }).eq('post_id', p.id),
            user?.id
              ? supabase
                  .from('likes')
                  .select('id')
                  .eq('post_id', p.id)
                  .eq('user_id', user.id)
                  .maybeSingle()
              : Promise.resolve({ data: null, error: null }),
            supabase
              .from('comments')
              .select(
                `
                id,
                post_id,
                user_id,
                text,
                created_at,
                profiles:profiles(id, username, avatar_url)
              `
              )
              .eq('post_id', p.id)
              .order('created_at', { ascending: true })
          ])

          const likesCount = likesCountRes?.count || 0
          const iLiked = !!iLikedRes?.data
          const comments = commentsRes?.data || []

          return {
            ...p,
            likes_count: likesCount,
            i_liked: iLiked,
            comments
          }
        })
      )

      setPosts(enriched)

      // 5) Scroll automatique vers le post ouvert
      requestAnimationFrame(() => {
        const el = document.getElementById(`post-${postId}`)
        if (el && scrollRef.current) {
          el.scrollIntoView({ block: 'start' })
        }
      })
    } catch (e) {
      console.error('loadFeed error:', e)
      setError('Impossible de charger les publications')
      setPosts([])
    } finally {
      setLoading(false)
    }
  }

  async function refreshOnePost(postIdToRefresh) {
    try {
      const p = posts.find((x) => x.id === postIdToRefresh)
      if (!p) return

      const [likesCountRes, iLikedRes, commentsRes] = await Promise.all([
        supabase.from('likes').select('id', { count: 'exact', head: true }).eq('post_id', p.id),
        user?.id
          ? supabase
              .from('likes')
              .select('id')
              .eq('post_id', p.id)
              .eq('user_id', user.id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from('comments')
          .select(
            `
            id,
            post_id,
            user_id,
            text,
            created_at,
            profiles:profiles(id, username, avatar_url)
          `
          )
          .eq('post_id', p.id)
          .order('created_at', { ascending: true })
      ])

      const likesCount = likesCountRes?.count || 0
      const iLiked = !!iLikedRes?.data
      const comments = commentsRes?.data || []

      setPosts((prev) =>
        prev.map((x) =>
          x.id === postIdToRefresh ? { ...x, likes_count: likesCount, i_liked: iLiked, comments } : x
        )
      )
    } catch (e) {
      console.error('refreshOnePost error:', e)
    }
  }

  async function handleToggleLike(p) {
    if (!user?.id || !p?.id) return
    if (likingByPost[p.id]) return

    const nextLiked = !p.i_liked

    // Optimistic UI — update before network call
    setPosts((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? {
              ...x,
              i_liked: nextLiked,
              likes_count: Math.max(0, (x.likes_count || 0) + (nextLiked ? 1 : -1))
            }
          : x
      )
    )
    setLikingByPost((m) => ({ ...m, [p.id]: true }))

    try {
      if (nextLiked) {
        const { error } = await supabase.from('likes').insert({
          post_id: p.id,
          user_id: user.id
        })
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', p.id)
          .eq('user_id', user.id)
        if (error) throw error
      }
    } catch (e) {
      console.error('like error:', e)
      // Rollback on failure
      setPosts((prev) =>
        prev.map((x) =>
          x.id === p.id
            ? { ...x, i_liked: p.i_liked, likes_count: p.likes_count }
            : x
        )
      )
    } finally {
      setLikingByPost((m) => ({ ...m, [p.id]: false }))
    }
  }

  async function handleSendComment(p) {
    if (!user?.id || !p?.id) return
    const text = (commentTextByPost[p.id] || '').trim()
    if (!text) return
    if (sendingCommentByPost[p.id]) return

    setSendingCommentByPost((m) => ({ ...m, [p.id]: true }))

    try {
      const { error } = await supabase.from('comments').insert({
        post_id: p.id,
        user_id: user.id,
        text
      })
      if (error) throw error

      setCommentTextByPost((m) => ({ ...m, [p.id]: '' }))
      await refreshOnePost(p.id)
    } catch (e) {
      console.error('add comment error:', e)
    } finally {
      setSendingCommentByPost((m) => ({ ...m, [p.id]: false }))
    }
  }

  async function handleDeleteComment(postIdForComment, commentId) {
    if (!user?.id) return
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id)

      if (error) throw error
      await refreshOnePost(postIdForComment)
    } catch (e) {
      console.error('delete comment error:', e)
    }
  }

  async function handleDeletePost(p) {
    if (!user?.id || !p?.id) return
    if (user.id !== p.user_id) return
    if (deletingByPost[p.id]) return

    setDeletingByPost((m) => ({ ...m, [p.id]: true }))
    setDeleteErrorByPost((m) => ({ ...m, [p.id]: null }))
    setConfirmDeleteId(null)

    try {
      const success = await deletePost(p.id, user.id)
      if (!success) {
        setDeleteErrorByPost((m) => ({ ...m, [p.id]: 'Impossible de supprimer ce post' }))
        return
      }
      setPosts((prev) => {
        const next = prev.filter((x) => x.id !== p.id)
        if (next.length === 0) {
          redirectingAfterDeleteRef.current = true
          router.push(`/?tab=profile&u=${encodeURIComponent(ownerId || p.user_id)}`)
        }
        return next
      })
    } catch (e) {
      console.error('delete post error:', e)
      setDeleteErrorByPost((m) => ({ ...m, [p.id]: 'Impossible de supprimer ce post' }))
    } finally {
      setDeletingByPost((m) => ({ ...m, [p.id]: false }))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-gray-400">Chargement…</div>
      </div>
    )
  }

  if ((error || !posts.length) && !redirectingAfterDeleteRef.current) {
    return (
      <div className="min-h-screen bg-black p-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={handleBack} className="p-2 rounded-lg hover:bg-street-900 text-white">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-white font-bold">Publications</h1>
        </div>

        <div className="text-red-400">{error || 'Aucune publication'}</div>
      </div>
    )
  }

  const headerUser = posts[0]?.profiles?.username || 'StreetConnect'

  return (
    <div className="h-screen bg-street-900 flex flex-col">
      {/* TOP BAR */}
      <div className="sticky top-0 z-20 bg-street-900/95 backdrop-blur">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={handleBack} className="p-2 rounded-lg hover:bg-street-900 text-white">
              <ArrowLeft size={22} />
            </button>
            <div>
              <div className="text-white font-bold leading-tight">Publications</div>
              <div className="text-gray-400 text-xs">{headerUser}</div>
            </div>
          </div>
        </div>
      </div>

      {/* FEED SCROLL */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-md mx-auto pb-24">
          {posts.map((p) => {
            const isOwner = user?.id && user.id === p.user_id
            const author = p.profiles || {}
            const isExpanded = expandedComments[p.id] ?? (p.id === postId)

            return (
              <div key={p.id} id={`post-${p.id}`} className="scroll-mt-16">
                <div className="bg-street-900 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Image
                        src={author.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'}
                        alt={author.username || 'Anonyme'}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-full border-2 border-street-accent object-cover"
                      />
                      <div>
                        <div className="text-white font-semibold text-sm">
                          {author.username || 'Utilisateur'}
                        </div>
                        <div className="text-xs text-gray-500">{formatTime(p.created_at)}</div>
                      </div>
                    </div>

                    {isOwner && (
                      <div className="relative">
                        {confirmDeleteId === p.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs text-gray-400 hover:text-white px-2 py-1 transition"
                            >
                              Annuler
                            </button>
                            <button
                              onClick={() => handleDeletePost(p)}
                              disabled={!!deletingByPost[p.id]}
                              className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 transition disabled:opacity-50"
                            >
                              {deletingByPost[p.id] ? '…' : 'Confirmer'}
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => setOpenPostMenu(openPostMenu === p.id ? null : p.id)}
                              className="text-gray-400 hover:text-white transition px-2 py-1 text-xl leading-none"
                            >
                              ···
                            </button>
                            {openPostMenu === p.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenPostMenu(null)} />
                                <div className="absolute right-0 top-full mt-1 bg-street-800 border border-street-700 rounded-lg shadow-lg z-20 min-w-[130px]">
                                  <button
                                    onClick={() => { setOpenPostMenu(null); setConfirmDeleteId(p.id) }}
                                    className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-street-700 rounded-lg transition"
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {deleteErrorByPost[p.id] && (
                    <div className="px-4 py-1 text-red-400 text-xs bg-black">{deleteErrorByPost[p.id]}</div>
                  )}

                  <div>
                    {p.type === 'VIDEO' && p.media_url ? (
                      <div className="relative w-full aspect-[4/5] bg-black flex items-center justify-center">
                        <video src={p.media_url} controls className="w-full h-full object-cover" />
                      </div>
                    ) : p.type === 'IMAGE' && (p.images?.length > 0 || p.media_url) ? (
                      <div className="relative w-full aspect-[4/5] overflow-hidden bg-black">
                        <div
                          className="flex w-full h-full overflow-x-auto snap-x snap-mandatory"
                          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                          onScroll={(e) => {
                            const idx = Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth)
                            setPostImageIndexes(prev => ({ ...prev, [p.id]: idx }))
                          }}
                        >
                          {(p.images?.length > 0 ? p.images : [p.media_url]).map((img, i) => (
                            <img key={i} src={img} alt="Post" className="w-full h-full object-contain flex-shrink-0 snap-center" />
                          ))}
                        </div>
                        {p.images?.length > 1 && (
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
                            {p.images.map((_, i) => (
                              <div
                                key={i}
                                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                                  i === (postImageIndexes[p.id] || 0) ? 'bg-white' : 'bg-white/40'
                                }`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ) : !p.media_url ? (
                      <div className="bg-gradient-to-br from-street-700 to-street-900 min-h-[140px] flex items-center px-6 py-8">
                        <p className="text-white text-lg font-semibold leading-relaxed break-words">
                          {expandedCaptions[p.id] || (p.caption || '').length <= 120
                            ? p.caption
                            : p.caption.slice(0, 120) + '…'}
                          {!expandedCaptions[p.id] && (p.caption || '').length > 120 && (
                            <button
                              onClick={() => setExpandedCaptions(prev => ({ ...prev, [p.id]: true }))}
                              className="ml-1 text-gray-300 hover:text-white font-normal text-base transition"
                            >
                              voir plus
                            </button>
                          )}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                      <button
                        onClick={() => handleToggleLike(p)}
                        disabled={!user?.id || !!likingByPost[p.id]}
                        className={`flex items-center gap-2 ${
                          p.i_liked ? 'text-red-400' : 'text-white'
                        } disabled:opacity-50`}
                      >
                        <Heart size={22} fill={p.i_liked ? 'currentColor' : 'none'} />
                        <span className="text-sm text-gray-300">{p.likes_count || 0}</span>
                      </button>

                      <button
                        onClick={() => setExpandedComments(prev => ({ ...prev, [p.id]: !(prev[p.id] ?? (p.id === postId)) }))}
                        className="flex items-center gap-2 text-gray-400 hover:text-street-accent transition"
                      >
                        <MessageCircle size={22} />
                        <span className="text-sm text-gray-300">{(p.comments || []).length}</span>
                      </button>
                    </div>
                  </div>

                  {p.media_url && p.caption ? (
                    <div className="px-4 pb-3 text-gray-200 text-sm break-words">
                      <span className="font-semibold text-white">{author.username || 'User'}</span>{' '}
                      {expandedCaptions[p.id] || p.caption.length <= 80
                        ? p.caption
                        : p.caption.slice(0, 80) + '…'}
                      {!expandedCaptions[p.id] && p.caption.length > 80 && (
                        <button
                          onClick={() => setExpandedCaptions(prev => ({ ...prev, [p.id]: true }))}
                          className="ml-1 text-gray-400 hover:text-white transition"
                        >
                          voir plus
                        </button>
                      )}
                    </div>
                  ) : null}

                  {isExpanded && <div className="px-4 pb-3 space-y-2">
                    {(p.comments || []).map((c) => {
                      const canDelete = user?.id && user.id === c.user_id
                      return (
                        <div key={c.id} className="flex items-start justify-between gap-3">
                          <div className="text-sm text-gray-200">
                            <span className="font-semibold text-white">
                              {c.profiles?.username || 'User'}
                            </span>{' '}
                            {c.text}
                          </div>

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteComment(p.id, c.id)}
                              className="text-xs text-gray-500 hover:text-red-400"
                              title="Supprimer"
                            >
                              Suppr
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>}

                  {isExpanded && <div className="px-4 py-3 border-t border-street-800 bg-black">
                    <div className="flex items-center gap-2 bg-street-950 border border-street-800 rounded-2xl px-3 py-2">
                      <input
                        value={commentTextByPost[p.id] || ''}
                        onChange={(e) =>
                          setCommentTextByPost((m) => ({ ...m, [p.id]: e.target.value }))
                        }
                        placeholder={user?.id ? 'Ajouter un commentaire…' : 'Connecte-toi pour commenter'}
                        disabled={!user?.id || !!sendingCommentByPost[p.id]}
                        className="flex-1 bg-transparent outline-none text-white text-sm placeholder:text-gray-500 disabled:opacity-60"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSendComment(p)
                        }}
                      />

                      <button
                        onClick={() => handleSendComment(p)}
                        disabled={
                          !user?.id ||
                          !!sendingCommentByPost[p.id] ||
                          !(commentTextByPost[p.id] || '').trim()
                        }
                        className="p-2 rounded-xl hover:bg-street-900 text-white disabled:opacity-50"
                        title="Envoyer"
                      >
                        <Send size={18} />
                      </button>
                    </div>
                  </div>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}