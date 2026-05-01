import { useState, useEffect } from 'react';
import { offlineDb } from '../utils/offlineDb';

/**
 * 온라인: API 호출 → 성공 시 IndexedDB에도 저장 → 반환
 * 오프라인: IndexedDB에서 즉시 반환 + "오프라인 데이터" 플래그
 */
export function useOfflineData(key, fetcher, options = {}) {
  const [data, setData] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!key) return; // key가 없으면 실행 안 함
    
    let cancelled = false;
    
    const load = async () => {
      setLoading(true);
      setError(null);
      // 1) 캐시에서 먼저 로드 (즉시 렌더링)
      const cached = await offlineDb.get(options.store, key);
      if (cached && !cancelled) {
        setData(cached);
        setIsStale(true);
        setLoading(false);
      }

      // 2) 네트워크 요청 시도
      if (navigator.onLine) {
        try {
          const fresh = await fetcher();
          if (!cancelled) {
            setData(fresh);
            setIsStale(false);
            setLoading(false);
            // 캐시 갱신
            await offlineDb.set(options.store, key, fresh);
          }
        } catch (err) {
          if (!cached && !cancelled) {
            setError(err);
            setLoading(false);
          }
        }
      } else if (!cached && !cancelled) {
        setError(new Error('오프라인 상태이며 캐시된 데이터가 없습니다.'));
        setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [key]); // 의존성 배열에 key 포함 (페이지 변경 시 리렌더링)

  // 강제 새로고침용 (수동)
  const refetch = async () => {
    if (!navigator.onLine) return;
    try {
      setLoading(true);
      const fresh = await fetcher();
      setData(fresh);
      setIsStale(false);
      await offlineDb.set(options.store, key, fresh);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return { data, isStale, loading, error, refetch };
}
