from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import pytz
from src.utils.database_util import DatabaseManager
from src.routes.meal import fetch_meal
from firebase_admin import messaging


def _send_meal_notification(meal_type, title, icon):
    """중식/석식 공통 알림 전송 함수"""
    kst = pytz.timezone('Asia/Seoul')
    today = datetime.now(kst).strftime('%Y%m%d')

    meals = fetch_meal(meal_type, today)

    if not meals:
        print(f"[Scheduler] 오늘 {meal_type} 메뉴가 없습니다.")
        return

    menu_text = meals[0].get('메뉴', '메뉴 정보 없음')
    body = f"오늘의 {meal_type} 메뉴:\n{menu_text}"

    db = DatabaseManager()
    tokens_data = db.query("""
        SELECT DISTINCT t.token 
        FROM fcm_tokens t
        JOIN Students s ON t.user_id = s.student_id
        WHERE s.meal_noti_enabled = TRUE
    """).result
    tokens = [t[0] for t in tokens_data] if tokens_data else []

    if not tokens:
        print("[Scheduler] 등록된 FCM 토큰이 없습니다.")
        return

    # 알림 내역 저장 (각 대상 사용자별로)
    db.query(
        """
        INSERT INTO push_notifications (user_id, title, body, icon, link, created_at)
        SELECT DISTINCT s.student_id, %(title)s, %(body)s, %(icon)s, %(link)s, NOW()
        FROM fcm_tokens t
        JOIN Students s ON t.user_id = s.student_id
        WHERE s.meal_noti_enabled = TRUE
        """,
        title=title, body=body, icon=icon, link='https://square.coshsc.kr/meal'
    )
    db.commit()

    batch_size = 500
    for i in range(0, len(tokens), batch_size):
        batch_tokens = tokens[i:i + batch_size]
        message = messaging.MulticastMessage(
            notification=messaging.Notification(
                title=title,
                body=body
            ),
            webpush=messaging.WebpushConfig(
                notification=messaging.WebpushNotification(
                    icon=icon,
                    badge=icon
                ),
                fcm_options=messaging.WebpushFCMOptions(link='https://square.coshsc.kr/meal')
            ),
            tokens=batch_tokens
        )
        try:
            response = messaging.send_each_for_multicast(message)
            print(f"[Scheduler] {meal_type} 알림 전송 완료 (배치 {i//batch_size + 1}). 성공: {response.success_count}, 실패: {response.failure_count}")

            # 실패한 토큰 정리
            if response.failure_count > 0:
                responses = response.responses
                failed_tokens = []
                for idx, resp in enumerate(responses):
                    if not resp.success:
                        # Unregistered, InvalidRegistration 등의 에러면 토큰 삭제
                        if resp.exception and resp.exception.code in ['INVALID_ARGUMENT', 'NOT_FOUND', 'UNREGISTERED']:
                            failed_tokens.append(batch_tokens[idx])

                if failed_tokens:
                    # failed_tokens DB에서 삭제
                    for token in failed_tokens:
                        db.query("DELETE FROM fcm_tokens WHERE token = %(token)s", token=token)
                    db.commit()
                    print(f"[Scheduler] 유효하지 않은 토큰 {len(failed_tokens)}개 삭제됨.")

        except Exception as e:
            print(f"[Scheduler] {meal_type} 알림 전송 실패: {e}")


def send_lunch_menu_notification():
    _send_meal_notification("중식", "오늘의 중식 알림 🍱", "/icon_restaurant.svg")


def send_dinner_menu_notification():
    _send_meal_notification("석식", "오늘의 석식 알림 🍱", "/icon_restaurant.svg")


class NotificationScheduler:
    def __init__(self):
        self.scheduler = BackgroundScheduler(timezone="Asia/Seoul")
        
    def start(self):
        # 중식 알람 11:30
        self.scheduler.add_job(
            send_lunch_menu_notification,
            'cron',
            hour=11,
            minute=30,
            id='lunch_notification_job',
            replace_existing=True
        )
        # 석식 알람 15:30
        self.scheduler.add_job(
            send_dinner_menu_notification,
            'cron',
            hour=15,
            minute=30,
            id='dinner_notification_job',
            replace_existing=True
        )
        self.scheduler.start()
        print("[Scheduler] 급식 알림 스케줄러가 시작되었습니다 (중식 11:30, 석식 15:30)")
