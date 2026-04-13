'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { useAuth } from '../contexts/AuthContext'
import { X, Image as ImageIcon, Heart, MessageCircle, Send } from 'lucide-react'
import {
  supabase,
  createPost,
  uploadPostMedia,
  uploadPostImages,
  likePost,
  unlikePost,
  getComments,
  addComment,
  deletePost,
  deleteComment,
  followUser,
  unfollowUser
} from '../lib/supabase'

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

export default function Feed({ onUserClick, feed, externalOpenComposer, onComposerOpened, externalFile, onExternalFileHandled }) {
  const { user } = useAuth()

  const posts = feed?.posts || []
  const loading = !!feed?.isLoading
  const error = feed?.error || null
  const mutate = feed?.mutate
  const loadMore = feed?.loadMore
  const hasMore = !!feed?.hasMore
  const isLoadingMore = !!feed?.isLoadingMore

  // États pour nouveau post
  const [newPostCaption, setNewPostCaption] = useState('')
  const [newPostMedia, setNewPostMedia] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [posting, setPosting] = useState(false)

  // Modal composer (mobile uniquement)
  const [showComposerModal, setShowComposerModal] = useState(false)
  const [composerStep, setComposerStep] = useState('media')

  // Ref pour input file dans la modal (changer de fichier depuis l'étape média)
  const modalFileInputRef = useRef(null)

  // Ref pour input "ajouter une image" (mobile — itératif)
  const addImageInputRef = useRef(null)

  // Sélection multi-images (mobile composer)
  const [selectedImages, setSelectedImages] = useState([])
  const [imagePreviews, setImagePreviews] = useState([])

  // Signal externe — reset uniquement, pas d'ouverture sans fichier (média obligatoire)
  useEffect(() => {
    if (!externalOpenComposer) return
    onComposerOpened?.()
  }, [externalOpenComposer])

  // Fichiers sélectionnés depuis le bouton + (Layout) — geste synchrone iOS-safe
  useEffect(() => {
    if (!externalFile || !externalFile.length) return
    const files = externalFile
    const video = files.find(f => f.type.startsWith('video/'))
    if (video) {
      setMediaWithPreview(video)
    } else {
      files.forEach(f => addImageToSelection(f))
    }
    setComposerStep('media')
    setShowComposerModal(true)
    onExternalFileHandled?.()
  }, [externalFile])

  function setMediaWithPreview(file) {
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setNewPostMedia(file)
    if (file) setPreviewUrl(URL.createObjectURL(file))
  }

  function addImageToSelection(file) {
    setSelectedImages(prev => {
      if (prev.length >= 5) return prev
      return [...prev, file]
    })
    setImagePreviews(prev => {
      if (prev.length >= 5) return prev
      return [...prev, URL.createObjectURL(file)]
    })
  }

  function removeImage(idx) {
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
    setSelectedImages(prev => prev.filter((_, i) => i !== idx))
  }

  function resetComposer() {
    setImagePreviews(prev => { prev.forEach(url => URL.revokeObjectURL(url)); return [] })
    setSelectedImages([])
    setPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null })
    setNewPostMedia(null)
    setNewPostCaption('')
    setShowComposerModal(false)
    setComposerStep('media')
    if (modalFileInputRef.current) modalFileInputRef.current.value = ''
    if (addImageInputRef.current) addImageInputRef.current.value = ''
  }

  // États pour commentaires
  const [expandedComments, setExpandedComments] = useState({})
  const [comments, setComments] = useState({})
  const [newComment, setNewComment] = useState({})
  const [submittingComment, setSubmittingComment] = useState({})

  // Erreur locale (create post)
  const [localError, setLocalError] = useState(null)

  // Erreurs inline par post (suppression post / commentaire)
  const [postErrors, setPostErrors] = useState({})

  // Légendes dépliées
  const [expandedCaptions, setExpandedCaptions] = useState({})

  // Index image actif par post (carrousel)
  const [postImageIndexes, setPostImageIndexes] = useState({})

  // Menu ... ouvert (postId | null)
  const [openPostMenu, setOpenPostMenu] = useState(null)

  // Confirmation suppression inline (postId | null)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  // Sentinel scroll infini
  const sentinelRef = useRef(null)

  useEffect(() => {
    if (!hasMore || isLoadingMore) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isLoadingMore, loadMore])

  // Realtime likes
  useEffect(() => {
    if (!user || !mutate) return

    const channel = supabase
      .channel('feed-posts-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'posts' },
        (payload) => {
          const { id, likes_count, comments_count } = payload.new || {}
          if (!id) return
          mutate(
            (prev) => (prev || []).map((page) =>
              page.map((p) => p.id !== id ? p : { ...p, likes_count, comments_count })
            ),
            { revalidate: false }
          )
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'posts' },
        (payload) => {
          // Ignorer les propres posts (déjà gérés par safeRevalidate dans handleCreatePost)
          if (payload.new?.user_id === user?.id) return
          safeRevalidate()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'posts' },
        (payload) => {
          const deletedId = payload.old?.id
          if (!deletedId) return
          mutate(
            (prev) => (prev || []).map((page) => page.filter((p) => p.id !== deletedId)),
            { revalidate: false }
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, mutate])

  // Realtime comments — un channel par post ouvert, re-fetch complet à chaque INSERT
  useEffect(() => {
    if (!user) return

    const expandedPostIds = Object.keys(expandedComments).filter(id => expandedComments[id])
    if (expandedPostIds.length === 0) return

    const channels = expandedPostIds.map(postId =>
      supabase
        .channel(`comments-${postId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
          () => { loadComments(postId) }
        )
        .subscribe()
    )

    return () => { channels.forEach(ch => supabase.removeChannel(ch)) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, expandedComments])

  async function safeRevalidate() {
    try {
      if (mutate) await mutate()
    } catch (e) {
      // pas bloquant
      console.error('Revalidate error:', e)
    }
  }

  async function handleFollow(postUserId, isCurrentlyFollowing) {
    if (!user) return

    // Optimistic update (UI instant)
    if (mutate) {
      mutate(
        (prev) =>
          (prev || []).map((page) =>
            page.map((p) =>
              p.user_id === postUserId ? { ...p, is_following_author: !isCurrentlyFollowing } : p
            )
          ),
        { revalidate: false }
      )
    }

    const success = isCurrentlyFollowing
      ? await unfollowUser(postUserId, user.id)
      : await followUser(postUserId, user.id)

    if (!success) {
      // rollback
      if (mutate) {
        mutate(
          (prev) =>
            (prev || []).map((page) =>
              page.map((p) =>
                p.user_id === postUserId ? { ...p, is_following_author: isCurrentlyFollowing } : p
              )
            ),
          { revalidate: false }
        )
      }
    } else {
      // revalidate propre (source de vérité)
      safeRevalidate()
    }
  }

  async function handleCreatePost(e) {
    e.preventDefault()
    const hasImages = selectedImages.length > 0
    const hasSingleMedia = !!newPostMedia && !hasImages
    if (!user || (!newPostCaption.trim() && !hasImages && !hasSingleMedia)) return

    try {
      setPosting(true)
      setLocalError(null)

      let mediaUrl = null
      let postType = 'TEXT'
      let imagesUrls = null

      if (hasImages) {
        const urls = await uploadPostImages(selectedImages, user.id)
        if (!urls) {
          setLocalError('Erreur upload images')
          return
        }
        imagesUrls = urls
        mediaUrl = urls[0]
        postType = 'IMAGE'
      } else if (hasSingleMedia) {
        mediaUrl = await uploadPostMedia(newPostMedia, user.id)
        if (!mediaUrl) {
          setLocalError('Erreur upload média')
          return
        }
        postType = newPostMedia.type.startsWith('image/') ? 'IMAGE' : 'VIDEO'
      }

      const postData = {
        user_id: user.id,
        caption: newPostCaption.trim() || null,
        media_url: mediaUrl,
        type: postType,
        ...(imagesUrls ? { images: imagesUrls } : {})
      }

      const created = await createPost(postData)
      if (!created) {
        setLocalError('Erreur création post')
        return
      }

      resetComposer()
      await safeRevalidate()
    } catch (err) {
      console.error('Erreur création post:', err)
      setLocalError('Impossible de créer le post')
    } finally {
      setPosting(false)
    }
  }

  async function handleLike(postId, isLiked) {
    if (!user) return

    // optimistic update
    if (mutate) {
      mutate(
        (prev) =>
          (prev || []).map((page) =>
            page.map((p) => {
              if (p.id !== postId) return p
              const current = p.likes_count || 0
              const nextCount = isLiked ? current - 1 : current + 1
              return {
                ...p,
                likes_count: Math.max(nextCount, 0),
                user_has_liked: !isLiked
              }
            })
          ),
        { revalidate: false }
      )
    }

    try {
      const success = isLiked
        ? await unlikePost(postId, user.id)
        : await likePost(postId, user.id)

      if (!success) {
        // rollback via revalidate
        await safeRevalidate()
      }
    } catch (err) {
      console.error('Erreur like/unlike:', err)
      await safeRevalidate()
    }
  }

  async function loadComments(postId) {
    try {
      const data = await getComments(postId)
      setComments(prev => ({ ...prev, [postId]: data || [] }))
    } catch (err) {
      console.error('Erreur chargement commentaires:', err)
    }
  }

  function toggleComments(postId) {
    const isExpanded = expandedComments[postId]
    if (!isExpanded && !comments[postId]) loadComments(postId)

    setExpandedComments(prev => ({
      ...prev,
      [postId]: !isExpanded
    }))
  }

  async function handleAddComment(postId) {
    if (!user || !newComment[postId]?.trim() || submittingComment[postId]) return

    setSubmittingComment(prev => ({ ...prev, [postId]: true }))
    try {
      const commentData = {
        post_id: postId,
        user_id: user.id,
        text: newComment[postId].trim()
      }

      const comment = await addComment(commentData)
      if (!comment) {
        setPostErrors(prev => ({ ...prev, [postId]: 'Impossible d\'envoyer le commentaire' }))
        return
      }

      setComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), comment]
      }))

      // optimistic comments_count in feed
      if (mutate) {
        mutate(
          (prev) =>
            (prev || []).map((page) =>
              page.map((p) =>
                p.id === postId
                  ? { ...p, comments_count: (p.comments_count || 0) + 1 }
                  : p
              )
            ),
          { revalidate: false }
        )
      }

      setNewComment(prev => ({ ...prev, [postId]: '' }))
      safeRevalidate()
    } catch (err) {
      console.error('Erreur ajout commentaire:', err)
      setPostErrors(prev => ({ ...prev, [postId]: 'Impossible d\'envoyer le commentaire' }))
    } finally {
      setSubmittingComment(prev => ({ ...prev, [postId]: false }))
    }
  }

  async function handleDeletePost(postId) {
    if (!user) return

    // optimistic remove
    if (mutate) {
      mutate((prev) => (prev || []).map((page) => page.filter((p) => p.id !== postId)), { revalidate: false })
    }

    try {
      const success = await deletePost(postId, user.id)
      if (!success) {
        setPostErrors(prev => ({ ...prev, [postId]: 'Impossible de supprimer ce post' }))
        safeRevalidate()
      } else {
        safeRevalidate()
      }
    } catch (err) {
      console.error('Erreur suppression post:', err)
      setPostErrors(prev => ({ ...prev, [postId]: 'Erreur lors de la suppression' }))
      safeRevalidate()
    }
  }

  async function handleDeleteComment(commentId, postId, postOwnerId) {
    if (!user) return

    try {
      const success = await deleteComment(commentId, user.id, postOwnerId)
      if (!success) {
        setPostErrors(prev => ({ ...prev, [postId]: 'Impossible de supprimer ce commentaire' }))
        return
      }

      setComments(prev => ({
        ...prev,
        [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
      }))

      if (mutate) {
        mutate(
          (prev) =>
            (prev || []).map((page) =>
              page.map((p) =>
                p.id === postId
                  ? { ...p, comments_count: Math.max((p.comments_count || 0) - 1, 0) }
                  : p
              )
            ),
          { revalidate: false }
        )
      }

      safeRevalidate()
    } catch (err) {
      console.error('Erreur suppression commentaire:', err)
      setPostErrors(prev => ({ ...prev, [postId]: 'Erreur lors de la suppression' }))
    }
  }

  // UI states
  if (loading && posts.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-street-accent" />
      </div>
    )
  }

  if ((error || localError) && posts.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <div className="text-red-500">{String(error || localError)}</div>
        <button
          onClick={safeRevalidate}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-0">

      {/* Composer COMPLET desktop */}
      {user && (
        <form
          onSubmit={handleCreatePost}
          className="hidden md:block bg-street-800 border border-street-700 rounded-xl shadow-lg p-4 space-y-3"
        >
          <textarea
            value={newPostCaption}
            onChange={(e) => setNewPostCaption(e.target.value)}
            placeholder="Quoi de neuf ?"
            className="w-full p-3 bg-street-900 border border-street-700 text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-street-accent placeholder-gray-500"
            rows={3}
          />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setNewPostMedia(e.target.files?.[0] || null)}
              className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-street-700 file:text-white hover:file:bg-street-600"
            />

            <button
              type="submit"
              disabled={posting || !newPostMedia}
              className="w-full sm:w-auto px-6 py-2 bg-street-accent text-street-900 font-bold rounded-lg hover:bg-street-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {posting ? 'Publication...' : 'Publier'}
            </button>
          </div>

          {(localError || error) && <div className="text-red-400 text-sm">{String(localError || error)}</div>}
        </form>
      )}

      {/* MODAL composer mobile */}
      {showComposerModal && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-end md:items-center md:justify-center">
          <div
            className="bg-street-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg flex flex-col overflow-hidden relative z-[10000]"
            style={{ maxHeight: 'calc(100vh - 16px)' }}
          >
            {/* Header */}
            <div className="sticky top-0 bg-street-800 border-b border-street-700 p-4 flex items-center justify-between z-10 flex-shrink-0">
              <h3 className="text-lg font-bold text-white">
                {composerStep === 'media'
                  ? selectedImages.length > 0 ? `Photos (${selectedImages.length}/5)` : 'Vidéo'
                  : 'Légende'}
              </h3>
              <button onClick={resetComposer} className="text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>

            {/* Étape 1 — Média */}
            {composerStep === 'media' && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">

                  {/* Mode images — grille itérative (max 5) */}
                  {selectedImages.length > 0 && (
                    <>
                      <input
                        ref={addImageInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          Array.from(e.target.files || []).forEach(file => addImageToSelection(file))
                          e.target.value = ''
                        }}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        {imagePreviews.map((url, i) => (
                          <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-street-900">
                            <img src={url} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => removeImage(i)}
                              className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                            >
                              <X size={14} className="text-white" />
                            </button>
                          </div>
                        ))}
                        {selectedImages.length < 5 && (
                          <button
                            type="button"
                            onClick={() => addImageInputRef.current?.click()}
                            className="aspect-square rounded-xl border-2 border-dashed border-street-600 flex items-center justify-center text-gray-500 hover:border-street-accent hover:text-street-accent transition"
                          >
                            <ImageIcon size={24} />
                          </button>
                        )}
                      </div>
                    </>
                  )}

                  {/* Mode vidéo — comportement inchangé */}
                  {newPostMedia && (
                    <>
                      <input
                        ref={modalFileInputRef}
                        id="modal-file-input"
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => setMediaWithPreview(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      {newPostMedia.type.startsWith('video/') && (
                        <video src={previewUrl} controls className="w-full rounded-xl max-h-[65vh]" />
                      )}
                      <label
                        htmlFor="modal-file-input"
                        className="text-sm text-gray-400 hover:text-white underline text-center cursor-pointer"
                      >
                        Changer de fichier
                      </label>
                    </>
                  )}
                </div>

                <div
                  className="sticky bottom-0 bg-street-800 border-t border-street-700 p-4 flex gap-3 flex-shrink-0"
                  style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
                >
                  <button
                    type="button"
                    onClick={resetComposer}
                    className="flex-1 px-4 py-3 bg-street-700 text-white font-bold rounded-lg hover:bg-street-600 transition"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    disabled={selectedImages.length === 0 && !newPostMedia}
                    onClick={() => setComposerStep('caption')}
                    className="flex-1 px-4 py-3 bg-street-accent text-street-900 font-bold rounded-lg hover:bg-street-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Continuer
                  </button>
                </div>
              </div>
            )}

            {/* Étape 2 — Légende */}
            {composerStep === 'caption' && (
              <form onSubmit={handleCreatePost} className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  <div className="bg-street-900 rounded-xl p-2">
                    {selectedImages.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {imagePreviews.map((url, i) => (
                          <img key={i} src={url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        {newPostMedia?.type.startsWith('video/') && (
                          <video src={previewUrl} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                        )}
                        <span className="text-gray-400 text-sm truncate">{newPostMedia?.name}</span>
                      </div>
                    )}
                  </div>
                  <textarea
                    value={newPostCaption}
                    onChange={(e) => setNewPostCaption(e.target.value)}
                    placeholder="Ajouter une légende… (optionnel)"
                    className="w-full p-3 bg-street-900 border border-street-700 text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-street-accent placeholder-gray-500"
                    rows={4}
                    autoFocus
                  />
                  {(localError || error) && (
                    <div className="text-red-400 text-sm">{String(localError || error)}</div>
                  )}
                </div>
                <div
                  className="sticky bottom-0 bg-street-800 border-t border-street-700 p-4 flex gap-3 flex-shrink-0"
                  style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
                >
                  <button
                    type="button"
                    onClick={() => setComposerStep('media')}
                    className="flex-1 px-4 py-3 bg-street-700 text-white font-bold rounded-lg hover:bg-street-600 transition"
                  >
                    Retour
                  </button>
                  <button
                    type="submit"
                    disabled={posting}
                    className="flex-1 px-4 py-3 bg-street-accent text-street-900 font-bold rounded-lg hover:bg-street-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {posting ? 'Publication...' : 'Publier'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Liste des posts */}
      {posts.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-street-800 border border-street-700 rounded-xl">
          Aucun post pour le moment
        </div>
      ) : (
        <>
        {posts.map((post) => (
          <div key={post.id} className="bg-street-900 overflow-hidden">
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Image
                  src={post.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'}
                  alt={post.username || 'Anonyme'}
                  width={40}
                  height={40}
                  onClick={() => onUserClick && onUserClick(post.user_id)}
                  className="w-10 h-10 rounded-full border-2 border-street-accent object-cover cursor-pointer hover:opacity-80 transition"
                />
                <div>
                  <div
                    onClick={() => onUserClick && onUserClick(post.user_id)}
                    className="font-semibold text-white cursor-pointer hover:text-street-accent transition"
                  >
                    {post.username || 'Anonyme'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTime(post.created_at)}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Follow (data vient du feed : is_following_author) */}
                {user && post.user_id !== user.id && (
                  <button
                    onClick={() => handleFollow(post.user_id, !!post.is_following_author)}
                    className={`px-4 py-1 rounded-lg text-sm font-bold transition ${
                      post.is_following_author
                        ? 'bg-street-700 text-white hover:bg-street-600'
                        : 'bg-street-accent text-street-900 hover:bg-street-accentHover'
                    }`}
                  >
                    {post.is_following_author ? 'Suivi' : 'Suivre'}
                  </button>
                )}

                {/* Menu propriétaire */}
                {user && post.user_id === user.id && (
                  <div className="relative">
                    {confirmDeleteId === post.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs text-gray-400 hover:text-white px-2 py-1 transition"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => { setConfirmDeleteId(null); handleDeletePost(post.id) }}
                          className="text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 transition"
                        >
                          Confirmer
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => setOpenPostMenu(openPostMenu === post.id ? null : post.id)}
                          className="text-gray-400 hover:text-white transition px-2 py-1 text-xl leading-none"
                        >
                          ···
                        </button>
                        {openPostMenu === post.id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenPostMenu(null)} />
                            <div className="absolute right-0 top-full mt-1 bg-street-800 border border-street-700 rounded-lg shadow-lg z-20 min-w-[130px]">
                              <button
                                onClick={() => { setOpenPostMenu(null); setConfirmDeleteId(post.id) }}
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
            </div>

            {/* Media */}
            {post.media_url && (
              <div className="w-full">
                {post.type === 'IMAGE' && (
                  <div className="relative w-full aspect-[4/5] overflow-hidden bg-black">
                    <div
                      className="flex w-full h-full overflow-x-auto snap-x snap-mandatory"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                      onScroll={(e) => {
                        const idx = Math.round(e.currentTarget.scrollLeft / e.currentTarget.offsetWidth)
                        setPostImageIndexes(prev => ({ ...prev, [post.id]: idx }))
                      }}
                    >
                      {(post.images?.length > 0 ? post.images : [post.media_url]).map((img, i) => (
                        <img key={i} src={img} alt="Post" className="w-full h-full object-contain flex-shrink-0 snap-center" />
                      ))}
                    </div>
                    {post.images?.length > 1 && (
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 pointer-events-none">
                        {post.images.map((_, i) => (
                          <div
                            key={i}
                            className={`w-1.5 h-1.5 rounded-full transition-colors ${
                              i === (postImageIndexes[post.id] || 0) ? 'bg-white' : 'bg-white/40'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {post.type === 'VIDEO' && (
                  <div className="relative w-full aspect-[4/5] bg-black flex items-center justify-center">
                    <video src={post.media_url} controls className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            )}

            {/* Caption texte-only — avant les actions */}
            {post.caption && !post.media_url && (
              <div className="bg-gradient-to-br from-street-700 to-street-900 min-h-[140px] flex items-center px-6 py-8">
                <p className="text-white text-lg font-semibold leading-relaxed break-words">
                  {expandedCaptions[post.id] || post.caption.length <= 120
                    ? post.caption
                    : post.caption.slice(0, 120) + '…'}
                  {!expandedCaptions[post.id] && post.caption.length > 120 && (
                    <button
                      onClick={() => setExpandedCaptions(prev => ({ ...prev, [post.id]: true }))}
                      className="ml-1 text-gray-300 hover:text-white font-normal text-base transition"
                    >
                      voir plus
                    </button>
                  )}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 flex items-center space-x-6">
              <button
                onClick={() => handleLike(post.id, !!post.user_has_liked)}
                className={`flex items-center space-x-2 transition ${post.user_has_liked ? 'text-red-400' : 'text-gray-400 hover:text-street-accent'}`}
              >
                <Heart size={22} fill={post.user_has_liked ? 'currentColor' : 'none'} />
                <span className="text-sm font-semibold">{post.likes_count || 0}</span>
              </button>

              <button
                onClick={() => toggleComments(post.id)}
                className="flex items-center space-x-2 text-gray-400 hover:text-street-accent transition"
              >
                <MessageCircle size={22} />
                <span className="text-sm font-semibold">{post.comments_count || 0}</span>
              </button>
            </div>

            {/* Caption avec média — après les actions */}
            {post.caption && post.media_url && (
              <div className="px-4 pt-1 pb-3">
                <p className="text-sm text-gray-300 break-words">
                  <span
                    onClick={() => onUserClick && onUserClick(post.user_id)}
                    className="font-semibold text-white mr-1 cursor-pointer hover:text-street-accent transition"
                  >
                    {post.username || 'Anonyme'}
                  </span>
                  {expandedCaptions[post.id] || post.caption.length <= 80
                    ? post.caption
                    : post.caption.slice(0, 80) + '…'}
                  {!expandedCaptions[post.id] && post.caption.length > 80 && (
                    <button
                      onClick={() => setExpandedCaptions(prev => ({ ...prev, [post.id]: true }))}
                      className="ml-1 text-gray-400 hover:text-white transition"
                    >
                      voir plus
                    </button>
                  )}
                </p>
              </div>
            )}

            {postErrors[post.id] && (
              <p className="px-4 pb-2 text-red-400 text-xs">{postErrors[post.id]}</p>
            )}

            {/* Commentaires */}
            {expandedComments[post.id] && (
              <div className="px-4 pb-4 space-y-3">
                <div className="space-y-2 mt-3 max-h-64 overflow-y-auto">
                  {(comments[post.id] || []).map(comment => {
                    const canDelete = user && (comment.user_id === user.id || post.user_id === user.id)

                    return (
                      <div key={comment.id} className="flex space-x-2 text-sm">
                        <Image
                          src={comment.profiles?.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'}
                          alt={comment.profiles?.username || 'Anonyme'}
                          width={32}
                          height={32}
                          className="w-8 h-8 rounded-full border border-street-accent object-cover"
                        />
                        <div className="flex-1 bg-street-900 border border-street-700 rounded-lg p-2">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-xs text-street-accent">
                              {comment.profiles?.username || 'Anonyme'}
                            </div>
                            {canDelete && (
                              <button
                                onClick={() => handleDeleteComment(comment.id, post.id, post.user_id)}
                                className="text-red-400 hover:text-red-300 text-xs transition"
                                title="Supprimer ce commentaire"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                          <div className="text-gray-300">{comment.text}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {user && (
                  <div className="flex items-center gap-2 bg-street-900 border border-street-700 rounded-2xl px-3 py-2">
                    <input
                      type="text"
                      value={newComment[post.id] || ''}
                      onChange={(e) =>
                        setNewComment(prev => ({
                          ...prev,
                          [post.id]: e.target.value
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAddComment(post.id)
                        }
                      }}
                      placeholder="Ajouter un commentaire..."
                      className="flex-1 bg-transparent outline-none text-white text-sm placeholder-gray-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddComment(post.id)}
                      disabled={!!submittingComment[post.id] || !(newComment[post.id] || '').trim()}
                      className="p-1 text-street-accent hover:text-street-accentHover transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submittingComment[post.id] ? <span className="text-xs text-gray-400">…</span> : <Send size={18} />}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={sentinelRef} className="flex justify-center py-6 h-16">
          {isLoadingMore && (
            <div className="w-5 h-5 rounded-full border-2 border-street-700 border-t-street-accent animate-spin" />
          )}
        </div>
        </>
      )}
    </div>
  )
}