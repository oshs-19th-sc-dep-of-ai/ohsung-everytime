from firebase_admin import messaging
from src.utils.database_util import DatabaseManager


def send_push_notification(user_id, title, body, data=None, icon=None, link=None):
    """
    특정 사용자에게 푸시 알림을 전송하고 내역을 저장합니다.
    
    :param user_id: 수신자 학생 ID (None이면 전체 발송)
    :param title: 알림 제목
    :param body: 알림 내용
    :param data: 추가 데이터 (선택)
    :param icon: 알림 아이콘 URL (선택)
    :param link: 클릭 시 이동할 링크 (선택)
    :return: 성공 여부
    """
    db = DatabaseManager()
    
    # 대상 토큰 조회
    if user_id:
        tokens_data = db.query(
            "SELECT token FROM fcm_tokens WHERE user_id = %(user_id)s",
            user_id=user_id
        ).result
    else:
        tokens_data = db.query("SELECT DISTINCT token FROM fcm_tokens").result
    
    tokens = [t[0] for t in tokens_data] if tokens_data else []
    
    if not tokens:
        return False
    
    # 알림 내역 저장
    db.query(
        """
        INSERT INTO push_notifications (user_id, title, body, data, icon, link, created_at)
        VALUES (%(user_id)s, %(title)s, %(body)s, %(data)s, %(icon)s, %(link)s, NOW())
        """,
        user_id=user_id, title=title, body=body, data=str(data) if data else None,
        icon=icon, link=link
    )
    
    # 배치 전송 (최대 500개씩)
    batch_size = 500
    success_count = 0
    
    for i in range(0, len(tokens), batch_size):
        batch_tokens = tokens[i:i + batch_size]
        
        msg = messaging.MulticastMessage(
            tokens=batch_tokens,
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    icon=icon, badge=icon
                ),
                fcm_options=messaging.WebpushFCMOptions(link=link) if link else None
            )
        )
        
        try:
            response = messaging.send_each_for_multicast(msg)
            success_count += response.success_count
            
            # 실패한 토큰 정리
            if response.failure_count > 0:
                failed_tokens = []
                for idx, resp in enumerate(response.responses):
                    if not resp.success:
                        if resp.exception and resp.exception.code in ['INVALID_ARGUMENT', 'NOT_FOUND', 'UNREGISTERED']:
                            failed_tokens.append(batch_tokens[idx])
                
                if failed_tokens:
                    for token in failed_tokens:
                        db.query("DELETE FROM fcm_tokens WHERE token = %(token)s", token=token)
                    db.commit()
        except Exception as e:
            print(f"[Notification] 푸시 전송 실패: {e}")
    
    db.commit()
    return success_count > 0
