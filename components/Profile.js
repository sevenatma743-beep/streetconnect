import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { getPosts, getProfile, updateProfile, uploadAvatar } from '../lib/supabase'

export default function Profile() {
  const { user } = useAuth()
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

  useEffect(() => {
    if (user) {
      loadProfile()
      loadUserPosts()
    }
  }, [user])

  async function loadProfile() {
    try {
      setLoading(true)
      setError(null)
      const data = await getProfile(user.id)
      
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
      const data = await getPosts(user.id, user.id)
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

      // Upload avatar si un nouveau fichier est sélectionné
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

      // Préparer les mises à jour
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
                  : profile.avatar_url || '/default-avatar.png'
              }
              alt={profile.username}
              className="w-24 h-24 rounded-full object-cover border-4 border-street-accent shadow-lg"
            />
            {isEditing && (
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
            {isEditing ? (
              <div className="space-y-3">
                {/* Édition nom */}
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

                {/* Édition bio */}
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

                {/* Boutons */}
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

                {/* Bio */}
                <div className="space-y-2">
                  <p className="text-sm text-gray-300">{profile.bio || 'Aucune bio'}</p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm text-street-accent hover:text-street-accentHover font-semibold transition"
                  >
                    Modifier le profil
                  </button>
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
            {posts.map(post => (
              <div
                key={post.id}
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
                    <div className="w-full h-full flex items-center justify-center p-4 bg-gray-100">
                      <p className="text-sm text-gray-600 line-clamp-3 text-center">
                        {post.caption}
                      </p>
                    </div>
                  )
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-4 bg-gray-100">
                    <p className="text-sm text-gray-600 line-clamp-3 text-center">
                      {post.caption || 'Post sans contenu'}
                    </p>
                  </div>
                )}

                {/* Overlay avec stats */}
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
    </div>
  )
}