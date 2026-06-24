import time
from src.utils.scheduler_util import NotificationScheduler

if __name__ == "__main__":
    print("[Scheduler] 전용 스케줄러 프로세스 시작")
    scheduler = NotificationScheduler()
    scheduler.start()
    while True:
        time.sleep(3600)
