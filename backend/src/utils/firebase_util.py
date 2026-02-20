import firebase_admin
from firebase_admin import credentials, messaging

from .config_util import ConfigManager as Config


class __FirebaseManager(type):
    __instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls.__instances:
            instance = super().__call__(*args, **kwargs)
            cls.__instances[cls] = instance
        return cls.__instances[cls]


class FirebaseManager(metaclass=__FirebaseManager):
    """
    Firebase Admin SDK 초기화를 담당하는 싱글턴 유틸리티.

    사용법:
        FirebaseManager().initialize()

    이후 FCM 메시지 전송 시:
        from firebase_admin import messaging
        # messaging.send(...) 호출
    """

    def initialize(self):
        """Firebase Admin SDK를 초기화합니다. 이미 초기화된 경우 무시합니다."""
        if firebase_admin._apps:
            return  # 이미 초기화됨

        firebase_config = Config().get().get("Firebase", {})
        credentials_path = firebase_config.get("CredentialsPath", "firebase_credentials.json")
        project_id       = firebase_config.get("ProjectId")

        try:
            cred = credentials.Certificate(credentials_path)
            options = {}
            if project_id:
                options["projectId"] = project_id

            firebase_admin.initialize_app(cred, options)
            print(f"[Firebase] 초기화 완료 (project: {project_id})")
        except FileNotFoundError:
            print(
                f"[Firebase] 경고: 서비스 계정 키 파일을 찾을 수 없습니다 → '{credentials_path}'\n"
                f"           Firebase Console에서 서비스 계정 키를 다운로드 후 해당 경로에 배치하세요."
            )
        except Exception as e:
            print(f"[Firebase] 초기화 실패: {e}")
