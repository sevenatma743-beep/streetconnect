import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  getPosts,
  createPost,
  uploadPostMedia,
  likePost,
  unlikePost,
  getComments,
  addComment,
  deletePost,
  deleteComment
} from '../lib/supabase'

export default function Feed() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // États pour nouveau post
  const [newPostCaption, setNewPostCaption] = useState('')
  const [newPostMedia, setNewPostMedia] = useState(null)
  const [posting, setPosting] = useState(false)

  // États pour commentaires
  const [expandedComments, setExpandedComments] = useState({})
  const [comments, setComments] = useState({})
  const [newComment, setNewComment] = useState({})

  // Charger les posts au montage
  useEffect(() => {
    loadPosts()
  }, [user])

  async function loadPosts() {
    try {
      setLoading(true)
      setError(null)
      const data = await getPosts(null, user?.id || null)
      setPosts(data)
    } catch (err) {
      console.error('Erreur chargement posts:', err)
      setError('Impossible de charger les posts')
    } finally {
      setLoading(false)
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
      let postType = 'TEXT' // Par défaut : TEXT

      // Upload média si présent
      if (newPostMedia) {
        mediaUrl = await uploadPostMedia(newPostMedia, user.id)
        if (!mediaUrl) {
          setError('Erreur upload média')
          setPosting(false)
          return
        }
        // Détection du type en MAJUSCULES (comme en DB)
        postType = newPostMedia.type.startsWith('image/') ? 'IMAGE' : 'VIDEO'
      }

      // Créer le post
      const postData = {
        user_id: user.id,
        caption: newPostCaption.trim() || null,
        media_url: mediaUrl,
        type: postType
      }

      const newPost = await createPost(postData)
      
      if (newPost) {
        // Recharger les posts
        await loadPosts()
        
        // Reset form
        setNewPostCaption('')
        setNewPostMedia(null)
        setError(null)
        
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]')
        if (fileInput) fileInput.value = ''
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

  // Liker/unliker un post
  async function handleLike(postId, isLiked) {
    if (!user) return

    try {
      const success = isLiked 
        ? await unlikePost(postId, user.id)
        : await likePost(postId, user.id)

      if (success) {
        // Mise à jour optimiste de l'UI
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              likes_count: isLiked ? post.likes_count - 1 : post.likes_count + 1,
              user_has_liked: !isLiked
            }
          }
          return post
        }))
      }
    } catch (err) {
      console.error('Erreur like/unlike:', err)
    }
  }

  // Charger les commentaires d'un post
  async function loadComments(postId) {
    try {
      const data = await getComments(postId)
      setComments(prev => ({ ...prev, [postId]: data }))
    } catch (err) {
      console.error('Erreur chargement commentaires:', err)
    }
  }

  // Toggle affichage commentaires
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

  // Ajouter un commentaire
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
        // Ajouter le commentaire à la liste locale
        setComments(prev => ({
          ...prev,
          [postId]: [...(prev[postId] || []), comment]
        }))

        // Mettre à jour le compteur
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              comments_count: post.comments_count + 1
            }
          }
          return post
        }))

        // Reset input
        setNewComment(prev => ({ ...prev, [postId]: '' }))
      }
    } catch (err) {
      console.error('Erreur ajout commentaire:', err)
    }
  }

  // Supprimer un post
  async function handleDeletePost(postId) {
    if (!user) return
    
    if (!confirm('Supprimer ce post ?')) return

    try {
      const success = await deletePost(postId, user.id)
      
      if (success) {
        // Retirer le post de la liste
        setPosts(posts.filter(post => post.id !== postId))
      } else {
        alert('Impossible de supprimer ce post')
      }
    } catch (err) {
      console.error('Erreur suppression post:', err)
    }
  }

  // Supprimer un commentaire
  async function handleDeleteComment(commentId, postId, postOwnerId) {
    if (!user) return
    
    if (!confirm('Supprimer ce commentaire ?')) return

    try {
      const success = await deleteComment(commentId, user.id, postOwnerId)
      
      if (success) {
        // Retirer le commentaire de la liste
        setComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).filter(c => c.id !== commentId)
        }))

        // Décrémenter le compteur
        setPosts(posts.map(post => {
          if (post.id === postId) {
            return {
              ...post,
              comments_count: Math.max(post.comments_count - 1, 0)
            }
          }
          return post
        }))
      } else {
        alert('Impossible de supprimer ce commentaire')
      }
    } catch (err) {
      console.error('Erreur suppression commentaire:', err)
    }
  }

  // UI
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Chargement des posts...</div>
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
    <div className="max-w-2xl mx-auto p-4 space-y-6 pb-24">
      {/* Formulaire création post */}
      {user && (
        <form onSubmit={handleCreatePost} className="bg-street-800 border border-street-700 rounded-xl shadow-lg p-4 space-y-3">
          <textarea
            value={newPostCaption}
            onChange={(e) => setNewPostCaption(e.target.value)}
            placeholder="Quoi de neuf ?"
            className="w-full p-3 bg-street-900 border border-street-700 text-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-street-accent placeholder-gray-500"
            rows={3}
          />
          
          <div className="flex items-center justify-between">
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => setNewPostMedia(e.target.files[0])}
              className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-street-700 file:text-white hover:file:bg-street-600"
            />
            
            <button
              type="submit"
              disabled={posting || (!newPostCaption.trim() && !newPostMedia)}
              className="px-6 py-2 bg-street-accent text-street-900 font-bold rounded-lg hover:bg-street-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {posting ? 'Publication...' : 'Publier'}
            </button>
          </div>

          {error && <div className="text-red-400 text-sm">{error}</div>}
        </form>
      )}

      {/* Liste des posts */}
      {posts.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-street-800 border border-street-700 rounded-xl">
          Aucun post pour le moment
        </div>
      ) : (
        posts.map(post => (
          <div key={post.id} className="bg-street-800 border border-street-700 rounded-xl shadow-lg overflow-hidden">
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={post.avatar_url || '/default-avatar.png'}
                  alt={post.username || 'Anonyme'}
                  className="w-10 h-10 rounded-full border-2 border-street-accent"
                />
                <div>
                  <div className="font-semibold text-white">{post.username || 'Anonyme'}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(post.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
              
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

            {/* Media */}
            {post.media_url && (
              <div className="w-full">
                {post.type === 'IMAGE' ? (
                  <img 
                    src={post.media_url} 
                    alt="Post media"
                    className="w-full h-auto"
                  />
                ) : post.type === 'VIDEO' ? (
                  <video 
                    src={post.media_url} 
                    controls
                    className="w-full h-auto"
                  />
                ) : null}
              </div>
            )}

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
                    const canDelete = user && (
                      comment.user_id === user.id || // Mon commentaire
                      post.user_id === user.id // Mon post
                    )
                    
                    return (
                      <div key={comment.id} className="flex space-x-2 text-sm">
                        <img
                          src={comment.profiles?.avatar_url || '/default-avatar.png'}
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
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newComment[post.id] || ''}
                      onChange={(e) => setNewComment(prev => ({
                        ...prev,
                        [post.id]: e.target.value
                      }))}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddComment(post.id)
                        }
                      }}
                      placeholder="Ajouter un commentaire..."
                      className="flex-1 px-3 py-2 bg-street-900 border border-street-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-street-accent placeholder-gray-500"
                    />
                    <button
                      onClick={() => handleAddComment(post.id)}
                      className="px-4 py-2 bg-street-accent text-street-900 font-bold rounded-lg hover:bg-street-accentHover text-sm transition"
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