import React, { useState, useEffect, useRef } from 'react';
import { useNetwork } from '../contexts/NetworkContext';
import './OfflineBanner.css';

export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetwork();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState(''); // 'offline' or 'restored'
  const hasShownOfflineRef = useRef(false);

  useEffect(() => {
    let timer;

    if (!isOnline) {
      // 1.5초 이상 오프라인 상태 지속 시 배너 표시 (깜빡임 방지)
      timer = setTimeout(() => {
        setStatus('offline');
        setVisible(true);
        hasShownOfflineRef.current = true;
      }, 1500);
    } else if (isOnline && wasOffline && hasShownOfflineRef.current) {
      // 오프라인 배너를 보여준 적이 있을 때만 복구 배너 표시
      setStatus('restored');
      setVisible(true);
      // 3초 후 복구 배너 숨김
      timer = setTimeout(() => {
        setVisible(false);
        hasShownOfflineRef.current = false;
      }, 3000);
    } else {
      // 그 외의 경우 (온라인 상태) 배너 숨김
      setVisible(false);
    }
    
    return () => clearTimeout(timer);
  }, [isOnline, wasOffline]);

  if (!visible) return null;

  return (
    <div className={`offline-banner ${status}`}>
      {status === 'offline' ? (
        <span>📡 오프라인 모드 — 캐시된 데이터를 표시 중입니다</span>
      ) : (
        <span>✅ 다시 연결되었습니다</span>
      )}
    </div>
  );
}
