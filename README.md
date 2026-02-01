# OpenClaw Kakao TalkChannel Plugin

카카오톡 채널 챗봇을 OpenClaw에 연결하는 플러그인입니다.

[English](./README.en.md)

## 기능

- **두 가지 연결 모드**
  - **Direct Mode**: 공개 웹훅 URL을 통한 직접 연결
  - **Relay Mode**: Relay 서버를 통한 NAT/방화벽 우회 연결
- **DM 정책 지원**: pairing, allowlist, open, disabled
- **Kakao i 오픈빌더 스킬 서버 프로토콜** (v2.0)
- **콜백 URL 지원**: 5초 타임아웃 우회를 위한 비동기 응답

## 요구사항

- Node.js 18+
- OpenClaw (호환 버전)
- 카카오 비즈니스 채널 계정

## 설치

```bash
# 플러그인 디렉토리에 클론
cd ~/.openclaw/plugins
git clone https://github.com/talelapse/openclaw-kakao-talkchannel-plugin.git kakao-talkchannel

# 의존성 설치 및 빌드
cd kakao-talkchannel
pnpm install
pnpm build
```

## 설정

`~/.openclaw/config.yaml`에 Kakao 채널 설정을 추가합니다:

### Direct Mode (공개 서버)

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    mode: direct
    accounts:
      default:
        enabled: true
        channelId: "YOUR_KAKAO_CHANNEL_ID"
        publicWebhookUrl: "https://your-server.com/kakao-talkchannel/webhook"
        webhookPath: "/kakao-talkchannel/webhook"
        dmPolicy: pairing  # pairing | allowlist | open | disabled
        callbackTimeoutMs: 55000
```

### Relay Mode (NAT/방화벽 뒤)

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    mode: relay
    accounts:
      default:
        enabled: true
        channelId: "YOUR_KAKAO_CHANNEL_ID"
        relayUrl: "https://relay.example.com"
        relayToken: "YOUR_RELAY_TOKEN"
        reconnectDelayMs: 1000
        maxReconnectDelayMs: 30000
        dmPolicy: pairing
```

### 설정 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `enabled` | boolean | `true` | 계정 활성화 여부 |
| `channelId` | string | *필수* | 카카오 채널 ID |
| `mode` | string | `"direct"` | 연결 모드 (`direct` \| `relay`) |
| `publicWebhookUrl` | string | - | Direct 모드: 공개 웹훅 URL |
| `webhookPath` | string | `"/kakao-talkchannel/webhook"` | Direct 모드: 웹훅 경로 |
| `relayUrl` | string | - | Relay 모드: 릴레이 서버 URL |
| `relayToken` | string | - | Relay 모드: 인증 토큰 |
| `reconnectDelayMs` | number | `1000` | Relay 모드: SSE 재연결 기본 대기 (500-10000ms) |
| `maxReconnectDelayMs` | number | `30000` | Relay 모드: SSE 재연결 최대 대기 (5000-60000ms) |
| `dmPolicy` | string | `"pairing"` | DM 정책 |
| `allowFrom` | string[] | - | allowlist 모드: 허용된 사용자 ID 목록 |
| `callbackTimeoutMs` | number | `55000` | 콜백 타임아웃 (5000-55000ms) |

### DM 정책

| 정책 | 설명 |
|------|------|
| `pairing` | 사용자가 페어링 승인을 받아야 대화 가능 |
| `allowlist` | `allowFrom` 목록의 사용자만 대화 가능 |
| `open` | 모든 사용자 허용 (프로덕션 비권장) |
| `disabled` | DM 비활성화 |

## 카카오 오픈빌더 설정

1. [카카오 비즈니스](https://business.kakao.com)에서 채널 생성
2. 오픈빌더에서 스킬 서버 추가:
   - **Direct Mode**: `https://your-server.com/kakao-talkchannel/webhook`
   - **Relay Mode**: Relay 서버의 `/kakao-talkchannel/webhook` 엔드포인트
3. 폴백 블록에 스킬 연결
4. 배포

## API

### Webhook Endpoint

```
POST /kakao-talkchannel/webhook
Content-Type: application/json
```

Kakao i 오픈빌더 스킬 요청을 처리합니다.

**Request Body**: Kakao SkillPayload

**Response**: Kakao SkillResponse (v2.0)

```json
{
  "version": "2.0",
  "template": {
    "outputs": [
      {
        "simpleText": {
          "text": "안녕하세요! 무엇을 도와드릴까요?"
        }
      }
    ]
  }
}
```

### 콜백 응답

5초 내 응답이 어려운 경우 콜백 URL을 통해 비동기 응답:

```json
{
  "version": "2.0",
  "useCallback": true
}
```

이후 1분 내에 `callbackUrl`로 최종 응답을 POST합니다.

## 제한사항

### Kakao 플랫폼 제한

- **응답 시간**: 동기 응답 5초, 콜백 응답 1분
- **텍스트 길이**: simpleText 최대 1000자 (500자 이후 "더보기")
- **outputs**: 최대 3개
- **quickReplies**: 최대 10개

### MVP 제한

현재 버전은 텍스트(simpleText)만 지원합니다:

- ❌ 이미지/카드형 응답
- ❌ QuickReplies
- ❌ 스트리밍 응답

## 개발

```bash
# 의존성 설치
pnpm install

# 테스트 실행
pnpm test

# 타입 검사
npx tsc --noEmit

# 빌드
pnpm build
```

### 프로젝트 구조

```
openclaw-kakao-talkchannel-plugin/
├── index.ts                    # 플러그인 진입점
├── src/
│   ├── channel.ts              # ChannelPlugin 구현
│   ├── runtime.ts              # PluginRuntime 추상화
│   ├── types.ts                # TypeScript 타입 정의
│   ├── config/
│   │   ├── schema.ts           # Zod 설정 스키마
│   │   └── accounts.ts         # 계정 해석
│   ├── kakao/
│   │   ├── payload.ts          # SkillPayload 파싱
│   │   ├── response.ts         # SkillResponse 빌더
│   │   ├── callback.ts         # 콜백 URL 처리
│   │   └── webhook-handler.ts  # 웹훅 핸들러
│   ├── relay/
│   │   ├── client.ts           # Relay 서버 클라이언트
│   │   ├── sse.ts              # SSE 클라이언트
│   │   └── stream.ts           # SSE 스트림 관리
│   └── adapters/               # 7개 채널 어댑터
│       ├── config.ts
│       ├── outbound.ts
│       ├── status.ts
│       ├── security.ts
│       ├── pairing.ts
│       ├── gateway.ts
│       └── setup.ts
└── tests/
    ├── fixtures/               # 테스트 픽스처
    └── unit/                   # 단위 테스트
```

### 테스트

```bash
# 전체 테스트
pnpm test

# 감시 모드
pnpm test:watch

# 커버리지
pnpm test:coverage
```

## 문제 해결

### "Kakao runtime not initialized"

플러그인이 OpenClaw에 제대로 등록되지 않았습니다. `~/.openclaw/config.yaml`에서 플러그인 경로를 확인하세요.

### Relay 서버 연결 실패

1. `relayUrl`이 올바른지 확인
2. `relayToken`이 유효한지 확인
3. Relay 서버 상태 확인: `curl https://relay.example.com/health`

### 5초 타임아웃 오류

콜백 URL이 활성화되어 있는지 확인하세요. 오픈빌더에서 스킬 설정 시 "콜백 사용"을 활성화해야 합니다.

## 라이선스

MIT

## 관련 문서

- [Kakao i 오픈빌더 가이드](https://i.kakao.com/docs/skill-response-format)
- [OpenClaw 플러그인 개발 가이드](https://openclaw.dev/docs/plugins)
