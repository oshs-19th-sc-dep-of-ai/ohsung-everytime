#!/bin/bash
set -e

echo "=== Ohsung Backend 배포 시작 ==="

cd /opt/ohsung-backend

# config.json 확인
if [ ! -f config.json ]; then
    cp config.json.example config.json
    echo "config.json이 생성되었습니다. 내용을 수정하세요."
    exit 1
fi

echo "Git 저장소 최신화..."
cd /opt/ohsung-everytime
git pull --rebase

echo "Docker 이미지 빌드 및 서비스 시작..."
cd /opt/ohsung-backend
docker compose down
docker compose up -d --build --remove-orphans

echo ""
echo "=== 배포 완료 ==="
docker compose ps
