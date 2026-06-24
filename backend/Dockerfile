FROM python:3.12-slim

WORKDIR /app

# 종속성 파일 복사 (명령어 실행 시 빌드 컨텍스트를 프로젝트 루트로 지정해야 합니다)
COPY requirements.txt .

# 필요한 패키지 및 gunicorn 설치 (requirements.txt에 gunicorn이 없을 수 있으므로 명시적으로 추가 설치)
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

# 애플리케이션 소스 코드 복사
COPY backend/ ./backend/

# 로컬 config.json 파일은 수정하지 않고, 도커 컨테이너 내부의 config 파일에서만 DB 호스트를 host.docker.internal로 변경

# 작업 디렉토리를 백엔드로 이동
WORKDIR /app/backend

# 환경변수 설정
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# 사용할 포트 노출
EXPOSE 5000

# 서버 실행 (Gunicorn 3 워커 사용)
CMD ["gunicorn", "--workers", "3", "--bind", "0.0.0.0:5000", "app:app"]
