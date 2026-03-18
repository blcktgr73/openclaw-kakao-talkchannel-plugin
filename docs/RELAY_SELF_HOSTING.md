# Self-Host Relay 운영 가이드

> occloud 환경에서 kakao relay를 self-host로 운영하기 위한 가이드.

---

## 1. 왜 self-host 하는가

기본 공유 relay(`k.tess.dev`)는 테스트/개인 용도에 적합하지만, 프로덕션 서비스에는 부적합:

| 항목 | 공유 relay | self-host relay |
|------|-----------|----------------|
| 가용성 | 보장 없음 | 직접 관리 |
| 데이터 경로 | 외부 서버 경유 | 자체 서버 내 |
| 카카오 채널 | 공유 (Samantha) | 독립 채널 |
| 브랜딩 | 불가 | 채널명/프로필 자유 |
| 사용자 관리 | 제한적 | Admin UI |

---

## 2. 아키텍처

```
카카오톡 사용자
    ↓ (카카오 i 오픈빌더 webhook)
[kakao-occloud.duckdns.org]
    ↓
[Caddy] → relay:8080 (Go 서버)
    ↓          ↓
[PostgreSQL]  [Redis]  (ClawHub과 공유, DB 분리)
    ↓
SSE 스트림 → OpenClaw Plugin (사용자 VM)
    ↓
sendReply → relay → 카카오톡 응답
```

모든 서비스는 occloud 서버(95.217.213.74)에서 Docker Compose로 실행.

---

## 3. 사전 준비

### 3.1 카카오 i 오픈빌더 챗봇 생성

1. [카카오 비즈니스](https://business.kakao.com/) 에서 카카오톡 채널 생성
2. [카카오 i 오픈빌더](https://i.kakao.com/) 접속
3. **[서비스/도구] → [챗봇] → [나의 챗봇]** → **[+ 봇 만들기] → [카카오톡 챗봇]**
4. 봇 이름 입력 후 생성

### 3.2 스킬 등록

1. 오픈빌더 → **[스킬]** → **[스킬 만들기]**
2. URL: `https://kakao-occloud.duckdns.org/kakao-talkchannel/webhook`
3. 저장

### 3.3 폴백 블록 연결

1. **[시나리오]** → **[폴백 블록]** 선택
2. **[스킬 연결]** → 위에서 만든 스킬 선택
3. 저장 후 **배포**

### 3.4 채널 연결

1. **[설정]** → **[카카오톡 채널 연결]**
2. 생성한 카카오톡 채널 선택 → 연결

---

## 4. 배포

### 4.1 relay DB 생성

```bash
ssh blckt@openclaw
sudo docker exec -it clawhub-postgres-1 \
  psql -U openclaw -c "CREATE DATABASE kakao_relay;"
```

### 4.2 relay 서버 배포

occloud 서버에서:

```bash
cd /root
git clone https://github.com/kakao-bart-lee/kakao-talkchannel-relay-openclaw.git kakao-relay
cd kakao-relay
```

`.env` 파일 생성:

```bash
# DB (ClawHub postgres 컨테이너 사용, kakao_relay DB)
DATABASE_URL=postgresql://openclaw:${DB_PASSWORD}@clawhub-postgres-1:5432/kakao_relay

# Redis (ClawHub redis 컨테이너 사용)
REDIS_URL=redis://clawhub-redis-1:6379

# Admin 인증 (생성 필요)
ADMIN_PASSWORD_HASH=  # make hash-password 로 생성
ADMIN_SESSION_SECRET= # openssl rand -hex 32
PORTAL_SESSION_SECRET= # openssl rand -hex 32

# 카카오 웹훅 검증 (오픈빌더에서 확인)
KAKAO_SIGNATURE_SECRET=

# 서버
PORT=8080
LOG_LEVEL=info
QUEUE_TTL_SECONDS=900
CALLBACK_TTL_SECONDS=55
```

### 4.3 ClawHub docker-compose.prod.yml에 relay 추가

```yaml
  kakao-relay:
    build:
      context: /root/kakao-relay
      dockerfile: Dockerfile
    env_file: /root/kakao-relay/.env
    environment:
      DATABASE_URL: postgresql://openclaw:${DB_PASSWORD}@postgres:5432/kakao_relay
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    restart: unless-stopped
```

### 4.4 Caddyfile에 호스트 추가

```
occloud.duckdns.org {
    reverse_proxy /api/* api:3000
    reverse_proxy frontend:80
}

kakao-occloud.duckdns.org {
    reverse_proxy kakao-relay:8080
}
```

### 4.5 빌드 및 시작

```bash
sudo docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### 4.6 검증

```bash
# Health check
curl https://kakao-occloud.duckdns.org/health

# Admin UI
# 브라우저에서 https://kakao-occloud.duckdns.org/admin/
```

---

## 5. Account 발급

### Admin UI 방식

1. `https://kakao-occloud.duckdns.org/admin/` 접속
2. Admin 비밀번호 로그인
3. Accounts → Create Account
4. `relayToken` 저장 (1회만 표시)

### API 방식

```bash
curl -X POST https://kakao-occloud.duckdns.org/admin/api/accounts \
  -H "Content-Type: application/json" \
  -d '{"openclawUserId": "user-instance-id"}'
```

---

## 6. OpenClaw Plugin 설정

사용자 VM의 `~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "kakao-talkchannel": {
      "accounts": {
        "default": {
          "relayUrl": "https://kakao-occloud.duckdns.org",
          "relayToken": "발급받은_토큰"
        }
      }
    }
  }
}
```

---

## 7. 운영

### 헬스 체크

```bash
curl https://kakao-occloud.duckdns.org/health
```

### 로그 확인

```bash
sudo docker logs clawhub-kakao-relay-1 --tail 50 -f
```

### 장애 점검

| 증상 | 점검 |
|------|------|
| webhook 응답 없음 | `docker logs` 확인, 카카오 오픈빌더 스킬 URL 확인 |
| SSE 연결 실패 | relay health check, 포트 8080 접근 확인 |
| DB 연결 오류 | `docker exec clawhub-postgres-1 psql -U openclaw -d kakao_relay -c '\dt'` |
| 페어링 안 됨 | relay Admin UI에서 account 상태 확인 |

### 환경변수 변경

```bash
# .env 수정 후
sudo docker compose --env-file .env.prod -f docker-compose.prod.yml up -d kakao-relay
```
