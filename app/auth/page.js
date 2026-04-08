'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AuthPage() {
  const searchParams = useSearchParams()
  const [mode, setMode] = useState(searchParams.get('mode') === 'login' ? 'login' : 'signup')

  useEffect(() => {
    if (searchParams.get('mode') === 'login') {
      setMode('login')
    }
  }, [searchParams])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const { signIn, signUp } = useAuth()
  const router = useRouter()

  const handleResetPassword = async () => {
    setError('')
    setResetSent(false)
    if (!email) {
      setError('Saisis ton email d\'abord')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/reset`
    })
    if (error) {
      setError(error.message || 'Une erreur est survenue')
    } else {
      setResetSent(true)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        // CONNEXION
        const { data, error } = await signIn(email, password)
        if (error) throw error
        
        // Redirection immédiate
        router.push('/')
      } else {
        // INSCRIPTION
        if (!username || username.length < 3) {
          throw new Error('Le nom d\'utilisateur doit contenir au moins 3 caractères')
        }
        if (password.length < 6) {
          throw new Error('Le mot de passe doit contenir au moins 6 caractères')
        }

        // Pre-check : username déjà pris ?
        const { data: existing } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', username)
          .maybeSingle()
        if (existing) {
          throw new Error('Nom d\'utilisateur déjà utilisé')
        }

        const { data, error } = await signUp(email, password, username)
        if (error) throw error
        
        if (data?.user && !data.session) {
          setError('✅ Compte créé ! Vérifiez votre email pour confirmer votre inscription.')
        } else {
          router.replace('/')
        }
      }
    } catch (err) {
      console.error('Erreur auth:', err)
      const isUsernameTaken =
        err.message === 'Nom d\'utilisateur déjà utilisé' ||
        err.code === '23505' ||
        err.message?.includes('unique') ||
        err.message?.includes('duplicate')
      setError(isUsernameTaken && mode === 'signup'
        ? 'Nom d\'utilisateur déjà utilisé'
        : err.message || 'Une erreur est survenue'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-street-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-black mb-2">
            <span className="text-white">STREET</span>
            <span className="text-street-accent">CONNECT</span>
          </h1>
          <p className="text-gray-400 text-sm">
            {mode === 'login' ? 'Connecte-toi pour continuer' : 'Rejoins la communauté'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-street-800 rounded-2xl border border-street-700 p-8 shadow-2xl">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 bg-street-900 p-1 rounded-xl">
            <button
              onClick={() => {
                setMode('login')
                setError('')
              }}
              className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                mode === 'login'
                  ? 'bg-street-accent text-street-900'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Connexion
            </button>
            <button
              onClick={() => {
                setMode('signup')
                setError('')
              }}
              className={`flex-1 py-3 rounded-lg font-bold transition-all ${
                mode === 'signup'
                  ? 'bg-street-accent text-street-900'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Inscription
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-xs font-bold uppercase text-gray-400 mb-2 block">
                  Nom d'utilisateur
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="StreetWarrior"
                  required
                  className="w-full bg-street-900 border border-street-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-street-accent transition-colors"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase text-gray-400 mb-2 block">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                className="w-full bg-street-900 border border-street-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-street-accent transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase text-gray-400 mb-2 block">
                Mot de passe
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
              {mode === 'signup' && (
                <p className="text-xs text-gray-500 mt-1">Minimum 6 caractères</p>
              )}
            </div>

            {/* Error/Success Message */}
            {error && (
              <div className={`p-3 rounded-lg text-sm ${
                error.includes('✅') || error.includes('succès')
                  ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-street-accent text-street-900 py-3 rounded-xl font-bold hover:bg-street-accentHover disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                  </svg>
                  Chargement...
                </span>
              ) : mode === 'login' ? (
                'Se connecter'
              ) : (
                'Créer mon compte'
              )}
            </button>
          </form>

          {/* Footer */}
          {mode === 'login' && (
            <div className="mt-6 text-center space-y-2">
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-sm text-gray-400 hover:text-street-accent transition-colors"
              >
                Mot de passe oublié ?
              </button>
              {resetSent && (
                <p className="text-xs text-green-400">Email envoyé — vérifie ta boîte mail</p>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <p className="text-center text-gray-500 text-xs mt-6">
          {mode === 'login' ? (
            <>Pas encore de compte ? <button onClick={() => setMode('signup')} className="text-street-accent hover:underline">Inscris-toi</button></>
          ) : (
            <>Déjà un compte ? <button onClick={() => setMode('login')} className="text-street-accent hover:underline">Connecte-toi</button></>
          )}
        </p>
      </div>
    </div>
  )
}