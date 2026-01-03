import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getPosts, getProfile, updateProfile, uploadAvatar, followUser, unfollowUser, isFollowing } from '../lib/supabase'
import PostModal from './PostModal'

export default function Profile({ viewUserId }) {
  const { user } = useAuth()
  const profileUserId = viewUserId || user?.id
  
  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  // États pour édition profil
  const [isEditing, setIsEditing] = useState(false)
  const [editedBio, setEditedBio] = useState('')
  const [editedUsername, setEditedUsername] = useState('')
  const [newAvatar, setNewAvatar] = useState(null)
  const [updating, setUpdating] = useState(false)

  // États pour Follow
  const [isFollowingUser, setIsFollowingUser] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  // États pour Modal
  const [selectedPostIndex, setSelectedPostIndex] = useState(null)

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

  async function checkFollowStatus() {
    const following = await isFollowing(user.id, profile.id)
    setIsFollowingUser(following)
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
      console.error('Erreur chargement posts utilisateur:', err)
    }
  }

  async function handleUpdateProfile() {
    if (!user) return

    try {
      setUpdating(true)
      setError(null)
      
      let avatarUrl = profile.avatar_url

      if (newAvatar) {
        const uploadedUrl = await uploadAvatar(newAvatar, user.id)
        if (uploadedUrl) {
          avatarUrl = uploadedUrl
        } else {
          setError('Erreur upload avatar')
          setUpdating(false)
          return
        }
      }

      const updates = {
        username: editedUsername.trim() || profile.username,
        bio: editedBio.trim() || null,
        avatar_url: avatarUrl
      }

      const updated = await updateProfile(user.id, updates)
      
      if (updated) {
        setProfile(updated)
        setIsEditing(false)
        setNewAvatar(null)
        setError(null)
      } else {
        setError('Erreur mise à jour profil')
      }
    } catch (err) {
      console.error('Erreur mise à jour profil:', err)
      setError('Impossible de mettre à jour le profil')
    } finally {
      setUpdating(false)
    }
  }

  function handlePostClick(index) {
    setSelectedPostIndex(index)
  }

  function handleNextPost() {
    if (selectedPostIndex < posts.length - 1) {
      setSelectedPostIndex(selectedPostIndex + 1)
    }
  }

  function handlePrevPost() {
    if (selectedPostIndex > 0) {
      setSelectedPostIndex(selectedPostIndex - 1)
    }
  }

  function handleDeletePost(postId) {
    setPosts(posts.filter(p => p.id !== postId))
    setSelectedPostIndex(null)
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
      {/* Header profil */}
      <div className="bg-street-800 border border-street-700 rounded-xl shadow-lg p-6">
        <div className="flex items-start space-x-6">
          {/* Avatar */}
          <div className="flex flex-col items-center space-y-2">
            <img
              src={
                newAvatar 
                  ? URL.createObjectURL(newAvatar)
                  : profile.avatar_url || 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop'
              }
              alt={profile.username}
              className="w-24 h-24 rounded-full object-cover border-4 border-street-accent shadow-lg"
            />
            {isMyProfile && isEditing && (
              <label className="cursor-pointer text-xs text-street-accent hover:text-street-accentHover font-semibold transition">
                Changer photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewAvatar(e.target.files[0])}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Infos */}
          <div className="flex-1 space-y-3">
            {isMyProfile && isEditing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Nom d'utilisateur</label>
                  <input
                    type="text"
                    value={editedUsername}
                    onChange={(e) => setEditedUsername(e.target.value)}
                    placeholder="Nom d'utilisateur"
                    className="w-full p-2 bg-street-900 border border-street-700 text-white rounded focus:outline-none focus:ring-2 focus:ring-street-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">Bio</label>
                  <textarea
                    value={editedBio}
                    onChange={(e) => setEditedBio(e.target.value)}
                    placeholder="Parlez-nous de vous..."
                    className="w-full p-2 bg-street-900 border border-street-700 text-white rounded resize-none focus:outline-none focus:ring-2 focus:ring-street-accent"
                    rows={3}
                  />
                </div>

                <div className="flex space-x-2">
                  <button
                    onClick={handleUpdateProfile}
                    disabled={updating}
                    className="px-4 py-2 bg-street-accent text-street-900 font-bold rounded hover:bg-street-accentHover disabled:opacity-50 transition"
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

                {/* Stats */}
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

                {/* Bio + Bouton */}
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
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className={`px-6 py-2 rounded-lg font-bold transition ${
                        isFollowingUser
                          ? 'bg-street-700 text-white hover:bg-street-600'
                          : 'bg-street-accent text-street-900 hover:bg-street-accentHover'
                      }`}
                    >
                      {followLoading ? '...' : isFollowingUser ? 'Ne plus suivre' : 'Suivre'}
                    </button>
                  )}
                </div>
              </>
            )}

            {error && <div className="text-red-500 text-sm">{error}</div>}
          </div>
        </div>
      </div>

      {/* Grille de posts */}
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
                      <p className="text-sm text-gray-300 line-clamp-3 text-center">
                        {post.caption}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-4 bg-street-800">
                    <p className="text-sm text-gray-300 line-clamp-3 text-center">
                      {post.caption || 'Post sans contenu'}
                    </p>
                  </div>
                )}

                <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition flex items-center justify-center space-x-4 opacity-0 hover:opacity-100">
                  <div className="text-white flex items-center space-x-1">
                    <span>❤️</span>
                    <span className="font-semibold">{post.likes_count || 0}</span>
                  </div>
                  <div className="text-white flex items-center space-x-1">
                    <span>💬</span>
                    <span className="font-semibold">{post.comments_count || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Post */}
      {selectedPostIndex !== null && (
        <PostModal
  posts={posts}
  initialIndex={selectedPostIndex}
  onClose={() => setSelectedPostIndex(null)}
  onDelete={handleDeletePost}
/>  )}
    </div>
  )
}