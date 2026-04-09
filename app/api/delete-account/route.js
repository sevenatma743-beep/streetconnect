import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

export async function POST(request) {
  try {
    // Get access token from Authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 })
    }

    const token = authHeader.replace('Bearer ', '')

    // Get user from token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token or user not found' }, { status: 401 })
    }

    const userId = user.id

    // Delete user data in order (foreign key constraints)

    // 1. Delete likes left by user on other posts
    await supabaseAdmin.from('likes').delete().eq('user_id', userId)

    // 2. Delete follows where user is follower or followed
    await supabaseAdmin.from('follows').delete().eq('follower_id', userId)
    await supabaseAdmin.from('follows').delete().eq('following_id', userId)

    // 3. Delete notifications involving the user (as actor or recipient)
    await supabaseAdmin.from('notifications').delete().eq('actor_id', userId)
    await supabaseAdmin.from('notifications').delete().eq('user_id', userId)

    // 4. Delete messages sent by user
    await supabaseAdmin.from('messages').delete().eq('sender_id', userId)

    // 5. Delete conversation memberships
    await supabaseAdmin.from('conversation_members').delete().eq('user_id', userId)

    // 6. Delete comments
    await supabaseAdmin.from('comments').delete().eq('user_id', userId)

    // 7. Delete posts
    const { error: postsError } = await supabaseAdmin
      .from('posts')
      .delete()
      .eq('user_id', userId)

    if (postsError) {
      console.error('Error deleting posts:', postsError)
      return NextResponse.json({ error: 'Failed to delete posts' }, { status: 500 })
    }

    // 8. Delete profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
      return NextResponse.json({ error: 'Failed to delete profile' }, { status: 500 })
    }

    // 9. Delete auth user
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError)
      return NextResponse.json({ error: 'Failed to delete auth user' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Delete account error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
