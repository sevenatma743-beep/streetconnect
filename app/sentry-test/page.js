'use client'
import * as Sentry from '@sentry/nextjs'

export default function SentryTestPage() {
  return (
    <div style={{ padding: 40 }}>
      <p style={{ marginBottom: 16, color: '#fff' }}>Sentry test — à supprimer après validation</p>
      <button
        style={{ padding: '8px 16px', background: '#e11d48', color: '#fff', borderRadius: 6 }}
        onClick={() => Sentry.captureException(new Error('sentry-runtime-test'))}
      >
        Envoyer erreur test Sentry
      </button>
    </div>
  )
}
