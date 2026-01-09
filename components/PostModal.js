import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { 
  likePost, 
  unlikePost, 
  getComments, 
  addComment, 
  deleteComment,
  deletePost 
} from '../lib/supabase'
import { X, Heart, MessageCircle, Send } from 'lucide-react'
import CommentsModal from './CommentsModal'

export default function PostModal({ posts, initialIndex, onClose, onDelete }) {
  const { user } = useAuth()
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [postsData, setPostsData] = useState(
    posts.map(post => ({
      ...post,
      comments: [],
      loadingComments: false,
      newComment: ''
    }))
  )
  const [showCommentsModal, setShowCommentsModal] = useState(null)

  useEffect(() => {
    loadComments(initialIndex)
  }, [])

  async function loadComments(index) {
    const post = postsData[index]
    if (!post || post.comments.length > 0 || post.loadingComments) return

    setPostsData(prev => prev.map((p, i) => 
      i === index ? { ...p, loadingComments: true } : p
    ))

    const comments = await getComments(post.id)
    
    setPostsData(prev => prev.map((p, i) => 
      i === index ? { ...p, comments, loadingComments: false } : p
    ))
  }

  async function handleLike(index) {
    if (!user) return
    
    const post = postsData[index]
    const success = post.user_has_liked
      ? await unlikePost(post.id, user.id)
      : await likePost(post.id, user.id)
    
    if (success) {
      setPostsData(prev => prev.map((p, i) => 
        i === index ? {
          ...p,
          likes_count: p.user_has_liked ? p.likes_count - 1 : p.likes_count + 1,
          user_has_liked: !p.user_has_liked
        } : p
      ))
    }
  }

  async function handleAddComment(index) {
    if (!user) return
    
    const post = postsData[index]
    if (!post.newComment.trim()) return
    
    const commentData = {
      post_id: post.id,
      user_id: user.id,
      text: post.newComment.trim()
    }
    
    const comment = await addComment(commentData)
    if (comment) {
      setPostsData(prev => prev.map((p, i) => 
        i === index ? {
          ...p,
          comments: [...p.comments, comment],
          comments_count: p.comments_count + 1,
          newComment: ''
        } : p
      ))
    }
  }

  function handleCommentAdded(comment) {
    setPostsData(prev => prev.map((p, i) => 
      i === currentIndex ? {
        ...p,
        comments: [...p.comments, comment],
        comments_count: p.comments_count + 1
      } : p
    ))
  }

  async function handleDeleteComment(postIndex, commentId) {
    if (!confirm('Supprimer ce commentaire ?')) return
    
    const post = postsData[postIndex]
    const success = await deleteComment(commentId, user.id, post.user_id)
    
    if (success) {
      setPostsData(prev => prev.map((p, i) => 
        i === postIndex ? {
          ...p,
          comments: p.comments.filter(c => c.id !== commentId),
          comments_count: Math.max(p.comments_count - 1, 0)
        } : p
      ))
    }
  }

  function handleCommentDeleted(commentId) {
    setPostsData(prev => prev.map((p, i) => 
      i === currentIndex ? {
        ...p,
        comments: p.comments.filter(c => c.id !== commentId),
        comments_count: Math.max(p.comments_count - 1, 0)
      } : p
    ))
  }

  async function handleDeletePost(index) {
    if (!confirm('Supprimer ce post ?')) return
    
    const post = postsData[index]
    const success = await deletePost(post.id, user.id)
    
    if (success) {
      onDelete(post.id)
      onClose()
    }
  }

  function updateNewComment(index, value) {
    setPostsData(prev => prev.map((p, i) => 
      i === index ? { ...p, newComment: value } : p
    ))
  }

  function handleScroll(e) {
    const container = e.target
    const scrollPosition = container.scrollTop
    const itemHeight = container.clientHeight
    const newIndex = Math.round(scrollPosition / itemHeight)
    
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < postsData.length) {
      setCurrentIndex(newIndex)
      loadComments(newIndex)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black z-50"
      onClick={onClose}
    >
      {/* Bouton fermer */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-75 transition"
      >
        <X size={24} />
      </button>

      {/* Compteur */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded-full">
        {currentIndex + 1} / {postsData.length}
      </div>

      {/* Container avec scroll vertical */}
      <div 
        className="w-full h-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollBehavior: 'smooth' }}
        onScroll={handleScroll}
        onClick={(e) => e.stopPropagation()}
      >
        {postsData.map((post, index) => {
          const previewComments = post.comments.slice(0, 2)
          const hasMoreComments = post.comments.length > 2
          
          return (
            <div 
              key={post.id} 
              className="h-screen w-full snap-start flex items-center justify-center"
            >
              {/* Post Card */}
              <div 
                className="bg-street-900 rounded-xl w-full max-h-[95vh] overflow-hidden flex flex-col mx-4"
                style={{ maxWidth: '640px' }}
              >
                
                {/* Header */}
                <div className="p-4 border-b border-street-700 flex items-center justify-between bg-street-800 flex-shrink-0">
                  <div className="flex items-center space-x-3">
                    <img
                      src={post.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'}
                      alt={post.username}
                      className="w-10 h-10 rounded-full border-2 border-street-accent"
                    />
                    <div>
                      <div className="font-semibold text-white">{post.username}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(post.created_at).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                  </div>
                  
                  {user && post.user_id === user.id && (
                    <button
                      onClick={() => handleDeletePost(index)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      🗑️
                    </button>
                  )}
                </div>

                {/* Média */}
                <div className="bg-black flex items-center justify-center max-h-[50vh] flex-shrink-0">
                  {post.media_url ? (
                    post.type === 'IMAGE' ? (
                      <img 
                        src={post.media_url} 
                        alt="Post" 
                        className="w-full h-auto max-h-[50vh] object-contain"
                      />
                    ) : post.type === 'VIDEO' ? (
                      <video 
                        src={post.media_url} 
                        controls 
                        className="w-full h-auto max-h-[50vh]"
                      />
                    ) : null
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-white text-lg">{post.caption}</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="p-4 border-b border-street-700 space-y-3 bg-street-800 flex-shrink-0">
                  <div className="flex items-center space-x-6">
                    <button
                      onClick={() => handleLike(index)}
                      className="flex items-center space-x-2 text-gray-400 hover:text-red-500 transition"
                    >
                      {post.user_has_liked ? (
                        <Heart size={24} fill="currentColor" className="text-red-500" />
                      ) : (
                        <Heart size={24} />
                      )}
                      <span className="text-sm font-semibold">{post.likes_count || 0}</span>
                    </button>
                    
                    <button
                      onClick={() => setShowCommentsModal(index)}
                      className="flex items-center space-x-2 text-gray-400 hover:text-street-accent transition"
                    >
                      <MessageCircle size={24} />
                      <span className="text-sm font-semibold">{post.comments_count || 0}</span>
                    </button>
                  </div>

                  {/* Caption */}
                  {post.caption && (
                    <div>
                      <span className="font-semibold text-white mr-2">{post.username}</span>
                      <span className="text-gray-300 text-sm">{post.caption}</span>
                    </div>
                  )}
                </div>

                {/* Preview Commentaires (2 premiers) - SCROLLABLE */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-street-900 min-h-0">
                  {post.loadingComments ? (
                    <div className="text-center text-gray-500">Chargement...</div>
                  ) : (
                    <>
                      {previewComments.map(comment => {
                        const canDelete = user && (
                          comment.user_id === user.id || 
                          post.user_id === user.id
                        )
                        
                        return (
                          <div key={comment.id} className="flex space-x-3">
                            <img
                              src={comment.profiles?.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'}
                              alt={comment.profiles?.username}
                              className="w-8 h-8 rounded-full border border-street-accent flex-shrink-0"
                            />
                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="font-semibold text-white text-sm mr-2">
                                    {comment.profiles?.username}
                                  </span>
                                  <span className="text-gray-300 text-sm">{comment.text}</span>
                                </div>
                                {canDelete && (
                                  <button
                                    onClick={() => handleDeleteComment(index, comment.id)}
                                    className="text-red-400 hover:text-red-300 text-xs ml-2"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}

                      {/* Bouton "Voir tous les commentaires" */}
                      {hasMoreComments && (
                        <button
                          onClick={() => setShowCommentsModal(index)}
                          className="text-gray-400 hover:text-gray-300 text-sm font-semibold transition"
                        >
                          Voir tous les {post.comments_count} commentaires
                        </button>
                      )}

                      {post.comments.length === 0 && (
                        <div className="text-center text-gray-500 text-sm py-4">
                          Aucun commentaire
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Input commentaire - STICKY FOOTER avec safe-area */}
                {user && (
                  <div 
                    className="sticky bottom-0 p-4 border-t border-street-700 bg-street-800 flex-shrink-0"
                    style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
                  >
                    <div className="flex space-x-2 items-center">
                      <input
                        type="text"
                        value={post.newComment}
                        onChange={(e) => updateNewComment(index, e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddComment(index)}
                        placeholder="Ajouter un commentaire..."
                        className="flex-1 px-4 py-2 bg-street-900 border border-street-700 text-white rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-street-accent"
                      />
                      <button
                        onClick={() => handleAddComment(index)}
                        className="p-2 bg-street-accent text-street-900 rounded-full hover:bg-street-accentHover transition flex-shrink-0"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal Commentaires */}
      {showCommentsModal !== null && (
        <CommentsModal
          post={postsData[showCommentsModal]}
          comments={postsData[showCommentsModal].comments}
          onClose={() => setShowCommentsModal(null)}
          onCommentAdded={handleCommentAdded}
          onCommentDeleted={handleCommentDeleted}
        />
      )}
    </div>
  )
}