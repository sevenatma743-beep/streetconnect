import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ===== POSTS =====

/**
 * Récupère les posts avec infos utilisateur (SANS utiliser la view)
 * @param {string} userId - Optionnel: filtrer par user_id
 * @param {string} currentUserId - ID de l'utilisateur connecté (pour user_has_liked)
 * @returns {Array} Liste des posts
 */
export async function getPosts(userId = null, currentUserId = null) {
  try {
    let query = supabase
      .from('posts')
      .select(`
        *,
        profiles:user_id (
          id,
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false })

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: posts, error } = await query

    if (error) {
      console.error('Erreur getPosts:', error)
      return []
    }

    // Si pas d'utilisateur connecté, retourner les posts sans user_has_liked
    if (!currentUserId) {
      return (posts || []).map(post => ({
        ...post,
        username: post.profiles?.username || 'Anonyme',
        avatar_url: post.profiles?.avatar_url || null,
        user_has_liked: false
      }))
    }

    // Récupérer les likes de l'utilisateur connecté
    const postIds = posts.map(p => p.id)
    const { data: likes } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', currentUserId)
      .in('post_id', postIds)

    const likedPostIds = new Set(likes?.map(l => l.post_id) || [])

    // Ajouter user_has_liked à chaque post
    return (posts || []).map(post => ({
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

/**
 * Crée un nouveau post
 * @param {Object} postData - { user_id, caption, media_url?, type?, spot_id? }
 * @returns {Object|null} Le post créé ou null
 */
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

/**
 * Supprimer un post
 * @param {string} postId - ID du post
 * @param {string} userId - ID de l'utilisateur (pour vérifier ownership)
 * @returns {boolean} Succès
 */
export async function deletePost(postId, userId) {
  try {
    // Vérifier que l'utilisateur est bien le propriétaire
    const { data: post } = await supabase
      .from('posts')
      .select('user_id')
      .eq('id', postId)
      .single()

    if (!post || post.user_id !== userId) {
      console.error('Erreur deletePost: Non autorisé')
      return false
    }

    // Supprimer le post (cascade supprimera likes et comments)
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

/**
 * Upload un média dans Supabase Storage (bucket: posts)
 * @param {File} file - Fichier à uploader
 * @param {string} userId - ID de l'utilisateur
 * @returns {string|null} URL publique du média ou null
 */
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

    // Récupérer l'URL publique
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

/**
 * Liker un post
 * @param {string} postId - ID du post
 * @param {string} userId - ID de l'utilisateur
 * @returns {boolean} Succès
 */
export async function likePost(postId, userId) {
  try {
    // Insérer le like
    const { error: likeError } = await supabase
      .from('likes')
      .insert([{ post_id: postId, user_id: userId }])

    if (likeError) {
      console.error('Erreur likePost (insert):', likeError)
      return false
    }

    // Incrémenter likes_count dans posts (fallback manuel)
    const { data: post } = await supabase
      .from('posts')
      .select('likes_count')
      .eq('id', postId)
      .single()

    if (post) {
      await supabase
        .from('posts')
        .update({ likes_count: (post.likes_count || 0) + 1 })
        .eq('id', postId)
    }

    return true
  } catch (err) {
    console.error('Exception likePost:', err)
    return false
  }
}

/**
 * Unliker un post
 * @param {string} postId - ID du post
 * @param {string} userId - ID de l'utilisateur
 * @returns {boolean} Succès
 */
export async function unlikePost(postId, userId) {
  try {
    // Supprimer le like
    const { error: deleteError } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Erreur unlikePost (delete):', deleteError)
      return false
    }

    // Décrémenter likes_count dans posts (fallback manuel)
    const { data: post } = await supabase
      .from('posts')
      .select('likes_count')
      .eq('id', postId)
      .single()

    if (post) {
      await supabase
        .from('posts')
        .update({ likes_count: Math.max((post.likes_count || 0) - 1, 0) })
        .eq('id', postId)
    }

    return true
  } catch (err) {
    console.error('Exception unlikePost:', err)
    return false
  }
}

// ===== COMMENTS =====

/**
 * Récupère les commentaires d'un post
 * @param {string} postId - ID du post
 * @returns {Array} Liste des commentaires
 */
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

/**
 * Ajouter un commentaire
 * @param {Object} commentData - { post_id, user_id, text }
 * @returns {Object|null} Le commentaire créé ou null
 */
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

    // Incrémenter comments_count dans posts (fallback manuel)
    const { data: post } = await supabase
      .from('posts')
      .select('comments_count')
      .eq('id', commentData.post_id)
      .single()

    if (post) {
      await supabase
        .from('posts')
        .update({ comments_count: (post.comments_count || 0) + 1 })
        .eq('id', commentData.post_id)
    }

    return data
  } catch (err) {
    console.error('Exception addComment:', err)
    return null
  }
}

/**
 * Supprimer un commentaire
 * @param {string} commentId - ID du commentaire
 * @param {string} userId - ID de l'utilisateur
 * @param {string} postOwnerId - ID du propriétaire du post (optionnel)
 * @returns {boolean} Succès
 */
export async function deleteComment(commentId, userId, postOwnerId = null) {
  try {
    // Récupérer le commentaire avec info du post
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

    // Vérifier les permissions
    if (!isCommentOwner && !isPostOwner) {
      console.error('Erreur deleteComment: Non autorisé')
      return false
    }

    // Supprimer le commentaire
    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      console.error('Erreur deleteComment:', error)
      return false
    }

    // Décrémenter comments_count
    const { data: post } = await supabase
      .from('posts')
      .select('comments_count')
      .eq('id', comment.post_id)
      .single()

    if (post) {
      await supabase
        .from('posts')
        .update({ comments_count: Math.max((post.comments_count || 0) - 1, 0) })
        .eq('id', comment.post_id)
    }

    return true
  } catch (err) {
    console.error('Exception deleteComment:', err)
    return false
  }
}

// Alias pour compatibilité
export const addCommentDB = addComment

// ===== PROFILES =====

/**
 * Récupère un profil utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Object|null} Le profil ou null
 */
export async function getProfile(userId) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Erreur getProfile:', error)
      return null
    }

    return data
  } catch (err) {
    console.error('Exception getProfile:', err)
    return null
  }
}

/**
 * Met à jour un profil utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} updates - Données à mettre à jour
 * @returns {Object|null} Le profil mis à jour ou null
 */
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

/**
 * Upload un avatar dans Supabase Storage (bucket: avatars)
 * @param {File} file - Fichier à uploader
 * @param {string} userId - ID de l'utilisateur
 * @returns {string|null} URL publique de l'avatar ou null
 */
export async function uploadAvatar(file, userId) {
  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${userId}.${fileExt}`

    // Supprimer l'ancien avatar s'il existe
    await supabase.storage
      .from('avatars')
      .remove([fileName])

    // Upload le nouveau
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

    // Récupérer l'URL publique
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

/**
 * Récupère tous les spots
 * @returns {Array} Liste des spots
 */
export async function getSpots() {
  try {
    const { data, error } = await supabase
      .from('spots')
      .select('*')
      .order('created_at', { ascending: false })

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

/**
 * Crée un nouveau spot
 * @param {Object} spotData - { name, city, address, lat, lng, tags }
 * @returns {Object|null} Le spot créé ou null
 */
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