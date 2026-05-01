import { openDB } from 'idb';

const DB_NAME = 'ohsung-offline';
const DB_VERSION = 1;

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    // 게시글 목록 캐시
    if (!db.objectStoreNames.contains('posts')) {
      db.createObjectStore('posts', { keyPath: 'id' });
    }
    // 게시글 상세 + 댓글
    if (!db.objectStoreNames.contains('postDetails')) {
      db.createObjectStore('postDetails', { keyPath: 'postId' });
    }
    // 급식 데이터
    if (!db.objectStoreNames.contains('meals')) {
      db.createObjectStore('meals', { keyPath: 'dateKey' });
    }
    // 오프라인 쓰기 큐
    if (!db.objectStoreNames.contains('offlineQueue')) {
      const store = db.createObjectStore('offlineQueue', { 
        keyPath: 'queueId', 
        autoIncrement: true 
      });
      store.createIndex('by-status', 'status');
    }
  },
});

export const offlineDb = {
  // ── 범용 (Getter/Setter) ──
  async get(storeName, key) {
    const db = await dbPromise;
    const record = await db.get(storeName, key);
    
    // 30일(밀리초) 상수 정의
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    if (record) {
        // timestamp가 없거나(구버전 데이터), 30일이 지난 데이터면 만료 처리
        if (!record.timestamp || (Date.now() - record.timestamp > THIRTY_DAYS_MS)) {
            await db.delete(storeName, key);
            return null;
        }

        // 래핑된 value 속성이 있으면 그것을 반환
        if (record.hasOwnProperty('value')) {
            return record.value;
        }
        return record;
    }
    return null;
  },
  
  async set(storeName, key, value) {
    const db = await dbPromise;
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const keyPath = store.keyPath;
    
    // timestamp와 함께 저장
    await store.put({ 
      [keyPath]: key, 
      value: value,
      timestamp: Date.now()
    });
    await tx.done;
  },

  async delete(storeName, key) {
    const db = await dbPromise;
    return db.delete(storeName, key);
  },
  
  // ── Offline Queue ──
  async enqueue(action) {
    const db = await dbPromise;
    return db.add('offlineQueue', action);
  },

  async getAllPending() {
    const db = await dbPromise;
    const index = db.transaction('offlineQueue').store.index('by-status');
    return index.getAll('pending');
  },

  async markCompleted(queueId) {
    const db = await dbPromise;
    const item = await db.get('offlineQueue', queueId);
    if (item) {
      item.status = 'completed';
      return db.put('offlineQueue', item);
    }
  },

  async incrementRetry(queueId) {
    const db = await dbPromise;
    const item = await db.get('offlineQueue', queueId);
    if (item) {
      item.retryCount = (item.retryCount || 0) + 1;
      return db.put('offlineQueue', item);
    }
  },

  async clearCompleted() {
    const db = await dbPromise;
    const tx = db.transaction('offlineQueue', 'readwrite');
    const index = tx.store.index('by-status');
    const completedKeys = await index.getAllKeys('completed');
    for (const key of completedKeys) {
      tx.store.delete(key);
    }
    await tx.done;
  }
};
