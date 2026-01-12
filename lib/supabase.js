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

    if (!currentUserId) {
      return (posts || []).map((post) => ({
        ...post,
        username: post.profiles?.username || 'Anonyme',
        avatar_url: post.profiles?.avatar_url || null,
        user_has_liked: false
      }))
    }

    const postIds = (posts || []).map((p) => p.id)
    if (postIds.length === 0) return []

    const { data: likes, error: likesError } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', currentUserId)
      .in('post_id', postIds)

    if (likesError) {
      console.error('Erreur getPosts likes:', likesError)
    }

    const likedPostIds = new Set((likes || []).map((l) => l.post_id))

    return (posts || []).map((post) => ({
      ...post,
      username: post.profiles?.username || 'Anonyme',
      avatar_url: post.profiles?.avatar_url || null,
      user_has_liked: likedPostIds.has(post.id)
    }))
  } catch (err) {
    console.error('Exception getPosts:', err)
    return []
  }
}

export async function createPost(postData) {
  try {
    const { data, error } = await supabase.from('posts').insert([postData]).select().single()

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
    const { data: post } = await supabase.from('posts').select('user_id').eq('id', postId).single()

    if (!post || post.user_id !== userId) {
      console.error('Erreur deletePost: Non autorisé')
      return false
    }

    const { error } = await supabase.from('posts').delete().eq('id', postId)

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

    const { data, error } = await supabase.storage.from('posts').upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    })

    if (error) {
      console.error('Erreur uploadPostMedia:', error)
      return null
    }

    const { data: publicUrlData } = supabase.storage.from('posts').getPublicUrl(data.path)

    return publicUrlData.publicUrl
  } catch (err) {
    console.error('Exception uploadPostMedia:', err)
    return null
  }
}

/**
 * ✅ Like robuste:
 * - Insert dans likes
 * - PAS de RPC increment (le trigger DB recalc likes_count)
 * - Si déjà liké => contrainte unique => on ignore (code 23505)
 */
export async function likePost(postId, userId) {
  try {
    const { error } = await supabase.from('likes').insert([{ post_id: postId, user_id: userId }])

    // 23505 = unique violation (déjà liké) => on ignore
    if (error) {
      if (error.code === '23505') return true
      console.error('Erreur likePost (insert):', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception likePost:', err)
    return false
  }
}

/**
 * ✅ Unlike robuste:
 * - Delete dans likes
 * - PAS de RPC decrement (trigger DB recalc likes_count)
 */
export async function unlikePost(postId, userId) {
  try {
    const { error } = await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId)

    if (error) {
      console.error('Erreur unlikePost (delete):', error)
      return false
    }

    return true
  } catch (err) {
    console.error('Exception unlikePost:', err)
    return false
  }
}

export async function getComments(postId) {
  try {
    const { data, error } = await supabase
      .from('comments')
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

/**
 * ✅ Add comment:
 * - insert
 * - PAS de RPC increment (trigger DB recalc comments_count)
 */
export async function addComment(commentData) {
  try {
    const { data, error } = await supabase
      .from('comments')
      .insert([commentData])
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

    const { error } = await supabase.from('comments').delete().eq('id', commentId)

    if (error) {
      console.error('Erreur deleteComment:', error)
      return false
    }

    // ✅ PAS de RPC decrement (trigger DB recalc comments_count)
    return true
  } catch (err) {
    console.error('Exception deleteComment:', err)
    return false
  }
}

export const addCommentDB = addComment

export async function getProfile(userId) {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()

    if (error) {
      console.error('Erreur getProfile:', error)
      return null
    }

    if (!data) {
      console.log('Profil manquant, création automatique...')
      const { data: user } = await supabase.auth.getUser()

      if (user?.user) {
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
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', userId).select().single()

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

    await supabase.storage.from('avatars').remove([fileName])

    const { data, error } = await supabase.storage.from('avatars').upload(fileName, file, {
      cacheControl: '3600',
      upsert: true
    })

    if (error) {
      console.error('Erreur uploadAvatar:', error)
      return null
    }

    const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(data.path)

    return publicUrlData.publicUrl
  } catch (err) {
    console.error('Exception uploadAvatar:', err)
    return null
  }
}

export async function getSpots() {
  try {
    const { data, error } = await supabase.from('spots').select('*').order('created_at', { ascending: false })

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
    const { data, error } = await supabase.from('spots').insert([spotData]).select().single()

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

export async function followUser(followingId, followerId) {
  try {
    const { error } = await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId })

    if (error) {
      console.error('Erreur insert follows:', error)
      return false
    }

    // Si tu as des triggers/fonctions DB pour followers_count/following_count, tu peux garder.
    // Sinon, ça peut aussi créer du drift comme les likes. (On pourra sécuriser pareil ensuite.)
    await supabase.rpc('increment_followers', { profile_id: followingId })
    await supabase.rpc('increment_following', { profile_id: followerId })

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

    await supabase.rpc('decrement_followers', { profile_id: followingId })
    await supabase.rpc('decrement_following', { profile_id: followerId })

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

// ===== MESSAGING FUNCTIONS =====

export async function getInbox(userId) {
  try {
    const { data: memberData, error: memberError } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', userId)

    if (memberError) throw memberError

    const conversationIds = (memberData || []).map((m) => m.conversation_id)
    if (conversationIds.length === 0) return []

    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select(
        `
        id,
        updated_at,
        conversation_members!inner(
          user_id,
          last_read_at,
          profiles:user_id(
            id,
            username,
            avatar_url
          )
        ),
        messages(
          id,
          text,
          created_at,
          sender_id
        )
      `
      )
      .in('id', conversationIds)
      .order('updated_at', { ascending: false })

    if (convError) throw convError

    return (conversations || []).map((conv) => {
      const otherMember = conv.conversation_members.find((m) => m.user_id !== userId)
      const lastMessage = conv.messages
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]

      return {
        id: conv.id,
        otherUser: otherMember?.profiles || null,
        lastMessage: lastMessage || null,
        updatedAt: conv.updated_at,
        unread:
          lastMessage && otherMember?.last_read_at
            ? new Date(lastMessage.created_at) > new Date(otherMember.last_read_at)
            : false
      }
    })
  } catch (err) {
    console.error('Error getInbox:', err)
    return []
  }
}

/**
 * ✅ FONCTION CORRIGÉE - Crée ou récupère une conversation entre 2 users
 * @param {string} currentUserId - ID de l'utilisateur actuel
 * @param {string} otherUserId - ID de l'autre utilisateur
 * @returns {Promise<string|null>} - conversation_id ou null si erreur
 */
export async function findOrCreateConversation(currentUserId, otherUserId) {
  try {
    if (!currentUserId || !otherUserId) {
      console.error('❌ findOrCreateConversation: Missing userId', { currentUserId, otherUserId })
      return null
    }

    if (currentUserId === otherUserId) {
      console.error('❌ findOrCreateConversation: Cannot create conversation with yourself')
      return null
    }

    console.log('🔍 Searching conversation between:', { currentUserId, otherUserId })

    const { data: myConversations, error: myError } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', currentUserId)

    if (myError) {
      console.error('❌ Error fetching my conversations:', myError)
      throw myError
    }

    const myConvIds = (myConversations || []).map((m) => m.conversation_id)
    console.log('📋 My conversations:', myConvIds)

    if (myConvIds.length > 0) {
      const { data: sharedConv, error: sharedError } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', otherUserId)
        .in('conversation_id', myConvIds)
        .limit(1)
        .maybeSingle()

      if (sharedError) {
        console.error('❌ Error checking shared conversation:', sharedError)
      }

      if (sharedConv) {
        console.log('✅ Found existing conversation:', sharedConv.conversation_id)
        return sharedConv.conversation_id
      }
    }

    console.log('🆕 No existing conversation, creating new one...')

    const conversationId = crypto.randomUUID()

    const { error: convError } = await supabase.from('conversations').insert({
      id: conversationId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    if (convError) {
      console.error('❌ Error creating conversation:', convError)
      throw convError
    }

    console.log('✅ Conversation created:', conversationId)

    const { error: membersError } = await supabase.from('conversation_members').insert([
      {
        conversation_id: conversationId,
        user_id: currentUserId,
        joined_at: new Date().toISOString(),
        last_read_at: new Date().toISOString()
      },
      {
        conversation_id: conversationId,
        user_id: otherUserId,
        joined_at: new Date().toISOString(),
        last_read_at: new Date().toISOString()
      }
    ])

    if (membersError) {
      console.error('❌ Error adding members:', membersError)
      throw membersError
    }

    console.log('✅ Both members added:', { currentUserId, otherUserId })

    return conversationId
  } catch (err) {
    console.error('💥 Exception in findOrCreateConversation:', err)
    return null
  }
}

export async function getConversation(conversationId, userId) {
  try {
    console.log('📨 Loading conversation:', { conversationId, userId })

    const { data, error } = await supabase
      .from('conversations')
      .select(
        `
        id,
        conversation_members!inner(
          user_id,
          profiles:user_id(
            id,
            username,
            avatar_url
          )
        ),
        messages(
          id,
          text,
          created_at,
          sender_id,
          profiles:sender_id(
            id,
            username,
            avatar_url
          )
        )
      `
      )
      .eq('id', conversationId)
      .single()

    if (error) {
      console.error('❌ Error loading conversation:', error)
      throw error
    }

    const otherMember = data.conversation_members.find((m) => m.user_id !== userId)
    const messages = (data.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    console.log('✅ Conversation loaded:', {
      conversationId,
      members: data.conversation_members.length,
      messages: messages.length,
      otherUser: otherMember?.profiles?.username
    })

    return {
      id: data.id,
      otherUser: otherMember?.profiles || null,
      messages
    }
  } catch (err) {
    console.error('💥 Exception in getConversation:', err)
    return null
  }
}

export async function sendMessage(conversationId, senderId, text) {
  try {
    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        text: text.trim()
      })
      .select(
        `
        id,
        text,
        created_at,
        sender_id,
        profiles:sender_id(
          id,
          username,
          avatar_url
        )
      `
      )
      .single()

    if (error) throw error

    return data
  } catch (err) {
    console.error('Error sendMessage:', err)
    return null
  }
}

export async function markAsRead(conversationId, userId) {
  try {
    await supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)

    return true
  } catch (err) {
    console.error('Error markAsRead:', err)
    return false
  }
}

export async function searchMutualFollows(currentUserId, searchQuery) {
  try {
    const { data: following } = await supabase.from('follows').select('following_id').eq('follower_id', currentUserId)

    const followingIds = (following || []).map((f) => f.following_id)
    if (followingIds.length === 0) return []

    const { data: followers } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('following_id', currentUserId)
      .in('follower_id', followingIds)

    const mutualIds = (followers || []).map((f) => f.follower_id)
    if (mutualIds.length === 0) return []

    let query = supabase.from('profiles').select('id, username, avatar_url').in('id', mutualIds)

    if (searchQuery) {
      query = query.ilike('username', `%${searchQuery}%`)
    }

    const { data, error } = await query.limit(10)

    if (error) throw error

    return data || []
  } catch (err) {
    console.error('Error searchMutualFollows:', err)
    return []
  }
}

export function subscribeToConversation(conversationId, callback) {
  const channel = supabase
    .channel(`conversation:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      callback
    )

  channel.subscribe()

  return channel
}