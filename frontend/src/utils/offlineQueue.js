import { offlineDb } from './offlineDb';

export const offlineQueue = {
  /**
   * 오프라인 큐에 작업 추가
   * @param {Object} action - { url, method, body }
   */
  async enqueue(action) {
    // 큐 항목 수 제한 (최대 50개) - 무한 대기 방지
    const pending = await offlineDb.getAllPending();
    if (pending.length >= 50) {
      alert("오프라인 상태에서 대기 중인 작업이 너무 많습니다. 연결이 복구될 때까지 기다려주세요.");
      return;
    }

    await offlineDb.enqueue({
      ...action,
      status: 'pending',
      timestamp: Date.now(),
      retryCount: 0,
    });
  },

  /**
   * 온라인 복귀 시 대기 중인 모든 작업을 순서대로 실행
   */
  async syncAll() {
    const pending = await offlineDb.getAllPending();
    
    if (pending.length === 0) return false;

    console.log(`[Offline Queue] ${pending.length}개의 대기 중인 작업 동기화 시작...`);
    let synced = false;
    
    for (const item of pending) {
      try {
        const options = {
          method: item.method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        };
        if (item.body) {
          options.body = JSON.stringify(item.body);
        }

        const response = await fetch(item.url, options);
        
        if (response.status === 401) {
          // 세션 만료 처리: 큐 작업을 보류하고 로그인 페이지로 강제 이동
          console.warn("[Offline Queue] 세션이 만료되었습니다. 로그인이 필요합니다.");
          alert("세션이 만료되었습니다. 로그인 페이지로 이동합니다.");
          window.location.href = "/login";
          break; // 동기화 중단
        }

        if (response.ok) {
          await offlineDb.markCompleted(item.queueId);
          console.log(`[Offline Queue] 작업 완료: ${item.method} ${item.url}`);
          synced = true;
        } else {
          await offlineDb.incrementRetry(item.queueId);
          console.warn(`[Offline Queue] 작업 실패 (서버 오류): ${item.method} ${item.url}`);
        }
      } catch (err) {
        // 여전히 오프라인이거나 서버 에러 → 다음 동기화에서 재시도
        console.error(`[Offline Queue] 동기화 중 오류 발생 (네트워크 등):`, err);
        break; // 하나라도 네트워크 에러 발생 시 이후 작업 중단 (순서 보장)
      }
    }

    // 완료된 항목 정리
    await offlineDb.clearCompleted();
    
    // 동기화 완료 이벤트 발생 (UI 업데이트 용도)
    window.dispatchEvent(new Event('offline-queue-synced'));
    
    return synced;
  },
};
