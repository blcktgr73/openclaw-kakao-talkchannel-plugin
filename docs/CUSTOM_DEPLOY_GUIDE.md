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
  ↓  SSE event stream (sessionToken 인증)
OpenClaw + kakao-talkchannel 플러그인
  ↓  HTTP POST /openclaw/reply
Relay → 카카오 → 사용자에게 응답
```

### 인증 흐름

```
플러그인 시작
  ↓
sessionToken 있음? → 바로 SSE 연결
  ↓ (없음)
POST /v1/sessions/create → sessionToken + pairingCode 수신
  ↓
사용자에게 pairingCode 안내 → 카카오톡에서 /pair 입력
  ↓
pairing 완료 → sessionToken으로 SSE 연결
  ↓
sessionToken 자동 저장 (다음 재시작 시 재사용)
```

> **중요**: relay 서버의 SSE 엔드포인트(`/v1/events`)는 `sessionToken`으로만 인증합니다.
> Admin에서 발급하는 `relayToken`은 API 계정 관리용이며, SSE 인증에는 사용되지 않습니다.
> 플러그인 설정에 `relayToken`을 넣으면 오히려 401 에러가 발생합니다.

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

### 3-10. Admin Account 생성 (선택)

> Admin UI는 relay 서버 관리용입니다. Account/relayToken은 **API 관리용**이며,
> 플러그인 인증(SSE)에는 사용되지 않습니다.
>
> Admin UI(`https://your-relay.example.com/admin/`)는 최초 account가 없으면
> React 에러(검은 화면)가 발생합니다. Admin을 사용하려면 CLI로 먼저 생성하세요.

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
| SSE 401 `invalid token attempt` | `relayToken`으로 SSE 접속 시도 | `relayToken` 제거, pairing 플로우 사용 (아래 Step 5 참고) |
| 카카오톡 "이해하기 어려워요" 응답 | 폴백 블록에 스킬이 연결 안 됨 | 폴백 블록 > 봇 응답을 "스킬 데이터"로 변경 > 스킬 선택 > 배포 |

---

## Step 4: 카카오 오픈빌더 설정

### 4-1. 카카오 비즈니스 채널

- https://business.kakao.com/ 에서 채널 생성 (또는 기존 채널 사용)
- 채널 ID 메모

### 4-2. 카카오 오픈빌더 (챗봇)

- https://chatbot.kakao.com/ 접속 (또는 https://i.kakao.com/ → 리다이렉트)
- 챗봇 생성 → 위 채널 연결

### 4-3. 스킬 등록

- 오픈빌더 > **스킬** 메뉴 > 스킬 생성
- **URL**: `https://your-relay.example.com/kakao-talkchannel/webhook`
- 시그니처 키가 나오면 `~/kakao-relay/.env`의 `KAKAO_SIGNATURE_SECRET`에 입력 후 relay 재시작

### 4-4. 시나리오 연결 (중요 — 놓치기 쉬움)

> **주의**: 스킬을 등록만 해서는 동작하지 않습니다. 시나리오 블록에서 **스킬 데이터 응답**으로 연결해야 합니다.
> 이 단계를 빠뜨리면 카카오톡에서 "이해하기 어려워요" 기본 응답만 나옵니다.

1. 오픈빌더 > **시나리오** > **폴백 블록** 선택
2. 블록 하단 **봇 응답** 영역에서:
   - 기존 텍스트 응답이 있으면 **삭제**
   - 응답 타입을 **"스킬 데이터"**로 선택
   - 드롭다운에서 4-3에서 만든 스킬 선택
3. **저장**
4. 오픈빌더 상단 **배포** 버튼 클릭

> 배포하지 않으면 변경 사항이 반영되지 않습니다. 스킬/시나리오 변경 후 반드시 배포.

---

## Step 5: 플러그인 설정 및 페어링

> **주의**: 설정 키는 `plugins`가 아니라 `channels`.
> `relayToken`은 설정하지 않습니다 (SSE 인증에 사용되지 않음).

### 5-1. openclaw.json 설정

`~/.openclaw/openclaw.json`:

```json
{
  "channels": {
    "kakao-talkchannel": {
      "accounts": {
        "default": {
          "enabled": true,
          "relayUrl": "https://your-relay.example.com/",
          "dmPolicy": "pairing",
          "channelId": "<카카오 채널 ID>"
        }
      }
    }
  }
}
```

> `relayToken` 없이 설정하면, 플러그인이 자동으로 세션을 생성하고 pairing 플로우를 시작합니다.

### 5-2. 게이트웨이 재시작

```bash
openclaw gateway restart
openclaw channels list   # kakao-talkchannel 확인
```

### 5-3. 페어링

```bash
openclaw tui
```

1. "카카오톡 연결해줘" → 페어링 코드 수신 (예: `ABCD-1234`)
2. 카카오톡에서 자체 채널 친구 추가
   - 채널이 검색에 안 나오면: 채널이 **공개** 상태인지 확인 (카카오 비즈니스 > 채널 설정)
   - 공개 직후에는 검색에 반영되지 않을 수 있음 → 채널 URL로 직접 접근하여 추가
3. 채팅창에 `/pair ABCD-1234` 입력
4. `✅ OpenClaw에 연결되었습니다!` 확인
5. 테스트 메시지 전송

> 페어링 성공 시 `sessionToken`이 자동 저장됩니다. 이후 재시작해도 자동 연결됩니다.
> 코드에는 만료 시간이 있습니다. tui에서 코드를 받으면 즉시 입력하세요.

---

## Step 6: 콜백 설정 (카카오 오픈빌더)

> **필수**: 콜백이 없으면 relay가 카카오톡에 응답을 돌려보낼 수 없습니다.

### 왜 콜백이 필요한가

카카오 오픈빌더 스킬은 기본적으로 **5초 이내 즉시 응답**만 지원합니다.
OpenClaw(AI 챗봇)의 응답 생성에는 5초 이상 걸리므로, 즉시 응답 후 **콜백 URL로 비동기 응답**을 보내야 합니다.

콜백 없이 동작하는 부분:
- 카카오 → relay → OpenClaw 메시지 전달 ✅
- OpenClaw 처리 + 응답 생성 ✅

콜백 없이 동작하지 않는 부분:
- relay → 카카오톡 응답 전달 ❌ (`no valid callback URL for reply` 에러)

### 콜백 심사 신청

오픈빌더 > **설정** > 콜백 사용 신청:
- **목적**: AI 챗봇 서비스 (OpenClaw 기반)
- **사유 예시**: "AI 응답 생성에 5초 이상 소요되어 비동기 콜백이 필요합니다"

심사 통과 후 콜백이 활성화되면 webhook에 `callbackUrl`이 포함되어 전달됩니다.

### 콜백 승인 후 확인

```bash
# relay 로그에서 hasCallback=true 확인
sudo docker logs <kakao-relay-container> -f --tail 5
# 카카오톡에서 메시지 전송 → 로그에 hasCallback=true가 보여야 함
```

---

## 디버깅 가이드

### 동작 확인 흐름

```
카카오톡 메시지 전송
  ↓
relay 로그: "received kakao webhook" + hasCallback=true/false
  ↓
relay 로그: "inbound message created"
  ↓
SSE로 OpenClaw에 전달 (플러그인이 수신)
  ↓
OpenClaw 처리 후 relay로 응답: "/openclaw/reply" 200
  ↓
relay → 카카오 콜백 URL로 응답 전달
```

### relay 로그에서 확인할 항목

```bash
# 실시간 로그 (카카오톡에서 메시지 보내면서 확인)
sudo docker logs <kakao-relay-container> -f --tail 5

# 주요 키워드 필터
sudo docker logs <kakao-relay-container> --tail 100 2>&1 | \
  grep -i "webhook\|message\|callback\|reply\|error\|warn\|pair"
```

| 로그 메시지 | 의미 |
|------------|------|
| `received kakao webhook` | 카카오에서 메시지 도착 |
| `hasCallback=true` | 콜백 URL 포함 (응답 전달 가능) |
| `hasCallback=false` | 콜백 미승인 (응답 전달 불가) |
| `inbound message created` | 메시지 DB 저장 + SSE 발행 |
| `no valid callback URL for reply` | 콜백 없어서 응답 전달 실패 |
| `invalid token attempt` | SSE 인증 실패 (relayToken 사용 시) |
| `pairing_complete` | 페어링 성공 |

### DB 상태 확인

```bash
# 세션 상태
sudo docker exec <postgres-container> psql -U <db-user> -d kakao_relay \
  -c "SELECT id, pairing_code, status, account_id FROM sessions ORDER BY created_at DESC LIMIT 5;"

# 최근 메시지
sudo docker exec <postgres-container> psql -U <db-user> -d kakao_relay \
  -c "SELECT id, account_id, status, created_at FROM inbound_messages ORDER BY created_at DESC LIMIT 5;"
```

---

## 기타 문제 해결

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
[x] 1. 플러그인 설치
[x] 2. DNS 도메인 설정
[x] 3. Relay 코드 클론 (~/kakao-relay)
[x] 4. PostgreSQL에 kakao_relay DB 생성
[x] 5. 시크릿 생성 + .env 작성 (sslmode=disable, 서비스명 사용)
[x] 6. docker-compose.prod.yml에 kakao-relay 서비스 추가
[x] 7. Caddyfile에 relay 도메인 추가
[x] 8. docker compose up -d --build
[x] 9. DB migration 실행
[x] 10. 헬스체크 통과
[x] 11. 카카오 비즈니스 채널 + 오픈빌더 설정 (스킬 + 시나리오 폴백 블록 연결)
[x] 12. 플러그인 설정 (channels 키, relayUrl만 — relayToken 불필요)
[x] 13. 페어링 성공 (pairing code → 카카오톡에서 /pair)
[x] 14. 카카오 → relay → OpenClaw 메시지 전달 확인
[x] 15. OpenClaw → relay 응답 전달 확인
[ ] 16. 콜백 심사 통과 (오픈빌더 > 설정 > 콜백 사용 신청)
[ ] 17. 카카오톡 양방향 메시지 테스트 성공
```

---

## 설정 레퍼런스

| 키 | 설명 | 기본값 |
|----|------|--------|
| `enabled` | 채널 활성화 | `true` |
| `relayUrl` | Relay 서버 URL | `https://k.tess.dev/` |
| `relayToken` | ~~SSE 인증용이 아님~~ (설정하지 않음) | — |
| `sessionToken` | 자동 생성 (pairing 후 자동 저장) | — |
| `dmPolicy` | `pairing` / `allowlist` / `open` / `disabled` | `pairing` |
| `channelId` | 카카오 채널 식별자 | — |
| `textChunkLimit` | 메시지 분할 길이 (100-1000) | `400` |
| `chunkMode` | `sentence` / `newline` / `length` | `sentence` |
| `reconnectDelayMs` | SSE 재연결 초기 딜레이 (500-10000ms) | `1000` |
| `maxReconnectDelayMs` | SSE 재연결 최대 딜레이 (5000-60000ms) | `30000` |
