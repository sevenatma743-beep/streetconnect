import useSWR from 'swr'
import { getPosts } from '../lib/supabase'

const fetcher = async ([_, viewerId]) => {
  return await getPosts(null, viewerId || null)
}

export function useFeed(viewerId) {
  const { data, error, isLoading, mutate } = useSWR(
    ['feed', viewerId || null],
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      keepPreviousData: true,
    }
  )

  return {
    posts: data || [],
    error,
    isLoading,
    mutate,
  }
}