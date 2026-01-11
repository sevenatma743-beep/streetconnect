/**
   * ✅ OPEN CONVERSATION WITH USER
   * Utilise RPC create_or_get_dm
   * Gère les deux formats de réponse: string | { conversation_id: string }
   */
  async function openConversationWithUser(userId) {
    console.log('💬 Creating/finding DM with user:', userId)
    
    try {
      // ✅ APPEL RPC create_or_get_dm
      const { data, error } = await supabase.rpc('create_or_get_dm', {
        other_user_id: userId  // Note: param name is other_user_id
      })

      if (error) {
        console.error('❌ RPC create_or_get_dm error:', error)
        alert(`Erreur: ${error.message}`)
        return
      }

      // ✅ GESTION DES DEUX FORMATS DE RÉPONSE
      // Format 1: string (UUID direct)
      // Format 2: object { conversation_id: UUID }
      const conversationId = typeof data === 'string'
        ? data
        : data?.conversation_id

      if (!conversationId) {
        console.error('❌ RPC returned invalid response:', data)
        alert('Impossible de créer la conversation (ID manquant)')
        return
      }

      console.log('✅ Conversation ID:', conversationId)
      openConversation(conversationId)

    } catch (err) {
      console.error('💥 Exception in openConversationWithUser:', err)
      alert('Erreur lors de l\'ouverture de la conversation')
    }
  }