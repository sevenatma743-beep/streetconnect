import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import { getPosts, getProfile, updateProfile, uploadAvatar, followUser, unfollowUser, isFollowing } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import PostModal from './PostModal'
import { MoreVertical, MessageCircle } from 'lucide-react'

export default function Profile({ viewUserId }) {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const profileUserId = viewUserId || user?.id
  
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [isEditing, setIsEditing] = useState(false)
  const [editedBio, setEditedBio] = useState('')
  const [editedUsername, setEditedUsername] = useState('')
  const [newAvatar, setNewAvatar] = useState(null)
  const [updating, setUpdating] = useState(false)

  const [isFollowingUser, setIsFollowingUser] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [isMutualFollow, setIsMutualFollow] = useState(false)

  const [selectedPostIndex, setSelectedPostIndex] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [creatingConversation, setCreatingConversation] = useState(false)
  const moreMenuRef = useRef(null)

  useEffect(() => {
    if (profileUserId) {
      loadProfile()
      loadUserPosts()
    }
  }, [profileUserId])

  useEffect(() => {
    if (user && profile && user.id !== profile.id) {
      checkFollowStatus()
    }
  }, [user, profile])

  useEffect(() => {
    function handleClickOutside(event) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setShowMoreMenu(false)
      }
    }

    if (showMoreMenu) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMoreMenu])

  async function checkFollowStatus() {
    const following = await isFollowing(user.id, profile.id)
    setIsFollowingUser(following)
    
    const followingBack = await isFollowing(profile.id, user.id)
    setIsMutualFollow(following && followingBack)
  }

  async function handleFollow() {
    if (!user || !profile) return
    
    setFollowLoading(true)
    const success = isFollowingUser 
      ? await unfollowUser(profile.id, user.id)
      : await followUser(profile.id, user.id)
    
    if (success) {
      setIsFollowingUser(!isFollowingUser)
      loadProfile()
      checkFollowStatus()
    }
    setFollowLoading(false)
  }

  async function loadProfile() {
    try {
      setLoading(true)
      setError(null)
      const data = await getProfile(profileUserId)
      
      if (data) {
        setProfile(data)
        setEditedBio(data.bio || '')
        setEditedUsername(data.username || '')
      } else {
        setError('Profil introuvable')
      }
    } catch (err) {
      console.error('Erreur chargement profil:', err)
      setError('Impossible de charger le profil')
    } finally {
      setLoading(false)
    }
  }

  async function loadUserPosts() {
    try {
      const data = await getPosts(profileUserId, user?.id)
      setPosts(data)
    } catch (err) {
      console.error('Erreur chargement posts:', err)
    }
  }

  async function handleAvatarChange(e) {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Le fichier est trop volumineux (max 5MB)')
        return
      }
      setNewAvatar(file)
    }
  }

  async function handleSaveProfile() {
    if (!user || !profile) return

    setUpdating(true)
    setError(null)

    try {
      let avatarUrl = profile.avatar_url

      if (newAvatar) {
        const uploadedUrl = await uploadAvatar(newAvatar, user.id)
        if (uploadedUrl) {
          avatarUrl = uploadedUrl
        } else {
          throw new Error('Échec de l\'upload de l\'avatar')
        }
      }

      const updates = {
        username: editedUsername.trim() || profile.username,
        bio: editedBio.trim(),
        avatar_url: avatarUrl
      }

      const updated = await updateProfile(user.id, updates)

      if (updated) {
        setProfile(updated)
        setIsEditing(false)
        setNewAvatar(null)
      } else {
        throw new Error('Échec de la mise à jour du profil')
      }
    } catch (err) {
      console.error('Erreur sauvegarde profil:', err)
      setError('Erreur lors de la sauvegarde du profil')
    } finally {
      setUpdating(false)
    }
  }

  async function handleLogout() {
    await signOut()
    router.push('/auth')
  }

  async function handleDeleteAccount() {
    const confirmed = confirm(
      'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.'
    )
    
    if (!confirmed) return

    try {
      setDeleting(true)

      const { error: dbError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)

      if (dbError) throw dbError

      const { error: authError } = await supabase.auth.admin.deleteUser(user.id)
      
      if (authError) throw authError

      await signOut()
      router.push('/auth')
    } catch (err) {
      console.error('Erreur suppression compte:', err)
      alert('Erreur lors de la suppression du compte. Veuillez réessayer.')
      setDeleting(false)
    }
  }

  function handlePostClick(index) {
    setSelectedPostIndex(index)
  }

  function handleDeletePost(postId) {
    setPosts(posts.filter(p => p.id !== postId))
    setSelectedPostIndex(null)
  }

  async function handleMessage() {
    if (creatingConversation) {
      console.warn('⚠️ Conversation creation already in progress')
      return
    }

    if (!user) {
      console.error('❌ User not authenticated')
      router.push('/auth')
      return
    }

    if (!profile) {
      console.error('❌ Profile not loaded')
      return
    }

    if (user.id === profile.id) {
      console.error('❌ Cannot message yourself')
      alert('Vous ne pouvez pas vous envoyer un message à vous-même')
      return
    }

    console.log('💬 Opening DM with:', profile.username, '(UUID:', profile.id, ')')
    setCreatingConversation(true)

    try {
      const { data, error } = await supabase.rpc('create_or_get_dm', {
        other_user_id: profile.id
      })

      if (error) {
        console.error('❌ RPC create_or_get_dm error:', error)
        alert(`Erreur: ${error.message}`)
        return
      }

      if (data == null) {
        console.error('❌ RPC returned null/undefined')
        alert('Impossible de créer la conversation')
        return
      }

      const conversationId = typeof data === 'string' 
        ? data 
        : data?.conversation_id

      if (!conversationId) {
        console.error('❌ conversationId missing from response:', data)
        alert('ID de conversation manquant')
        return
      }

      console.log('✅ Conversation ready:', conversationId)

      // ✅ PATCH MINIMAL: use query param since Messages page reads searchParams.get('conversation')
      router.push(`/messages?conversation=${conversationId}`)

    } catch (err) {
      console.error('💥 Exception calling create_or_get_dm:', err)
      alert('Erreur lors de l\'ouverture de la conversation')
    } finally {
      setCreatingConversation(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Chargement du profil...</div>
      </div>
    )
  }

  if (error && !profile) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <div className="text-red-500">{error}</div>
        <button 
          onClick={loadProfile}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Réessayer
        </button>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center text-gray-500 py-12">
        Profil introuvable
      </div>
    )
  }

  const isMyProfile = user && profile && user.id === profile.id

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
      <div className="bg-street-800 border border-street-700 rounded-xl shadow-lg p-6 relative">
        {isMyProfile && !isEditing && (
          <div className="absolute top-4 right-4" ref={moreMenuRef}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              className="p-2 text-gray-400 hover:text-white hover:bg-street-700 rounded-lg transition"
            >
              <MoreVertical size={20} />
            </button>

            {showMoreMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-street-800 border border-street-700 rounded-lg shadow-xl z-10 overflow-hidden">
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-3 text-white hover:bg-street-700 transition text-sm"
                >
                  Se déconnecter
                </button>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="w-full text-left px-4 py-3 text-red-400 hover:bg-street-700 transition text-sm disabled:opacity-50"
                >
                  {deleting ? 'Suppression...' : 'Supprimer mon compte'}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-start space-x-6">
          <div className="flex flex-col items-center space-y-2 flex-shrink-0">
            <div className="w-24 h-24 flex-shrink-0">
              <img
                src={
                  newAvatar 
                    ? URL.createObjectURL(newAvatar)
                    : profile.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'
                }
                alt={profile.username}
                className="w-full h-full rounded-full object-cover border-4 border-street-accent shadow-lg"
              />
            </div>
            {isMyProfile && isEditing && (
              <label className="cursor-pointer text-xs text-street-accent hover:text-street-accentHover transition">
                <span>Changer la photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex-1 space-y-4">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Nom d'utilisateur
                  </label>
                  <input
                    type="text"
                    value={editedUsername}
                    onChange={(e) => setEditedUsername(e.target.value)}
                    className="w-full px-4 py-2 bg-street-900 border border-street-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-street-accent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-white mb-2">
                    Bio
                  </label>
                  <textarea
                    value={editedBio}
                    onChange={(e) => setEditedBio(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 bg-street-900 border border-street-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-street-accent resize-none"
                  />
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={handleSaveProfile}
                    disabled={updating}
                    className="px-4 py-2 bg-street-accent text-street-900 rounded font-bold hover:bg-street-accentHover transition disabled:opacity-50"
                  >
                    {updating ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditedBio(profile.bio || '')
                      setEditedUsername(profile.username || '')
                      setNewAvatar(null)
                    }}
                    className="px-4 py-2 bg-street-700 text-white rounded hover:bg-street-600 transition"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h1 className="text-2xl font-bold text-white">{profile.username}</h1>
                  <p className="text-gray-500">@{profile.username}</p>
                </div>

                <div className="flex space-x-6 text-sm">
                  <div>
                    <span className="font-semibold text-street-accent">{posts.length}</span>
                    <span className="text-gray-400 ml-1">posts</span>
                  </div>
                  <div>
                    <span className="font-semibold text-street-accent">{profile.followers_count || 0}</span>
                    <span className="text-gray-400 ml-1">abonnés</span>
                  </div>
                  <div>
                    <span className="font-semibold text-street-accent">{profile.following_count || 0}</span>
                    <span className="text-gray-400 ml-1">abonnements</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-gray-300">{profile.bio || 'Aucune bio'}</p>
                  
                  {isMyProfile ? (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="text-sm text-street-accent hover:text-street-accentHover font-semibold transition"
                    >
                      Modifier le profil
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={handleFollow}
                        disabled={followLoading}
                        className={`flex-1 px-6 py-2 rounded-lg font-bold transition ${
                          isFollowingUser
                            ? 'bg-street-700 text-white hover:bg-street-600'
                            : 'bg-street-accent text-street-900 hover:bg-street-accentHover'
                        }`}
                      >
                        {followLoading ? '...' : isFollowingUser ? 'Ne plus suivre' : 'Suivre'}
                      </button>
                      {isMutualFollow && (
                        <button
                          onClick={handleMessage}
                          disabled={creatingConversation}
                          className="px-4 py-2 bg-street-700 text-white rounded-lg hover:bg-street-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          title={creatingConversation ? 'Ouverture...' : 'Envoyer un message'}
                        >
                          {creatingConversation ? (
                            <span className="text-xs">...</span>
                          ) : (
                            <MessageCircle size={20} />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {error && <div className="text-red-500 text-sm">{error}</div>}
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4 text-white">Publications</h2>
        
        {posts.length === 0 ? (
          <div className="text-center text-gray-500 py-12 bg-street-800 border border-street-700 rounded-xl">
            Aucune publication
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1">
            {posts.map((post, index) => (
              <div
                key={post.id}
                onClick={() => handlePostClick(index)}
                className="aspect-square bg-street-900 relative overflow-hidden cursor-pointer hover:opacity-75 transition border border-street-700"
              >
                {post.media_url ? (
                  post.type === 'IMAGE' ? (
                    <img
                      src={post.media_url}
                      alt="Post"
                      className="w-full h-full object-cover"
                    />
                  ) : post.type === 'VIDEO' ? (
                    <video
                      src={post.media_url}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-4 bg-street-800">
                      <p className="text-white text-sm text-center line-clamp-6">
                        {post.caption}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-4 bg-street-800">
                    <p className="text-white text-sm text-center line-clamp-6">
                      {post.caption}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedPostIndex !== null && (
        <PostModal
          posts={posts}
          initialIndex={selectedPostIndex}
          onClose={() => setSelectedPostIndex(null)}
          onDelete={handleDeletePost}
        />
      )}
    </div>
  )
}
