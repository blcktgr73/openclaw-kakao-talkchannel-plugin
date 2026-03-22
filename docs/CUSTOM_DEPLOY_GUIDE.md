# 카카오톡 채널 플러그인 — Self-Host Relay 배포 가이드

> 공개 relay(k.tess.dev)를 사용할 수 없는 경우, 자체 relay를 배포하는 가이드.
>
> 전제: 기존 서버에 PostgreSQL, Redis, Caddy(또는 reverse proxy)가 운영 중인 환경.

---

## 전체 구조

```
카카오톡 사용자
  ↓  카카오 i 오픈빌더 webhook
자체 Relay (your-relay.example.com → Caddy → :8080)
  ↓  SSE event stream
OpenClaw + kakao-talkchannel 플러그인
  ↓  HTTP POST /openclaw/reply
Relay → 카카오 → 사용자에게 응답
```

---

## Step 1: 플러그인 설치

```bash
# npm 패키지명으로 설치
openclaw plugins install @openclaw/kakao-talkchannel
```

npm에 publish 안 되어 있으면 GitHub에서 직접 클론 후 로컬 설치:

```bash
git clone https://github.com/<your-fork>/openclaw-kakao-talkchannel-plugin ~/kakao-plugin
cd ~/kakao-plugin && npm install && npm run build
openclaw plugins install -l ~/kakao-plugin
```

---

## Step 2: DNS 설정

relay 서버에 접근할 도메인을 설정합니다. 예시 (DuckDNS):

```bash
curl "https://www.duckdns.org/update?domains=<your-subdomain>&token=<your-duckdns-token>&ip=<your-server-ip>"
# 응답: OK
```

확인:

```bash
nslookup your-relay.example.com
# → <your-server-ip>
```

---

## Step 3: Relay 서버 배포

### 3-1. 코드 클론

```bash
git clone https://github.com/kakao-bart-lee/kakao-talkchannel-relay-openclaw ~/kakao-relay
cd ~/kakao-relay
```

### 3-2. DB 생성

기존 PostgreSQL에 새 데이터베이스 추가:

```bash
# Docker 환경 예시
sudo docker exec <postgres-container> psql -U <db-user> -c "CREATE DATABASE kakao_relay;"
```

### 3-3. 시크릿 생성

> relay repo의 Makefile에 `hash-password` target이 없을 수 있음. 아래 방법으로 직접 생성.

```bash
# Admin 비밀번호 해시 (bcrypt) — htpasswd 없으면 먼저 설치
sudo apt install apache2-utils
htpasswd -nbBC 10 "" "원하는비밀번호" | cut -d: -f2

# 세션 시크릿 (각각 실행해서 결과 메모)
openssl rand -hex 32   # → ADMIN_SESSION_SECRET
openssl rand -hex 32   # → PORTAL_SESSION_SECRET
```

### 3-4. .env 파일 작성

> 같은 docker-compose 안에서는 서비스명(`postgres`, `redis`)으로 접근.
> `?sslmode=disable` — PostgreSQL이 SSL을 사용하지 않는 경우 필수.

```bash
tee ~/kakao-relay/.env << 'EOF'
# === Database (같은 compose 내 서비스명 사용) ===
DATABASE_URL=postgresql://<db-user>:<db-password>@postgres:5432/kakao_relay?sslmode=disable
REDIS_URL=redis://redis:6379

# === Auth ===
ADMIN_PASSWORD_HASH=<htpasswd 결과>
ADMIN_SESSION_SECRET=<openssl rand -hex 32 결과>
PORTAL_SESSION_SECRET=<openssl rand -hex 32 결과>

# === Kakao (오픈빌더 스킬 시그니처 키, 없으면 빈값) ===
KAKAO_SIGNATURE_SECRET=

# === Server ===
PORT=8080
LOG_LEVEL=info
QUEUE_TTL_SECONDS=900
CALLBACK_TTL_SECONDS=55
EOF
```

**주의사항:**
- DB/Redis 호스트: 같은 compose 내 서비스명 사용 (컨테이너명 아님)
- `?sslmode=disable` 빠뜨리면 `pq: SSL is not enabled on the server` 에러

### 3-5. 배포 방식: 기존 docker-compose에 서비스 추가

> relay repo의 `docker-compose.yml`은 개발용(자체 PostgreSQL/Redis 포함). 프로덕션에서는 사용하지 않음.

**docker-compose.yml (개발용) vs 프로덕션 (기존 인프라 통합) 차이:**

| | docker-compose.yml (개발용) | 프로덕션 (기존 인프라 통합) |
|---|---|---|
| **PostgreSQL** | 자체 컨테이너 (port 5433) | 기존 것 공유 |
| **Redis** | 자체 컨테이너 (port 6379) | 기존 것 공유 |
| **서비스 수** | 3개 (postgres + redis + app) | 1개 (app만 추가) |
| **네트워크** | 자체 생성 (내부) | 기존 인프라와 동일 네트워크 |
| **Caddy** | 없음 | 기존 Caddy가 reverse proxy |

기존 docker-compose에 직접 추가하면 Caddy, DB, Redis 모두 같은 네트워크라 설정이 간단합니다.

기존 `docker-compose.prod.yml`의 services에 추가:

```yaml
  kakao-relay:
    build:
      context: /path/to/kakao-relay
      dockerfile: Dockerfile
    env_file: /path/to/kakao-relay/.env
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

> ports 매핑 불필요 — Caddy가 같은 네트워크에서 `kakao-relay:8080`으로 직접 접근.

### 3-6. Caddyfile 수정

기존 Caddyfile에 relay 도메인 블록 추가:

```
your-relay.example.com {
    reverse_proxy kakao-relay:8080
}
```

### 3-7. 빌드 및 실행

```bash
# docker-compose가 있는 디렉토리에서
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

### 3-8. DB migration 실행

> **빌드 후, 헬스체크 전에 반드시 실행.** 테이블이 없으면 relay가 cleanup 에러를 반복.
> `psql -f -` 방식은 적용 안 될 수 있음. `docker exec -i`로 stdin 전달 필수.

```bash
for f in ~/kakao-relay/drizzle/migrations/*.sql; do
  echo "=== Applying $f ==="
  sudo docker exec -i <postgres-container> psql -U <db-user> -d kakao_relay < "$f"
done
```

테이블 생성 확인:

```bash
sudo docker exec <postgres-container> psql -U <db-user> -d kakao_relay -c '\dt'
# 12개 테이블이 보여야 함
```

migration 후 relay 재시작:

```bash
sudo docker restart <kakao-relay-container>
```

### 3-9. 헬스체크

```bash
# 직접 접근
curl -s http://localhost:8080/health

# 도메인으로 접근 (Caddy + TLS)
curl -s https://your-relay.example.com/health
```

Caddy가 새 도메인을 인식 못하면 재시작:

```bash
sudo docker restart <caddy-container>
```

### 트러블슈팅 기록

배포 중 만난 이슈와 해결:

| 증상 | 원인 | 해결 |
|------|------|------|
| `pq: SSL is not enabled on the server` | PostgreSQL에 SSL 미설정 | DATABASE_URL에 `?sslmode=disable` 추가 |
| `relation "xxx" does not exist` | DB migration 미실행 | `docker exec -i`로 `drizzle/migrations/*.sql` 적용 (`psql -f -` 방식은 안 됨) |
| healthcheck 405 Method Not Allowed | wget이 HEAD 요청, 서버는 GET만 지원 | 정상 동작. `curl GET`으로 확인 |
| DB 호스트 연결 실패 | `.env`에 컨테이너명 사용 | 같은 compose 내 서비스명 사용 |
| `.env` 변경 후 반영 안 됨 | `restart`는 환경변수 재로드 안 할 수 있음 | `--force-recreate`로 컨테이너 재생성 |
| `ERR_SSL_PROTOCOL_ERROR` | Caddy가 새 도메인 인증서 미발급 | Caddy 컨테이너 재시작 |
| Admin 로그인 실패 (`invalid_password`) | bcrypt 해시 불일치 또는 `$` 치환 | `nano`로 직접 편집, `printenv`로 컨테이너 내 값 확인 |
| Admin UI 검은 화면 | API가 `items: null` 반환 시 React 크래시 | fork에서 null safety 수정 후 재빌드 배포 |
| `Unrecognized key: "kakao-talkchannel"` | openclaw.json에서 `plugins` 키 사용 | `channels` 키로 변경 (`plugins` 아님) |

---

## Step 4: 카카오 오픈빌더 설정

### 4-1. 카카오 비즈니스 채널

- https://business.kakao.com/ 에서 채널 생성 (또는 기존 채널 사용)
- 채널 ID 메모

### 4-2. 카카오 오픈빌더 (챗봇)

- https://chatbot.kakao.com/ 접속 (또는 https://i.kakao.com/ → 리다이렉트)
- 챗봇 생성 → 위 채널 연결

### 4-3. 스킬 등록

- 오픈빌더 > 스킬 > 스킬 생성
- **URL**: `https://your-relay.example.com/kakao-talkchannel/webhook`
- 시그니처 키가 나오면 `~/kakao-relay/.env`의 `KAKAO_SIGNATURE_SECRET`에 입력 후 relay 재시작

### 4-4. 시나리오 연결

- 폴백 블록(또는 원하는 블록)에 위 스킬 연결
- 배포

---

## Step 5: Relay Admin에서 Account 발급

> Admin UI(`https://your-relay.example.com/admin/`)는 최초 account가 없으면
> React 에러(검은 화면)가 발생합니다. CLI로 account를 생성해야 합니다.

### CLI로 Account 생성

```bash
# 1. CSRF 토큰 획득
curl -s https://your-relay.example.com/admin/login \
  -c /tmp/admin-cookie.txt > /dev/null

# 2. CSRF 토큰 추출
CSRF=$(grep csrf_token /tmp/admin-cookie.txt | awk '{print $NF}')

# 3. 로그인
curl -s -X POST https://your-relay.example.com/admin/api/login \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -b /tmp/admin-cookie.txt \
  -c /tmp/admin-cookie.txt \
  -d '{"password":"<3-3에서 설정한 비밀번호>"}'
# → {"success":true}

# 4. CSRF 토큰 재추출 (로그인 후 갱신됨)
CSRF=$(grep csrf_token /tmp/admin-cookie.txt | awk '{print $NF}')

# 5. Account 생성
curl -s -X POST https://your-relay.example.com/admin/api/accounts \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: $CSRF" \
  -b /tmp/admin-cookie.txt \
  -d '{"name":"default"}'
# → {"relayToken":"...","id":"...",...}

# 6. 정리
rm /tmp/admin-cookie.txt
```

응답에서 `relayToken` 값을 메모. 이후 Admin UI도 정상 접근 가능.

### 트러블슈팅

| 증상 | 원인 | 해결 |
|------|------|------|
| Admin UI 검은 화면 + `Cannot read properties of null` | account가 0개일 때 React 크래시 | CLI로 account 먼저 생성 |
| `Missing CSRF token` | CSRF 토큰 미포함 | GET으로 쿠키 획득 후 `X-CSRF-Token` 헤더 포함 |
| 로그인 실패 (`invalid_password`) | bcrypt 해시 불일치 | `printenv`로 컨테이너 내 값 확인, `--force-recreate`로 반영 |

---

## Step 6: 플러그인 설정 (relay 연결)

> **주의**: 설정 키는 `plugins`가 아니라 `channels`. `plugins`를 사용하면 `Unrecognized key` 에러 발생.

`~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "kakao-talkchannel": {
      "accounts": {
        "default": {
          "enabled": true,
          "relayUrl": "https://your-relay.example.com/",
          "relayToken": "<Step 5에서 발급한 토큰>",
          "dmPolicy": "pairing",
          "channelId": "<카카오 채널 ID>"
        }
      }
    }
  }
}
```

게이트웨이 재시작:

```bash
openclaw gateway restart
openclaw channels list   # kakao-talkchannel 확인
```

---

## Step 7: 페어링 및 테스트

```bash
openclaw tui
```

1. "카카오톡 연결해줘" → 페어링 코드 수신 (예: `ABCD-1234`)
2. 카카오톡에서 자체 채널 친구 추가
3. 채팅창에 `/pair ABCD-1234` 입력
4. "연결 완료" 확인
5. 테스트 메시지 → 응답 확인

---

## 문제 해결

```bash
# Relay 로그
sudo docker logs <kakao-relay-container> --tail 50

# DB 테이블 확인
sudo docker exec <postgres-container> psql -U <db-user> -d kakao_relay -c '\dt'

# Caddy 로그
sudo docker logs <caddy-container> --tail 20

# Relay 재시작
docker compose -f docker-compose.prod.yml restart kakao-relay

# Caddy 재시작 (도메인 인식 안 될 때)
sudo docker restart <caddy-container>

# 전체 재배포
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

---

## 체크리스트

```
[ ] 1. 플러그인 설치
[ ] 2. DNS 도메인 설정
[ ] 3. Relay 코드 클론 (~/kakao-relay)
[ ] 4. PostgreSQL에 kakao_relay DB 생성
[ ] 5. 시크릿 생성 + .env 작성 (sslmode=disable, 서비스명 사용)
[ ] 6. docker-compose.prod.yml에 kakao-relay 서비스 추가
[ ] 7. Caddyfile에 relay 도메인 추가
[ ] 8. docker compose up -d --build
[ ] 9. DB migration 실행
[ ] 10. 헬스체크 통과
[ ] 11. 카카오 비즈니스 채널 + 오픈빌더 설정
[ ] 12. Relay admin에서 Account + relayToken 발급
[ ] 13. 플러그인 설정 (channels 키, relayUrl, relayToken)
[ ] 14. 페어링 + 테스트 메시지 성공
```

---

## 설정 레퍼런스

| 키 | 설명 | 기본값 |
|----|------|--------|
| `enabled` | 채널 활성화 | `true` |
| `relayUrl` | Relay 서버 URL | `https://k.tess.dev/` |
| `relayToken` | Relay 인증 토큰 (self-host 시 필수) | — |
| `sessionToken` | 자동 생성 (pairing 후) | — |
| `dmPolicy` | `pairing` / `allowlist` / `open` / `disabled` | `pairing` |
| `channelId` | 카카오 채널 식별자 | — |
| `textChunkLimit` | 메시지 분할 길이 (100-1000) | `400` |
| `chunkMode` | `sentence` / `newline` / `length` | `sentence` |
| `reconnectDelayMs` | SSE 재연결 초기 딜레이 (500-10000ms) | `1000` |
| `maxReconnectDelayMs` | SSE 재연결 최대 딜레이 (5000-60000ms) | `30000` |
