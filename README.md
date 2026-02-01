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
```

그게 끝입니다! 토큰과 relayUrl은 자동으로 설정됩니다.

### 3. 연결하기

OpenClaw에게 "카카오톡 연결해줘"라고 말하면:

```
OpenClaw: 카카오톡에서 [채널명]을 검색하고
         채팅창에 '/pair ABCD-1234'를 입력해주세요.
         (5분 내 입력해주세요)
```

카카오톡에서 `/pair ABCD-1234` 입력 → 연결 완료!

## 설정 옵션

**고급 설정** (선택):

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    channelId: "@example"  # 선택: 채널 식별용
    relayUrl: "https://custom-relay.example.com"  # 기본: https://k.tess.dev/
    relayToken: "your-token"  # 선택: 환경변수 OPENCLAW_TALKCHANNEL_RELAY_TOKEN도 가능
```

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `enabled` | boolean | `true` | 플러그인 활성화 |
| `channelId` | string | - | 채널 식별자 (선택) |
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
2. 오픈빌더에서 스킬 서버 추가: `https://k.tess.dev/kakao-talkchannel/webhook`
3. 폴백 블록에 스킬 연결
4. 배포

## 개발 예정

다음 기능은 향후 개발 예정입니다:

- **Direct 모드**: 웹훅 직접 수신 (공개 서버 필요)
- **다중 채널 지원**: 여러 카카오톡 채널 동시 연결

## 개발

### 설치

```bash
# 1. 의존성 설치
pnpm install

# 2. 빌드
pnpm build

# 3. OpenClaw에 설치 (개발용 링크 모드)
openclaw plugins install -l .
```

### 명령어

```bash
pnpm build       # 빌드
pnpm test        # 테스트
pnpm test:watch  # 테스트 (감시 모드)
```

## 라이선스

MIT
