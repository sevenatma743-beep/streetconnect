'use client'

import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { useEffect } from 'react'
import { AuthProvider } from '../contexts/AuthContext'

export default function Providers({ children }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
        capture_pageview: true,
        capture_pageleave: true,
      })
    }
  }, [])

  return (
    <PostHogProvider client={posthog}>
      <AuthProvider>{children}</AuthProvider>
    </PostHogProvider>
  )
}
