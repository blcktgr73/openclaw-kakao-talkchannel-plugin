# OpenClaw Kakao TalkChannel Plugin

카카오톡 채널을 OpenClaw에 연결하는 플러그인입니다.

[English](./README.en.md)

## 설정

`~/.openclaw/config.yaml`:

```yaml
channels:
  kakao-talkchannel:
    enabled: true
```

## 연결 방법

1. OpenClaw에게 "카카오톡 연결해줘" 요청
2. OpenClaw가 pairing 코드 제공 (예: `ABCD-1234`)
3. 카카오톡에서 채널 채팅창에 `/pair ABCD-1234` 입력
4. 연결 완료

## 고급 설정 (선택)

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    channelId: "@example"      # 채널 식별용 (선택)
    relayUrl: "https://..."    # 기본: https://k.tess.dev/
    relayToken: "..."          # 환경변수 OPENCLAW_TALKCHANNEL_RELAY_TOKEN도 가능
    dmPolicy: pairing          # pairing | allowlist | open | disabled
```

## 카카오 오픈빌더 설정

1. [카카오 비즈니스](https://business.kakao.com)에서 채널 생성
2. 오픈빌더 > 스킬 서버 추가: `https://k.tess.dev/kakao-talkchannel/webhook`
3. 폴백 블록에 스킬 연결
4. 배포

## 개발

```bash
pnpm install && pnpm build
pnpm test
```

## 라이선스

MIT
