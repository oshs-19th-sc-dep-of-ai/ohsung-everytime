from dataclasses import dataclass
from typing import Any, List, Optional, Dict
import pymysql
import threading

@dataclass
class QueryResult:
    affected_rows: Optional[int]
    result: Any

class __DatabaseManager(type):
    __instances = {}
    def __call__(cls, *args, **kwargs):
        if cls not in cls.__instances:
            instance = super().__call__(*args, **kwargs)
            cls.__instances[cls] = instance
        return cls.__instances[cls]

class DatabaseManager(metaclass=__DatabaseManager):
    """
    데이터베이스와 상호작용을 관리하는 클래스.
    오직 하나의 인스턴스만 생성됨.
    """
    def __init__(self) -> None:
        self.db_conn: Optional[pymysql.connections.Connection] = None
        self._conn_kwargs: Optional[Dict[str, Any]] = None
        self.cursor = None  # 호환용
        self._lock = threading.RLock()

    def connect(self, host: str, username: str, password: str) -> None:
        self._conn_kwargs = dict(
            host=host,
            user=username,
            passwd=password,
            db="student24_db",
            charset="utf8mb4",
            autocommit=True,
        )
        # 최초 연결
        self.db_conn = pymysql.connect(**self._conn_kwargs)
        self.cursor = self.db_conn.cursor()  # 호환용(실제 쿼리엔 새 커서 사용)

        with self.db_conn.cursor() as cur:
            cur.execute("SET time_zone = '+09:00'")

    def _ensure_conn(self) -> None:
        if not self.db_conn:
            assert self._conn_kwargs is not None, "Database not configured. Call connect() first."
            self.db_conn = pymysql.connect(**self._conn_kwargs)
            self.cursor = self.db_conn.cursor()
        else:
            self.db_conn.ping(reconnect=True)

    def _reconnect(self) -> None:
        # 강제 재연결
        try:
            if self.db_conn:
                self.db_conn.close()
        except Exception:
            pass
        finally:
            self.db_conn = None
        self._ensure_conn()

    def _exec_with_retry(self, sql: str, params: Dict[str, Any]) -> QueryResult:
        """
        끊김(InterfaceError/OperationalError) 발생 시 1회 재연결 후 재시도
        """
        with self._lock:
            self._ensure_conn()
            try:
                with self.db_conn.cursor() as cur:
                    affected = cur.execute(sql, params)
                    rows = cur.fetchall()
                return QueryResult(affected, rows)
            except (pymysql.err.InterfaceError, pymysql.err.OperationalError):
                # 재연결 후 한 번 더
                self._reconnect()
                with self.db_conn.cursor() as cur:
                    affected = cur.execute(sql, params)
                    rows = cur.fetchall()
                return QueryResult(affected, rows)

    def query(self, sql: str, **kwargs) -> QueryResult:
        """
        쿼리를 실행함
        :param sql: 실행할 SQL문
        :param kwargs: 인자로 들어갈 객체들의 딕셔너리
        :return: `QueryResult` 타입의 결과
        """
        params = kwargs or {}
        return self._exec_with_retry(sql, params)

    def query_many(self, sql: str, args: List[Any]) -> QueryResult:
        """
        다수의 데이터를 처리할 수 있는 `query` 메서드.
        (현 프로젝트에서는 dict 기반 바인딩에 사용)
        """
        params = args if isinstance(args, dict) else {}
        return self._exec_with_retry(sql, params)

    def commit(self) -> None:
        with self._lock:
            if self.db_conn:
                self.db_conn.commit()

    def close(self) -> None:
        with self._lock:
            if self.db_conn:
                try:
                    self.db_conn.close()
                finally:
                    self.db_conn = None
                    self.cursor = None

    def fetch_all(self, sql: str, **kwargs) -> List[Dict[str, Any]]:
        """
        SELECT 결과를 딕셔너리 리스트로 반환.
        기본 커서가 튜플을 반환하므로, cursor.description으로 컬럼명을 읽어 dict로 매핑.
        """
        params = kwargs or {}
        with self._lock:
            self._ensure_conn()
            try:
                with self.db_conn.cursor() as cur:
                    cur.execute(sql, params)
                    rows = cur.fetchall()
                    cols = [d[0] for d in (cur.description or [])]
            except (pymysql.err.InterfaceError, pymysql.err.OperationalError):
                self._reconnect()
                with self.db_conn.cursor() as cur:
                    cur.execute(sql, params)
                    rows = cur.fetchall()
                    cols = [d[0] for d in (cur.description or [])]

            if not rows:
                return []
            # 이미 dict를 주는 커서가 아니라면(기본 튜플), dict로 변환
            if not isinstance(rows[0], dict):
                return [dict(zip(cols, r)) for r in rows]
            return rows  # 혹시 DictCursor로 바뀌어도 호환

    def fetch_one(self, sql: str, **kwargs) -> Optional[Dict[str, Any]]:
        """
        SELECT 한 건을 딕셔너리로 반환. 없으면 None.
        """
        rows = self.fetch_all(sql, **kwargs)
        return rows[0] if rows else None
