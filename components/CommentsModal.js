import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { addComment, deleteComment } from '../lib/supabase'
import { X, Send } from 'lucide-react'

export default function CommentsModal({ post, comments, onClose, onCommentAdded, onCommentDeleted }) {
  const { user } = useAuth()
  const [newComment, setNewComment] = useState('')
  const [posting, setPosting] = useState(false)

  async function handleAddComment() {
    if (!user || !newComment.trim() || posting) return
    
    setPosting(true)
    const commentData = {
      post_id: post.id,
      user_id: user.id,
      text: newComment.trim()
    }
    
    const comment = await addComment(commentData)
    if (comment) {
      onCommentAdded(comment)
      setNewComment('')
    }
    setPosting(false)
  }

  async function handleDeleteComment(commentId) {
    if (!confirm('Supprimer ce commentaire ?')) return
    
    const success = await deleteComment(commentId, user.id, post.user_id)
    if (success) {
      onCommentDeleted(commentId)
    }
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-95 z-[60] flex items-end md:items-center justify-center"
      onClick={onClose}
    >
      <div 
        className="bg-street-900 w-full md:max-w-2xl md:rounded-xl h-[90vh] md:h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-street-700 flex items-center justify-between bg-street-800">
          <h2 className="text-lg font-bold text-white">Commentaires</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-street-700 rounded-full transition"
          >
            <X size={24} className="text-white" />
          </button>
        </div>

        {/* Liste commentaires */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Caption comme premier "commentaire" */}
          {post.caption && (
            <div className="flex space-x-3 pb-4 border-b border-street-700">
              <img
                src={post.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'}
                alt={post.username}
                className="w-10 h-10 rounded-full border border-street-accent flex-shrink-0"
              />
              <div className="flex-1">
                <div>
                  <span className="font-semibold text-white mr-2">{post.username}</span>
                  <span className="text-gray-300 text-sm">{post.caption}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(post.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
            </div>
          )}

          {/* Commentaires */}
          {comments.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              Aucun commentaire pour le moment.<br/>
              <span className="text-sm">Soyez le premier à commenter !</span>
            </div>
          ) : (
            comments.map(comment => {
              const canDelete = user && (
                comment.user_id === user.id || 
                post.user_id === user.id
              )
              
              return (
                <div key={comment.id} className="flex space-x-3">
                  <img
                    src={comment.profiles?.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'}
                    alt={comment.profiles?.username}
                    className="w-10 h-10 rounded-full border border-street-accent flex-shrink-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <span className="font-semibold text-white text-sm mr-2">
                          {comment.profiles?.username}
                        </span>
                        <span className="text-gray-300 text-sm">{comment.text}</span>
                      </div>
                      {canDelete && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-red-400 hover:text-red-300 text-xs ml-2 flex-shrink-0"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(comment.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Input commentaire */}
        {user && (
          <div className="p-4 border-t border-street-700 bg-street-800">
            <div className="flex space-x-2 items-center">
              <img
                src={user.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'}
                alt="Vous"
                className="w-8 h-8 rounded-full border border-street-accent flex-shrink-0"
              />
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                placeholder="Ajouter un commentaire..."
                disabled={posting}
                className="flex-1 px-4 py-2 bg-street-900 border border-street-700 text-white rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-street-accent disabled:opacity-50"
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim() || posting}
                className="p-2 bg-street-accent text-street-900 rounded-full hover:bg-street-accentHover transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
