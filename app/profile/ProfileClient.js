'use client'

import { useSearchParams } from 'next/navigation'
import Profile from '../../components/Profile'

export default function ProfilePage() {
  const searchParams = useSearchParams()
  const u = searchParams.get('u') || null

  return <Profile viewUserId={u} />
}