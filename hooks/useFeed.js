import useSWRInfinite from 'swr/infinite'
import { getPostsPage } from '../lib/supabase'

const PAGE_SIZE = 20

export function useFeed(viewerId) {
  const getKey = (pageIndex, previousPageData) => {
    if (!viewerId) return null
    if (previousPageData && previousPageData.length < PAGE_SIZE) return null
    if (pageIndex === 0) return ['feed', null, null, viewerId]
    const last = previousPageData.at(-1)
    return ['feed', last.created_at, last.id, viewerId]
  }

  const fetcher = async ([_, cursorCreatedAt, cursorId, vid]) => {
    const cursor = cursorCreatedAt ? { created_at: cursorCreatedAt, id: cursorId } : null
    return await getPostsPage(cursor, vid || null)
  }

  const { data, error, isLoading, isValidating, mutate, size, setSize } = useSWRInfinite(
    getKey,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
      keepPreviousData: true,
    }
  )

  const lastPage = data ? data[data.length - 1] : null
  const hasMore = lastPage ? lastPage.length === PAGE_SIZE : false
  const isLoadingMore = isValidating && !!data && data.length > 0 && !isLoading

  return {
    posts: data ? data.flat() : [],
    error,
    isLoading,
    isLoadingMore,
    hasMore,
    mutate,
    loadMore: () => setSize(size + 1),
  }
}
