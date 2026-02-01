# OpenClaw Kakao TalkChannel Plugin

카카오톡 채널을 OpenClaw에 연결하는 플러그인입니다.

[English](./README.en.md)

## 특징

- **설정 없이 시작**: 대화만으로 카카오톡 연결 완료
- **자동 세션 생성**: 토큰 설정 불필요
- **Pairing 코드 시스템**: 간단한 `/pair XXXX-XXXX` 명령으로 연결

## 빠른 시작

### 1. 플러그인 설치

```bash
cd ~/.openclaw/plugins
git clone https://github.com/kakao-bart-lee/openclaw-kakao-talkchannel-plugin.git kakao-talkchannel
cd kakao-talkchannel
pnpm install && pnpm build
```

### 2. OpenClaw 설정

`~/.openclaw/config.yaml`:

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    mode: relay
```

### 3. 연결하기

OpenClaw에게 "카카오톡 연결해줘"라고 말하면:

```
OpenClaw: 카카오톡에서 [채널명]을 검색하고
         채팅창에 '/pair ABCD-1234'를 입력해주세요.
         (5분 내 입력해주세요)
```

카카오톡에서 `/pair ABCD-1234` 입력 → 연결 완료!

## 연결 모드

### Relay Mode (권장)

NAT/방화벽 환경에서도 동작합니다.

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    mode: relay
    # 설정 끝! 토큰은 자동 생성됩니다.
```

**고급 설정** (선택):

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    mode: relay
    accounts:
      default:
        relayUrl: "https://custom-relay.example.com"  # 기본: https://k.tess.dev/
        relayToken: "your-token"  # 수동 토큰 (환경변수 OPENCLAW_TALKCHANNEL_RELAY_TOKEN도 가능)
```

### Direct Mode

공개 서버가 있는 경우 직접 연결합니다.

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    mode: direct
    accounts:
      default:
        channelId: "YOUR_KAKAO_CHANNEL_ID"
        publicWebhookUrl: "https://your-server.com/kakao-talkchannel/webhook"
        dmPolicy: pairing
```

## 설정 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `mode` | string | `"direct"` | 연결 모드 (`direct` \| `relay`) |
| `channelId` | string | - | Direct 모드: 필수, Relay 모드: 선택 |
| `relayUrl` | string | `"https://k.tess.dev/"` | Relay 서버 URL |
| `relayToken` | string | - | Relay 인증 토큰 (자동 생성 가능) |
| `dmPolicy` | string | `"pairing"` | DM 정책 |
| `callbackTimeoutMs` | number | `55000` | 콜백 타임아웃 (ms) |

### DM 정책

| 정책 | 설명 |
|------|------|
| `pairing` | 사용자가 페어링 승인을 받아야 대화 가능 |
| `allowlist` | `allowFrom` 목록의 사용자만 대화 가능 |
| `open` | 모든 사용자 허용 (비권장) |
| `disabled` | DM 비활성화 |

## 카카오 오픈빌더 설정

1. [카카오 비즈니스](https://business.kakao.com)에서 채널 생성
2. 오픈빌더에서 스킬 서버 추가:
   - **Relay Mode**: `https://k.tess.dev/kakao-talkchannel/webhook`
   - **Direct Mode**: `https://your-server.com/kakao-talkchannel/webhook`
3. 폴백 블록에 스킬 연결
4. 배포

## 개발

```bash
pnpm install     # 의존성 설치
pnpm build       # 빌드
pnpm test        # 테스트
```

## 라이선스

MIT
