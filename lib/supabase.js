import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ===== POSTS =====

export async function getPosts(userId = null, currentUserId = null) {
  try {
    let query = supabase
      .from('posts')
      .select(
        `
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      `
      )
      .order('created_at', { ascending: false })

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: posts, error } = await query

    if (error) {
      console.error('Erreur getPosts:', error)
      return []
    }

    const safePosts = posts || []

    // ✅ Si pas connecté, on renvoie username/avatar + valeurs par défaut
    if (!currentUserId) {
      return safePosts.map((p) => ({
        ...p,
        username: p.profiles?.username || 'Anonyme',
        avatar_url: p.profiles?.avatar_url || null,
        user_has_liked: false,
        is_following_author: false
      }))
    }

    // ---------- Likes lookup ----------
    const postIds = safePosts.map((p) => p.id)
    const likedPostIds = new Set()

    if (postIds.length > 0) {
      const { data: likes, error: likesError } = await supabase
        .from('likes')
        .select('post_id')
        .eq('user_id', currentUserId)
        .in('post_id', postIds)

      if (likesError) {
        console.error('Erreur getPosts likes:', likesError)
      } else {
        ;(likes || []).forEach((l) => likedPostIds.add(l.post_id))
      }
    }

    // ---------- Follow lookup (pour le FEED) ----------
    const authorIds = Array.from(
      new Set(safePosts.map((p) => p.user_id).filter(Boolean).filter((uid) => uid !== currentUserId))
    )

    const followingSet = new Set()
    if (authorIds.length > 0) {
      const { data: follows, error: followErr } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)
        .in('following_id', authorIds)

      if (followErr) {
        console.error('Erreur getPosts follow lookup:', followErr)
      } else {
        ;(follows || []).forEach((f) => followingSet.add(f.following_id))
      }
    }

    // ✅ Remap final : username/avatar + like + follow
    return safePosts.map((p) => ({
      ...p,
      username: p.profiles?.username || 'Anonyme',
      avatar_url: p.profiles?.avatar_url || null,
      user_has_liked: likedPostIds.has(p.id),
      is_following_author: followingSet.has(p.user_id)
    }))
  } catch (err) {
    console.error('Exception getPosts:', err)
    return []
  }
}

export async function createPost(postData) {
  try {
    const { data, error } = await supabase
      .from('posts')
      .insert([postData])
      .select()
      .single()

    if (error) {
      console.error('Erreur createPost:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Exception createPost:', err)
    return null
  }
}

export async function deletePost(postId, userId) {
  try {
    const { data: post } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single()

    if (!post || post.user_id !== userId) {
      console.error('Erreur deletePost: Non autorisé')
      return false
    }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (error) {
      console.error('Erreur deletePost:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception deletePost:', err)
    return false
  }
}

export async function uploadPostMedia(file, userId) {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}/${Date.now()}.${fileExt}`

    const { data, error } = await supabase.storage
      .from('posts')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      })

    if (error) {
      console.error('Erreur uploadPostMedia:', error)
      return null
    }

    const { data: publicUrlData } = supabase.storage
      .from('posts')
      .getPublicUrl(data.path)

    return publicUrlData.publicUrl
  } catch (err) {
    console.error('Exception uploadPostMedia:', err)
    return null
  }
}

// ===== LIKES =====

export async function likePost(postId, userId) {
  try {
    const { error: likeError } = await supabase
      .from('likes')
      .insert([{ post_id: postId, user_id: userId }])

    if (likeError) {
      console.error('Erreur likePost (insert):', likeError)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception likePost:', err)
    return false
  }
}

export async function unlikePost(postId, userId) {
  try {
    const { error: deleteError } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Erreur unlikePost (delete):', deleteError)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception unlikePost:', err)
    return false
  }
}

// ===== COMMENTS =====

export async function getComments(postId) {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Erreur getComments:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Exception getComments:', err)
    return []
  }
}

export async function addComment(commentData) {
  try {
    const { data, error } = await supabase
      .from('comments')
      .insert([commentData])
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .single()

    if (error) {
      console.error('Erreur addComment (insert):', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Exception addComment:', err)
    return null
  }
}

export async function deleteComment(commentId, userId, postOwnerId = null) {
  try {
    const { data: comment } = await supabase
      .from('comments')
      .select('user_id, post_id, posts:post_id(user_id)')
      .eq('id', commentId)
      .single()

    if (!comment) {
      console.error('Erreur deleteComment: Commentaire introuvable')
      return false
    }

    const isCommentOwner = comment.user_id === userId
    const isPostOwner = comment.posts?.user_id === userId || postOwnerId === userId

    if (!isCommentOwner && !isPostOwner) {
      console.error('Erreur deleteComment: Non autorisé')
      return false
    }

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      console.error('Erreur deleteComment:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception deleteComment:', err)
    return false
  }
}

export const addCommentDB = addComment

// ===== PROFILES =====

export async function getProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Erreur getProfile:', error)
      return null
    }

    if (!data) {
      const { data: user } = await supabase.auth.getUser()

      if (user?.user && user.user.id === userId) {
        console.log('Profil manquant, création automatique...')
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            username: user.user.email?.split('@')[0] || 'user',
            email: user.user.email
          })
          .select()
          .single()

        if (insertError) {
          console.error('Erreur création profil auto:', insertError)
          return null
        }

        return newProfile
      }
    }

    return data
  } catch (err) {
    console.error('Exception getProfile:', err)
    return null
  }
}

export async function updateProfile(userId, updates) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Erreur updateProfile:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Exception updateProfile:', err)
    return null
  }
}

export async function uploadAvatar(file, userId) {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}.${fileExt}`

    await supabase.storage
      .from('avatars')
      .remove([fileName])

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true
      })

    if (error) {
      console.error('Erreur uploadAvatar:', error)
      return null
    }

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path)

    return publicUrlData.publicUrl
  } catch (err) {
    console.error('Exception uploadAvatar:', err)
    return null
  }
}

// ===== SPOTS =====

export async function getSpots() {
  try {
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      .order('created_at', { ascending: false})

    if (error) {
      console.error('Erreur getSpots:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('Exception getSpots:', err)
    return []
  }
}

export async function createSpot(spotData) {
  try {
    const { data, error } = await supabase
      .from('spots')
      .insert([spotData])
      .select()
      .single()

    if (error) {
      console.error('Erreur createSpot:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Exception createSpot:', err)
    return null
  }
}

// ===== FOLLOWS =====

export async function followUser(followingId, followerId) {
  try {
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: followerId, following_id: followingId })

    if (error) {
      console.error('Erreur insert follows:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception followUser:', err)
    return false
  }
}

export async function unfollowUser(followingId, followerId) {
  try {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', followerId)
      .eq('following_id', followingId)

    if (error) {
      console.error('Erreur unfollowUser:', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception unfollowUser:', err)
    return false
  }
}

export async function isFollowing(followerId, followingId) {
  try {
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle()

    return !!data
  } catch {
    return false
  }
}