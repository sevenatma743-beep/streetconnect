'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Le token recovery est souvent parsé avant le montage du composant
    // → vérifier la session existante immédiatement
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    // Fallback : si PASSWORD_RECOVERY arrive après le montage
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message || 'Une erreur est survenue')
    } else {
      router.replace('/')
    }
  }

  return (
    <div className="min-h-screen bg-street-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-black mb-2">
            <span className="text-white">STREET</span>
            <span className="text-street-accent">CONNECT</span>
          </h1>
          <p className="text-gray-400 text-sm">Réinitialisation du mot de passe</p>
        </div>

        <div className="bg-street-800 rounded-2xl border border-street-700 p-8 shadow-2xl">
          {!ready ? (
            <p className="text-center text-gray-400 text-sm">Chargement...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 mb-2 block">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full bg-street-900 border border-street-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-street-accent transition-colors"
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères</p>
              </div>

              {error && (
                <div className="p-3 rounded-lg text-sm bg-red-500/10 text-red-400 border border-red-500/20">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-street-accent text-street-900 py-3 rounded-xl font-bold hover:bg-street-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? 'Chargement...' : 'Mettre à jour le mot de passe'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
