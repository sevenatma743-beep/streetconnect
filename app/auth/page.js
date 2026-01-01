'use client'
import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [mode, setMode] = useState('login') // 'login' ou 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { signIn, signUp } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const { data, error } = await signIn(email, password)
        if (error) throw error
        router.push('/')
      } else {
        // Validation
        if (!username || username.length < 3) {
          throw new Error('Le nom d\'utilisateur doit contenir au moins 3 caractères')
        }
        if (password.length < 6) {
          throw new Error('Le mot de passe doit contenir au moins 6 caractères')
        }

        const { data, error } = await signUp(email, password, username)
        if (error) throw error
        
        // Message de succès
        setError('Compte créé ! Vérifiez votre email pour confirmer votre compte.')
        setTimeout(() => {
          setMode('login')
          setError('')
        }, 3000)
      }
    } catch (err) {
      setError(err.message)
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

            {/* Error Message */}
            {error && (
              <div className={`p-3 rounded-lg text-sm ${
                error.includes('créé') || error.includes('succès')
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
            <div className="mt-6 text-center">
              <button className="text-sm text-gray-400 hover:text-street-accent transition-colors">
                Mot de passe oublié ?
              </button>
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