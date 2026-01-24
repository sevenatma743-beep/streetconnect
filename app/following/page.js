import { Suspense } from 'react'
import FollowingClient from './FollowingClient'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FollowingClient />
    </Suspense>
  )
}
