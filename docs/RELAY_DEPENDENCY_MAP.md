# Relay 의존 지점 맵

> ka-cvn 산출물. 코드/문서 전체에서 relay 관련 의존을 목록화한 결과.

---

## 요약

| 항목 | 결합도 | 위치 수 | 비고 |
|------|--------|---------|------|
| `k.tess.dev` 하드코딩 | HIGH | 13곳 | 스키마, 문서, 테스트, UI 링크 |
| `relayUrl` | CRITICAL | 20+곳 | 모든 네트워크 호출의 기반 |
| `relayToken` | CRITICAL | 15+곳 | 모든 응답 전송에 필요 |
| `sessionToken` | HIGH | 12+곳 | 페어링 후 relayToken 대체 |
| SSE 연결 | CRITICAL | 핵심 | 메시지 수신의 유일한 경로 |
| `sendReply` | CRITICAL | 10+곳 | 모든 사용자 응답에 필요 |
| Health check | MEDIUM | 3곳 | 선택적 모니터링 |
| Pairing 흐름 | CRITICAL | 핵심 | 세션 생성→코드→SSE 이벤트 |

---

## 1. k.tess.dev 하드코딩 위치

### 코드 (기본값 정의)
- `src/config/schema.ts:9` — `DEFAULT_RELAY_URL = "https://k.tess.dev/"`
- `openclaw.plugin.json:30` — config schema default
- `openclaw.plugin.json:80` — UI placeholder

### 코드 (런타임 참조)
- `src/adapters/gateway.ts:407` — help carousel의 webLinkUrl에 하드코딩

### 문서
- `README.md:241`, `README.en.md:171` — 설정 테이블
- `AGENTS.md:148` — 예시 코드
- `docs/RELAY_SELF_HOSTING_TODO.md:11,20,73`

### 테스트
- `tests/unit/relay/stream.test.ts:19`
- `tests/unit/types.test.ts:88,122`
- `tests/unit/config/schema.test.ts:21,54`
- `tests/unit/adapters/config.test.ts:116,387`

---

## 2. Relay API 엔드포인트

| 엔드포인트 | 메서드 | 인증 | 파일 | 용도 |
|-----------|--------|------|------|------|
| `v1/sessions/create` | POST | 없음 | `relay/session.ts:52` | 세션 생성 |
| `v1/sessions/{token}/status` | GET | 없음 | `relay/session.ts:98` | 세션 상태 |
| `v1/events` | GET | Bearer | `relay/sse.ts:140` | SSE 메시지 스트림 |
| `openclaw/reply` | POST | Bearer | `relay/client.ts:90` | 응답 전송 |
| `health` | GET | Bearer/없음 | `relay/client.ts:122`, `adapters/status.ts:35`, `adapters/gateway.ts:604` | 헬스 체크 |

---

## 3. 토큰 우선순위 체인

```
응답 전송 시 토큰 결정:
  activeSessionTokenMap[accountId].sessionToken   ← 메모리 (페어링 후)
  → account.config.sessionToken                   ← 설정 파일
  → account.config.relayToken                     ← 설정 파일 (레거시)
  → ""                                            ← 빈 값 (실패)
```

- `sessionToken`: 페어링 시 자동 생성, SSE 연결에 사용
- `relayToken`: self-host relay에서 수동 발급, 레거시 경로
- 둘 다 Bearer 헤더로 전달

---

## 4. SSE 이벤트 타입

| 이벤트 | 정의 | 용도 |
|--------|------|------|
| `message` | `types.ts:316` | 카카오톡 메시지 수신 |
| `ping` | `types.ts:323` | keepalive |
| `error` | `types.ts:327` | relay 에러 |
| `pairing_complete` | `types.ts:336` | 페어링 완료 (kakaoUserId 포함) |
| `pairing_expired` | `types.ts:345` | 페어링 만료 |

SSE 연결이 끊기면 exponential backoff로 재연결 (`sse.ts:18`).
401/410 응답 시 세션 무효화 → 새 세션 생성.

---

## 5. 핵심 흐름별 relay 의존

### 메시지 수신
```
Relay SSE (v1/events) → sse.ts → stream.ts → gateway.ts → OpenClaw
```

### 메시지 응답
```
OpenClaw → gateway.ts → sendReply() → relay (openclaw/reply)
```

### 페어링
```
stream.ts → createSession (v1/sessions/create) → 페어링 코드 표시
사용자 → 카카오톡에서 /pair 입력 → Relay
Relay → pairing_complete SSE 이벤트 → gateway.ts → 연결 완료
```

---

## 6. self-host 전환 시 변경 포인트

### 필수 (코드)
1. `src/config/schema.ts` — `DEFAULT_RELAY_URL` 값 변경 또는 제거
2. `openclaw.plugin.json` — default/placeholder 변경
3. `src/adapters/gateway.ts:407` — help carousel의 하드코딩 URL

### 필수 (문서)
4. `README.md`, `README.en.md` — self-host 우선 안내로 변경

### 선택 (테스트)
5. 테스트 fixture의 `k.tess.dev` — 상수 참조로 변경하면 자동 반영

### 구조 변경 불필요
- relay API 엔드포인트 경로는 동일 (relay 서버가 같은 API 구현)
- 토큰/SSE/sendReply 구조는 relay URL만 바뀌면 동작
- 페어링 흐름 변경 없음
