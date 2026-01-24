import { Suspense } from 'react'
import ProfileClient from './ProfileClient'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProfileClient />
    </Suspense>
  )
}
