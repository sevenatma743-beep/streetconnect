import { Suspense } from 'react'
import FollowersClient from './FollowersClient'

export default function Page() {
  return (
    <Suspense fallback={null}>
      <FollowersClient />
    </Suspense>
  )
}
