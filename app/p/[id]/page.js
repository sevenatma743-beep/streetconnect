// app/p/[id]/page.js
'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Heart, MessageCircle, Send, Trash2 } from 'lucide-react'

import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'

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

  const scrollRef = useRef(null)

  useEffect(() => {
    if (!postId) return
    loadFeed()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user?.id])

  // ✅ Retour logique (SPA + bon profil + navbar)
  function handleBack() {
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
          type,
          created_at,
          profiles:profiles(id, username, avatar_url)
        `
        )
        .eq('id', postId)
        .single()

      if (openedErr) throw openedErr

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

    setLikingByPost((m) => ({ ...m, [p.id]: true }))

    try {
      const nextLiked = !p.i_liked

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
    } catch (e) {
      console.error('like error:', e)
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
    const ok = confirm('Supprimer cette publication ?')
    if (!ok) return

    setDeletingByPost((m) => ({ ...m, [p.id]: true }))

    try {
      const { error } = await supabase.from('posts').delete().eq('id', p.id).eq('user_id', user.id)
      if (error) throw error

      setPosts((prev) => prev.filter((x) => x.id !== p.id))
    } catch (e) {
      console.error('delete post error:', e)
      alert('Impossible de supprimer le post')
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

  if (error || !posts.length) {
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
    <div className="min-h-screen bg-black flex flex-col">
      {/* TOP BAR */}
      <div className="sticky top-0 z-20 bg-black/80 backdrop-blur border-b border-street-800">
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
        className="flex-1 overflow-y-auto overscroll-contain snap-y snap-mandatory"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="max-w-md mx-auto px-4 py-4 space-y-8 pb-24">
          {posts.map((p) => {
            const isOwner = user?.id && user.id === p.user_id
            const author = p.profiles || {}

            return (
              <div key={p.id} id={`post-${p.id}`} className="snap-start scroll-mt-16">
                <div className="bg-black border border-street-800 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between border-b border-street-800 bg-black/60">
                    <div className="text-white font-semibold text-sm">
                      {author.username || 'Utilisateur'}
                    </div>

                    {isOwner && (
                      <button
                        onClick={() => handleDeletePost(p)}
                        disabled={!!deletingByPost[p.id]}
                        className="p-2 rounded-lg hover:bg-street-900 text-red-400 disabled:opacity-50"
                        title="Supprimer"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>

                  <div className="bg-street-950">
                    {p.media_url ? (
                      p.type === 'VIDEO' ? (
                        <video src={p.media_url} controls className="w-full h-auto" />
                      ) : (
                        <img src={p.media_url} alt="post" className="w-full h-auto object-cover" />
                      )
                    ) : (
                      <div className="p-4 text-white">{p.caption}</div>
                    )}
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

                      <div className="flex items-center gap-2 text-white">
                        <MessageCircle size={22} />
                        <span className="text-sm text-gray-300">{(p.comments || []).length}</span>
                      </div>
                    </div>
                  </div>

                  {p.caption ? (
                    <div className="px-4 pb-3 text-gray-200 text-sm">
                      <span className="font-semibold text-white">{author.username || 'User'}</span>{' '}
                      {p.caption}
                    </div>
                  ) : null}

                  <div className="px-4 pb-3 space-y-2">
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
                  </div>

                  <div className="px-4 py-3 border-t border-street-800 bg-black">
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
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}