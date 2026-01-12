import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { X, Image as ImageIcon } from 'lucide-react'
import {
  getPosts,
  createPost,
  uploadPostMedia,
  likePost,
  unlikePost,
  getComments,
  addComment,
  deletePost,
  deleteComment,
  followUser,
  unfollowUser,
  isFollowing
} from '../lib/supabase'

export default function Feed({ onUserClick }) {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // États pour nouveau post
  const [newPostCaption, setNewPostCaption] = useState('')
  const [newPostMedia, setNewPostMedia] = useState(null)
  const [posting, setPosting] = useState(false)

  // Modal composer (mobile uniquement)
  const [showComposerModal, setShowComposerModal] = useState(false)

  // Ref pour input file
  const fileInputRef = useRef(null)

  // États pour commentaires
  const [expandedComments, setExpandedComments] = useState({})
  const [comments, setComments] = useState({})
  const [newComment, setNewComment] = useState({})

  // États pour Follow
  const [followingStatus, setFollowingStatus] = useState({})

  // Charger les posts au montage / changement user
  useEffect(() => {
    loadPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Vérifier le statut follow pour chaque post (plus rapide + safe)
  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!user || posts.length === 0) return

      try {
        const uniqueUserIds = Array.from(
          new Set(posts.map(p => p.user_id).filter(uid => uid && uid !== user.id))
        )

        const results = await Promise.all(
          uniqueUserIds.map(async (uid) => {
            const ok = await isFollowing(user.id, uid)
            return [uid, ok]
          })
        )

        if (!cancelled) {
          const status = Object.fromEntries(results)
          setFollowingStatus(status)
        }
      } catch (e) {
        // pas bloquant
        console.error('Erreur check follow status:', e)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [user, posts])

  async function loadPosts() {
    try {
      setLoading(true)
      setError(null)
      const data = await getPosts(null, user?.id || null)
      setPosts(data || [])
    } catch (err) {
      console.error('Erreur chargement posts:', err)
      setError('Impossible de charger les posts')
    } finally {
      setLoading(false)
    }
  }

  async function handleFollow(userId) {
    if (!user) return

    const isCurrentlyFollowing = !!followingStatus[userId]
    const success = isCurrentlyFollowing
      ? await unfollowUser(userId, user.id)
      : await followUser(userId, user.id)

    if (success) {
      setFollowingStatus(prev => ({
        ...prev,
        [userId]: !isCurrentlyFollowing
      }))
    }
  }

  // Créer un post
  async function handleCreatePost(e) {
    e.preventDefault()

    if (!user || (!newPostCaption.trim() && !newPostMedia)) {
      return
    }

    try {
      setPosting(true)
      setError(null)

      let mediaUrl = null
      let postType = 'TEXT'

      if (newPostMedia) {
        mediaUrl = await uploadPostMedia(newPostMedia, user.id)
        if (!mediaUrl) {
          setError('Erreur upload média')
          return
        }
        postType = newPostMedia.type.startsWith('image/') ? 'IMAGE' : 'VIDEO'
      }

      const postData = {
        user_id: user.id,
        caption: newPostCaption.trim() || null,
        media_url: mediaUrl,
        type: postType
      }

      const newPost = await createPost(postData)

      if (newPost) {
        await loadPosts()
        setNewPostCaption('')
        setNewPostMedia(null)
        setError(null)
        setShowComposerModal(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      } else {
        setError('Erreur création post')
      }
    } catch (err) {
      console.error('Erreur création post:', err)
      setError('Impossible de créer le post')
    } finally {
      setPosting(false)
    }
  }

  async function handleLike(postId, isLiked) {
    if (!user) return

    try {
      const success = isLiked
        ? await unlikePost(postId, user.id)
        : await likePost(postId, user.id)

      if (success) {
        setPosts(prev =>
          prev.map(post => {
            if (post.id === postId) {
              const nextCount = isLiked ? (post.likes_count || 0) - 1 : (post.likes_count || 0) + 1
              return {
                ...post,
                likes_count: Math.max(nextCount, 0),
                user_has_liked: !isLiked
              }
            }
            return post
          })
        )
      }
    } catch (err) {
      console.error('Erreur like/unlike:', err)
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

    if (!isExpanded && !comments[postId]) {
      loadComments(postId)
    }

    setExpandedComments(prev => ({
      ...prev,
      [postId]: !isExpanded
    }))
  }

  async function handleAddComment(postId) {
    if (!user || !newComment[postId]?.trim()) return

    try {
      const commentData = {
        post_id: postId,
        user_id: user.id,
        text: newComment[postId].trim()
      }

      const comment = await addComment(commentData)

      if (comment) {
        setComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), comment]
        }))

        setPosts(prev =>
          prev.map(post => {
            if (post.id === postId) {
              return {
                ...post,
                comments_count: (post.comments_count || 0) + 1
              }
            }
            return post
          })
        )

        setNewComment(prev => ({ ...prev, [postId]: '' }))
      }
    } catch (err) {
      console.error('Erreur ajout commentaire:', err)
    }
  }

  async function handleDeletePost(postId) {
    if (!user) return
    if (!confirm('Supprimer ce post ?')) return

    try {
      const success = await deletePost(postId, user.id)
      if (success) {
        setPosts(prev => prev.filter(post => post.id !== postId))
      } else {
        alert('Impossible de supprimer ce post')
      }
    } catch (err) {
      console.error('Erreur suppression post:', err)
      alert('Erreur lors de la suppression')
    }
  }

  async function handleDeleteComment(commentId, postId, postOwnerId) {
    if (!user) return

    try {
      const success = await deleteComment(commentId, user.id, postOwnerId)

      if (success) {
        setComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
        }))

        setPosts(prev =>
          prev.map(post => {
            if (post.id === postId) {
              return {
                ...post,
                comments_count: Math.max((post.comments_count || 0) - 1, 0)
              }
            }
            return post
          })
        )
      } else {
        alert('Impossible de supprimer ce commentaire')
      }
    } catch (err) {
      console.error('Erreur suppression commentaire:', err)
      alert('Erreur lors de la suppression')
    }
  }

  if (loading && posts.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-white">Chargement...</div>
      </div>
    )
  }

  if (error && posts.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <div className="text-red-500">{error}</div>
        <button
          onClick={loadPosts}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Composer COMPACT mobile (cliquable) */}
      {user && (
        <div className="md:hidden bg-street-800 border border-street-700 rounded-xl shadow-lg p-3 flex items-center space-x-3">
          <img
            src={user.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'}
            alt="Avatar"
            className="w-10 h-10 rounded-full border-2 border-street-accent"
          />
          <div
            onClick={() => setShowComposerModal(true)}
            className="flex-1 bg-street-900 border border-street-700 rounded-full px-4 py-2 text-gray-500 cursor-pointer hover:border-street-accent transition"
          >
            Quoi de neuf ?
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 hover:bg-street-700 rounded-lg transition"
          >
            <ImageIcon size={24} className="text-gray-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={(e) => {
              setNewPostMedia(e.target.files[0])
              setShowComposerModal(true)
            }}
            className="hidden"
          />
        </div>
      )}

      {/* Composer COMPLET desktop (formulaire classique) */}
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
              onChange={(e) => setNewPostMedia(e.target.files[0])}
              className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-street-700 file:text-white hover:file:bg-street-600"
            />

            <button
              type="submit"
              disabled={posting || (!newPostCaption.trim() && !newPostMedia)}
              className="w-full sm:w-auto px-6 py-2 bg-street-accent text-street-900 font-bold rounded-lg hover:bg-street-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {posting ? 'Publication...' : 'Publier'}
            </button>
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}
        </form>
      )}

      {/* MODAL composer mobile */}
      {showComposerModal && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-end md:items-center md:justify-center">
          <div
            className="bg-street-800 rounded-t-2xl md:rounded-2xl w-full md:max-w-lg flex flex-col overflow-hidden relative z-[10000]"
            style={{ maxHeight: 'calc(100vh - 90px)' }}
          >
            <div className="sticky top-0 bg-street-800 border-b border-street-700 p-4 flex items-center justify-between z-10 flex-shrink-0">
              <h3 className="text-lg font-bold text-white">Créer un post</h3>
              <button
                onClick={() => setShowComposerModal(false)}
                className="text-gray-400 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="flex flex-col flex-1 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <textarea
                  value={newPostCaption}
                  onChange={(e) => setNewPostCaption(e.target.value)}
                  placeholder="Quoi de neuf ?"
                  className="w-full p-3 bg-street-900 border border-street-700 text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-street-accent placeholder-gray-500"
                  rows={4}
                  autoFocus
                />

                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setNewPostMedia(e.target.files[0])}
                  className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-street-700 file:text-white hover:file:bg-street-600"
                />

                {newPostMedia && (
                  <div className="text-sm text-gray-400">
                    Fichier: {newPostMedia.name}
                  </div>
                )}

                {error && <div className="text-red-400 text-sm">{error}</div>}
              </div>

              <div
                className="sticky bottom-0 bg-street-800 border-t border-street-700 p-4 flex gap-3 flex-shrink-0"
                style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
              >
                <button
                  type="button"
                  onClick={() => setShowComposerModal(false)}
                  className="flex-1 px-4 py-3 bg-street-700 text-white font-bold rounded-lg hover:bg-street-600 transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={posting || (!newPostCaption.trim() && !newPostMedia)}
                  className="flex-1 px-4 py-3 bg-street-accent text-street-900 font-bold rounded-lg hover:bg-street-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {posting ? 'Publication...' : 'Publier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Liste des posts */}
      {posts.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-street-800 border border-street-700 rounded-xl">
          Aucun post pour le moment
        </div>
      ) : (
        posts.map((post) => (
          <div key={post.id} className="bg-street-800 border border-street-700 rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={post.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'}
                  alt={post.username || 'Anonyme'}
                  onClick={() => onUserClick && onUserClick(post.user_id)}
                  className="w-10 h-10 rounded-full border-2 border-street-accent cursor-pointer hover:opacity-80 transition"
                />
                <div>
                  <div
                    onClick={() => onUserClick && onUserClick(post.user_id)}
                    className="font-semibold text-white cursor-pointer hover:text-street-accent transition"
                  >
                    {post.username || 'Anonyme'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(post.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {/* Bouton Follow (seulement si ce n'est pas mon post) */}
                {user && post.user_id !== user.id && (
                  <button
                    onClick={() => handleFollow(post.user_id)}
                    className={`px-4 py-1 rounded-lg text-sm font-bold transition ${
                      followingStatus[post.user_id]
                        ? 'bg-street-700 text-white hover:bg-street-600'
                        : 'bg-street-accent text-street-900 hover:bg-street-accentHover'
                    }`}
                  >
                    {followingStatus[post.user_id] ? 'Suivi' : 'Suivre'}
                  </button>
                )}

                {/* Bouton supprimer (seulement si c'est mon post) */}
                {user && post.user_id === user.id && (
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-red-400 hover:text-red-300 text-sm font-semibold transition"
                    title="Supprimer ce post"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>

            {/* Media - Non cliquable */}
            <div className="w-full">
              {post.media_url && (
                post.type === 'IMAGE' ? (
                  <img src={post.media_url} alt="Post media" className="w-full h-auto" />
                ) : post.type === 'VIDEO' ? (
                  <video src={post.media_url} controls className="w-full h-auto" />
                ) : null
              )}
            </div>

            {/* Caption */}
            {post.caption && (
              <div className="p-4">
                <p className="text-sm text-gray-300">{post.caption}</p>
              </div>
            )}

            {/* Actions */}
            <div className="px-4 py-3 border-t border-street-700 flex items-center space-x-6">
              <button
                onClick={() => handleLike(post.id, post.user_has_liked)}
                className="flex items-center space-x-2 text-gray-400 hover:text-street-accent transition"
              >
                <span>{post.user_has_liked ? '❤️' : '🤍'}</span>
                <span className="text-sm font-semibold">{post.likes_count || 0}</span>
              </button>

              <button
                onClick={() => toggleComments(post.id)}
                className="flex items-center space-x-2 text-gray-400 hover:text-street-accent transition"
              >
                <span>💬</span>
                <span className="text-sm font-semibold">{post.comments_count || 0}</span>
              </button>
            </div>

            {/* Commentaires */}
            {expandedComments[post.id] && (
              <div className="px-4 pb-4 border-t border-street-700 space-y-3">
                {/* Liste commentaires */}
                <div className="space-y-2 mt-3 max-h-64 overflow-y-auto">
                  {(comments[post.id] || []).map(comment => {
                    const canDelete = user && (comment.user_id === user.id || post.user_id === user.id)

                    return (
                      <div key={comment.id} className="flex space-x-2 text-sm">
                        <img
                          src={comment.profiles?.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'}
                          alt={comment.profiles?.username || 'Anonyme'}
                          className="w-8 h-8 rounded-full border border-street-accent"
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

                {/* Input nouveau commentaire */}
                {user && (
                  <div className="flex flex-col sm:flex-row gap-2">
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
                      className="flex-1 px-3 py-2 bg-street-900 border border-street-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-street-accent placeholder-gray-500"
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      className="w-full sm:w-auto px-4 py-2 bg-street-accent text-street-900 font-bold rounded-lg hover:bg-street-accentHover text-sm transition"
                    >
                      Publier
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}