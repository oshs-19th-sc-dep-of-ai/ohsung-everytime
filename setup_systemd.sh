#!/bin/bash

# 1. 현재 접속한 사용자와 그룹 자동 추출
CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)

# 2. 이 스크립트가 실행되는 현재 디렉토리 추출 (ohsung-everytime 폴더에서 실행한다고 가정)
PROJECT_DIR=$(pwd)
BACKEND_DIR="$PROJECT_DIR/backend"
VENV_DIR="$PROJECT_DIR/.venv"

SERVICE_FILE="ohsung-everytime-backend.service"

echo "현재 서버 환경 정보 수집 완료!"
echo " - 사용자: $CURRENT_USER"
echo " - 그룹: $CURRENT_GROUP"
echo " - 프로젝트 경로: $PROJECT_DIR"
echo ""

# 3. 환경에 맞춘 systemd 설정 파일 자동 생성
cat <<EOF > $SERVICE_FILE
[Unit]
Description=Ohsung Everytime Backend (Gunicorn/Flask)

[Service]
User=$CURRENT_USER
Group=$CURRENT_GROUP
WorkingDirectory=$BACKEND_DIR
Environment="PATH=$VENV_DIR/bin"
Environment="FLASK_ENV=production"

# Gunicorn을 사용할 경우의 시작 명령어
ExecStart=$VENV_DIR/bin/gunicorn --workers 3 --bind 0.0.0.0:5000 app:app

Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

echo "✅ [$SERVICE_FILE] 파일이 현재 서버 환경에 맞게 자동 작성되었습니다!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "이제 다음 명령어들을 복사해서 바로 붙여넣기 하시면 등록이 완료됩니다."
echo ""
echo "sudo cp $SERVICE_FILE /etc/systemd/system/"
echo "sudo systemctl daemon-reload"
echo "sudo systemctl enable ohsung-everytime-backend"
echo "sudo systemctl start ohsung-everytime-backend"
echo "sudo systemctl status ohsung-everytime-backend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
