'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../contexts/AuthContext'
import {
  getPosts,
  getProfile,
  updateProfile,
  uploadAvatar,
  followUser,
  unfollowUser,
  isFollowing
} from '../lib/supabase'
import { supabase } from '../lib/supabase'
import {
  ArrowLeft,
  MoreVertical,
  MessageCircle,
  ChevronDown,
  UserPlus,
  UserCheck,
  LogOut
} from 'lucide-react'

export default function Profile({
  viewUserId,
  onBack,
  returnTab = 'feed',
  onUserClick,
  onOpenConversation,
  onOpenMessages
}) {
  const router = useRouter()
  const { user, signOut } = useAuth()

  const profileUserId = viewUserId || user?.id

  const [profile, setProfile] = useState(null)
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // counts
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  // edit
  const [isEditing, setIsEditing] = useState(false)
  const [editedBio, setEditedBio] = useState('')
  const [editedUsername, setEditedUsername] = useState('')
  const [newAvatar, setNewAvatar] = useState(null)
  const [updating, setUpdating] = useState(false)

  // follow state
  const [isFollowingUser, setIsFollowingUser] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [isMutualFollow, setIsMutualFollow] = useState(false)

  // menu ⋮ (profil perso)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const moreMenuRef = useRef(null)

  // menu "Suivi(e)" (profil autre)
  const [showFollowingMenu, setShowFollowingMenu] = useState(false)
  const followingMenuRef = useRef(null)

  const isMyProfile = useMemo(() => user?.id && profile?.id && user.id === profile.id, [user, profile])

  useEffect(() => {
    if (profileUserId) {
      loadAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileUserId])

  useEffect(() => {
    if (user && profile && user.id !== profile.id) {
      checkFollowStatus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile])

  useEffect(() => {
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) setShowMoreMenu(false)
      if (followingMenuRef.current && !followingMenuRef.current.contains(e.target)) setShowFollowingMenu(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function loadAll() {
    try {
      setLoading(true)
      setError(null)

      const data = await getProfile(profileUserId)
      if (!data) throw new Error('Profil introuvable')

      setProfile(data)
      setEditedBio(data.bio || '')
      setEditedUsername(data.username || '')

      await Promise.all([loadUserPosts(profileUserId), loadFollowCounts(profileUserId)])
    } catch (e) {
      console.error(e)
      setError('Impossible de charger le profil')
    } finally {
      setLoading(false)
    }
  }

  async function loadUserPosts(uid) {
    try {
      const data = await getPosts(uid, user?.id)
      setPosts(data || [])
    } catch (e) {
      console.error(e)
      setPosts([])
    }
  }

  async function loadFollowCounts(uid) {
    try {
      const [followersRes, followingRes] = await Promise.all([
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid)
      ])

      setFollowersCount(followersRes?.count || 0)
      setFollowingCount(followingRes?.count || 0)
    } catch (e) {
      console.error('loadFollowCounts error:', e)
      setFollowersCount(0)
      setFollowingCount(0)
    }
  }

  async function checkFollowStatus() {
    const following = await isFollowing(user.id, profile.id)
    const followingBack = await isFollowing(profile.id, user.id)
    setIsFollowingUser(!!following)
    setIsMutualFollow(!!following && !!followingBack)
  }

  async function handleFollow() {
    if (!user || !profile) return
    if (followLoading) return

    setFollowLoading(true)
    try {
      if (isFollowingUser) {
        await unfollowUser(profile.id, user.id)
        setIsFollowingUser(false)
      } else {
        await followUser(profile.id, user.id)
        setIsFollowingUser(true)
      }
      await checkFollowStatus()
      await loadFollowCounts(profile.id)
    } finally {
      setFollowLoading(false)
    }
  }

  async function handleUnfollowFromMenu() {
    setShowFollowingMenu(false)
    if (!isFollowingUser) return
    await handleFollow() // toggles
  }

  async function handleSaveProfile() {
    if (!user) return
    setUpdating(true)

    try {
      let avatarUrl = profile.avatar_url
      if (newAvatar) avatarUrl = await uploadAvatar(newAvatar, user.id)

      const updated = await updateProfile(user.id, {
        username: editedUsername,
        bio: editedBio,
        avatar_url: avatarUrl
      })

      if (updated) {
        setProfile(updated)
        setIsEditing(false)
        setNewAvatar(null)
      }
    } finally {
      setUpdating(false)
    }
  }

  async function handleLogout() {
    setShowMoreMenu(false)
    await signOut()
    router.push('/auth')
  }

  async function handleMessage() {
    if (!isMutualFollow || !profile?.id) return

    const { data, error } = await supabase.rpc('create_or_get_dm', {
      other_user_id: profile.id
    })
    if (error) {
      console.error('create_or_get_dm error:', error)
      return
    }

    const conversationId = typeof data === 'string' ? data : data?.conversation_id
    if (!conversationId) return

    // ✅ Si tu veux rester en SPA (inbox) plutôt qu'une route dédiée :
    if (onOpenConversation) {
      onOpenConversation(conversationId)
      return
    }

    // fallback
    router.push(`/messages/${conversationId}`)
  }

  // ✅ OUVRIR LE POST CLIQUÉ EN MODE FEED (Instagram) + garder l'ID du profil pour le retour
  function openPost(index) {
    const post = posts[index]
    if (!post) return
    router.push(`/p/${post.id}?u=${profileUserId}`)
  }

  function goFollowers() {
    router.push(`/followers?u=${encodeURIComponent(profileUserId || '')}`)
  }

  function goFollowing() {
    router.push(`/following?u=${encodeURIComponent(profileUserId || '')}`)
  }

  if (loading) return <div className="text-center text-gray-400 py-20">Chargement…</div>
  if (error || !profile) return <div className="text-center text-red-500 py-20">{error}</div>

  const postsCount = posts?.length || 0

  return (
    <div className="max-w-md mx-auto pb-24">
      {/* TOP BAR */}
      <div className="sticky top-0 z-30 bg-street-800/90 backdrop-blur border-b border-street-700">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Flèche retour uniquement quand on visite quelqu’un */}
            {!isMyProfile && (
              <button
                onClick={() => (onBack ? onBack() : router.push(`/?tab=${encodeURIComponent(returnTab || 'feed')}`))}
                className="p-2 rounded-lg hover:bg-street-700 text-white"
                aria-label="Retour"
              >
                <ArrowLeft size={20} />
              </button>
            )}

            <div className="text-white font-bold">{profile.username || 'Profil'}</div>
          </div>

          {/* ⋮ menu (profil perso) */}
          {isMyProfile && (
            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu((v) => !v)}
                className="p-2 rounded-lg hover:bg-street-700 text-gray-200"
                aria-label="Menu"
              >
                <MoreVertical size={20} />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-street-800 border border-street-700 rounded-xl overflow-hidden shadow-xl">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 text-white hover:bg-street-700"
                  >
                    <LogOut size={16} />
                    Se déconnecter
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* HEADER PROFILE */}
      <div className="px-4 pt-5">
        <div className="flex items-center gap-4">
          <div className="relative">
            <img
              src={profile.avatar_url || 'https://placehold.co/120'}
              className="w-20 h-20 rounded-full border-2 border-street-accent object-cover"
              alt="avatar"
            />
            {isMyProfile && isEditing && (
              <label className="absolute -bottom-2 -right-2 bg-street-accent text-black text-xs font-bold px-2 py-1 rounded-lg cursor-pointer">
                Photo
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => setNewAvatar(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>

          {/* STATS */}
          <div className="flex-1 flex justify-around text-center">
            <div>
              <div className="text-white font-bold">{postsCount}</div>
              <div className="text-gray-400 text-xs">publications</div>
            </div>

            <button onClick={goFollowers} className="focus:outline-none">
              <div className="text-white font-bold">{followersCount}</div>
              <div className="text-gray-400 text-xs">abonnés</div>
            </button>

            <button onClick={goFollowing} className="focus:outline-none">
              <div className="text-white font-bold">{followingCount}</div>
              <div className="text-gray-400 text-xs">suivis</div>
            </button>
          </div>
        </div>

        {/* NAME + BIO */}
        <div className="mt-4">
          {!isEditing ? (
            <>
              <div className="text-white font-semibold">{profile.username}</div>
              <div className="text-gray-400 text-sm whitespace-pre-line">{profile.bio || 'Aucune bio'}</div>
            </>
          ) : (
            <div className="space-y-3">
              <input
                value={editedUsername}
                onChange={(e) => setEditedUsername(e.target.value)}
                className="w-full bg-street-900 border border-street-700 rounded-xl px-3 py-2 text-white outline-none"
                placeholder="Pseudo"
              />
              <textarea
                value={editedBio}
                onChange={(e) => setEditedBio(e.target.value)}
                className="w-full min-h-[90px] bg-street-900 border border-street-700 rounded-xl px-3 py-2 text-white outline-none"
                placeholder="Bio"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={updating}
                  className="flex-1 bg-street-accent text-black font-bold py-2 rounded-xl disabled:opacity-50"
                >
                  {updating ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    setNewAvatar(null)
                    setEditedBio(profile.bio || '')
                    setEditedUsername(profile.username || '')
                  }}
                  className="flex-1 bg-street-800 text-white font-bold py-2 rounded-xl"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ACTION BUTTONS */}
        {!isEditing && (
          <div className="mt-4">
            {isMyProfile ? (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full bg-street-800 border border-street-700 text-white font-bold py-2 rounded-xl"
              >
                Modifier le profil
              </button>
            ) : (
              <div className="flex gap-2">
                {/* Bouton Suivre / Suivi(e) avec menu liste */}
                <div className="relative flex-1" ref={followingMenuRef}>
                  {!isFollowingUser ? (
                    <button
                      onClick={handleFollow}
                      disabled={followLoading}
                      className="w-full bg-street-accent text-black font-bold py-2 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <UserPlus size={18} />
                      Suivre
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowFollowingMenu((v) => !v)}
                      disabled={followLoading}
                      className="w-full bg-street-800 border border-street-700 text-white font-bold py-2 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <UserCheck size={18} />
                      Suivi(e)
                      <ChevronDown size={16} />
                    </button>
                  )}

                  {showFollowingMenu && (
                    <div className="absolute top-[48px] left-0 right-0 bg-street-800 border border-street-700 rounded-xl overflow-hidden shadow-xl z-40">
                      <button
                        onClick={handleUnfollowFromMenu}
                        className="w-full px-4 py-3 text-left text-red-300 hover:bg-street-700"
                      >
                        Ne plus suivre
                      </button>
                      <button
                        onClick={() => setShowFollowingMenu(false)}
                        className="w-full px-4 py-3 text-left text-white hover:bg-street-700"
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                </div>

                {/* Message (uniquement si mutual follow) */}
                <button
                  onClick={handleMessage}
                  disabled={!isMutualFollow}
                  className="w-12 bg-street-800 border border-street-700 text-white rounded-xl flex items-center justify-center disabled:opacity-40"
                  title={isMutualFollow ? 'Message' : 'Mutual follow requis'}
                >
                  <MessageCircle size={18} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* POSTS GRID */}
      <div className="mt-6">
        <div className="px-4 pb-3 text-white font-bold">Publications</div>

        {posts.length === 0 ? (
          <div className="text-gray-500 text-center py-12">Aucune publication</div>
        ) : (
          <div className="grid grid-cols-3 gap-[2px]">
            {posts.map((post, index) => (
              <div
                key={post.id}
                onClick={() => openPost(index)}
                className="aspect-square bg-street-900 overflow-hidden cursor-pointer active:opacity-80 border border-street-900"
              >
                {post.media_url ? (
                  post.type === 'IMAGE' ? (
                    <img src={post.media_url} className="w-full h-full object-cover" alt="post" />
                  ) : (
                    <video src={post.media_url} className="w-full h-full object-cover" />
                  )
                ) : (
                  <div className="flex items-center justify-center h-full text-white text-xs p-2">
                    {post.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}