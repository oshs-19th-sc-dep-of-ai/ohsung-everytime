from flask                 import Flask
from flask_cors            import CORS
from flask_session         import Session

from src.utils.database_util import DatabaseManager
from src.utils.config_util import ConfigManager as Config

from src.routes.auth import auth_bp
from src.routes.comments import comments_bp
from src.routes.meal import meal_bp
from src.routes.notifications import notifications_bp
from src.routes.posts import posts_bp

from src.utils.firebase_util import FirebaseManager

app = Flask(__name__)
app.json.sort_keys = False

# 프론트엔드와 세션 유지 가능하게 설정 (프론트엔드에서 꼭 withCredentials: true 확인!)
ALLOWED_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
CORS(app, supports_credentials=True, resources={r"/*": {"origins": ALLOWED_ORIGINS}})
Config().read_file("config.json")

# Flask 세션 설정 추가
app.config['SECRET_KEY']         = Config().get()["Session"]["Key"]
app.config['SESSION_TYPE']       = Config().get()["Session"]["Type"]
app.config['SESSION_PERMANENT']  = Config().get()["Session"]["Permanent"]
app.config['SESSION_USE_SIGNER'] = Config().get()["Session"]["UseSigner"]
app.config['SESSION_KEY_PREFIX'] = Config().get()["Session"]["KeyPrefix"]

# ★ 로컬 개발환경에서 쿠키 전달 보장 (CORS + 다른 포트 사용 시 필수)
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'   # 프론트/백엔드 포트가 달라도 쿠키 전달
app.config['SESSION_COOKIE_SECURE']   = False   # http 환경에서는 False (https에서만 True)
app.config["JSON_SORT_KEYS"] = False

Session(app)

# 데이터베이스 연결 초기화
DatabaseManager().connect(
    host     = Config().get()["Database"]["Host"],
    username = Config().get()["Database"]["Username"],
    password = Config().get()["Database"]["Password"],
)

# Firebase Admin SDK 초기화 (FCM 푸시 알림)
FirebaseManager().initialize()

# 블루프린트 등록
app.register_blueprint(auth_bp)           # 로그인 & 로그아웃
app.register_blueprint(comments_bp)       # 댓글
app.register_blueprint(meal_bp)           # 급식
app.register_blueprint(notifications_bp)  # FCM 토큰 관리
app.register_blueprint(posts_bp)          # 게시물

if __name__ == '__main__':
    try:
        app.run(debug=True)
    except KeyboardInterrupt:
        DatabaseManager().close()
