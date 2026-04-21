from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime
import pytz
from src.utils.database_util import DatabaseManager
from src.routes.meal import fetch_meal
from firebase_admin import messaging

def send_lunch_menu_notification():
    # KST 기준 오늘 날짜 가져오기
    kst = pytz.timezone('Asia/Seoul')
    today = datetime.now(kst).strftime('%Y%m%d')
    
    meals = fetch_meal("중식", today)
    
    if not meals:
        print("[Scheduler] 오늘 중식 메뉴가 없습니다.")
        return
        
    menu_text = meals[0].get('메뉴', '메뉴 정보 없음')
    body = f"오늘의 중식 메뉴:\n{menu_text}"
    title = "오늘의 중식 알림 🍱"
    
    db = DatabaseManager()
    tokens_data = db.query("SELECT DISTINCT token FROM fcm_tokens").result
    tokens = [t[0] for t in tokens_data] if tokens_data else []
    
    if not tokens:
        print("[Scheduler] 등록된 FCM 토큰이 없습니다.")
        return
        
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
                    icon='/vite.svg',
                    badge='/vite.svg'
                ),
                fcm_options=messaging.WebpushFCMOptions(link='https://square.coshsc.kr/meal')
            ),
            tokens=batch_tokens
        )
        try:
            response = messaging.send_each_for_multicast(message)
            print(f"[Scheduler] 푸시 알림 전송 완료 (배치 {i//batch_size + 1}). 성공: {response.success_count}, 실패: {response.failure_count}")
            
            # 실패한 토큰 정리 (옵션)
            if response.failure_count > 0:
                responses = response.responses
                failed_tokens = []
                for idx, resp in enumerate(responses):
                    if not resp.success:
                        # Unregistered, InvalidRegistration 등의 에러면 토큰 삭제
                        if resp.exception and resp.exception.code in ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered']:
                            failed_tokens.append(batch_tokens[idx])
                
                if failed_tokens:
                    # failed_tokens DB에서 삭제
                    for token in failed_tokens:
                        db.query("DELETE FROM fcm_tokens WHERE token = %(token)s", token=token)
                    db.commit()
                    print(f"[Scheduler] 유효하지 않은 토큰 {len(failed_tokens)}개 삭제됨.")
                    
        except Exception as e:
            print(f"[Scheduler] 푸시 알림 전송 실패: {e}")

def send_dinner_menu_notification():
    # KST 기준 오늘 날짜 가져오기
    kst = pytz.timezone('Asia/Seoul')
    today = datetime.now(kst).strftime('%Y%m%d')
    
    meals = fetch_meal("석식", today)
    
    if not meals:
        print("[Scheduler] 오늘 석식 메뉴가 없습니다.")
        return
        
    menu_text = meals[0].get('메뉴', '메뉴 정보 없음')
    body = f"오늘의 석식 메뉴:\n{menu_text}"
    title = "오늘의 석식 알림 🍱"
    
    db = DatabaseManager()
    tokens_data = db.query("SELECT DISTINCT token FROM fcm_tokens").result
    tokens = [t[0] for t in tokens_data] if tokens_data else []
    
    if not tokens:
        print("[Scheduler] 등록된 FCM 토큰이 없습니다.")
        return
        
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
                    icon='/fork.svg',
                    badge='/fork.svg'
                ),
                fcm_options=messaging.WebpushFCMOptions(link='https://square.coshsc.kr/meal')
            ),
            tokens=batch_tokens
        )
        try:
            response = messaging.send_each_for_multicast(message)
            print(f"[Scheduler] 석식 알림 전송 완료 (배치 {i//batch_size + 1}). 성공: {response.success_count}, 실패: {response.failure_count}")
            
            if response.failure_count > 0:
                responses = response.responses
                failed_tokens = []
                for idx, resp in enumerate(responses):
                    if not resp.success:
                        if resp.exception and resp.exception.code in ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered']:
                            failed_tokens.append(batch_tokens[idx])
                
                if failed_tokens:
                    for token in failed_tokens:
                        db.query("DELETE FROM fcm_tokens WHERE token = %(token)s", token=token)
                    db.commit()
                    print(f"[Scheduler] 유효하지 않은 토큰 {len(failed_tokens)}개 삭제됨.")
                    
        except Exception as e:
            print(f"[Scheduler] 석식 알림 전송 실패: {e}")

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
