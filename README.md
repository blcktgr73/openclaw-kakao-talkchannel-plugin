# OpenClaw Kakao TalkChannel Plugin

카카오톡 채널을 OpenClaw에 연결하는 플러그인입니다.

[English](./README.en.md)

## 설치

### npm에서 설치 (권장)

```bash
openclaw plugins install @openclaw/kakao-talkchannel
```

### 로컬 설치 (개발용)

```bash
# 링크 모드 (소스 수정 시 바로 반영)
openclaw plugins install -l /path/to/kakao-talkchannel-plugin

# 또는 복사 모드
openclaw plugins install /path/to/kakao-talkchannel-plugin
```

### 설치 확인

```bash
openclaw plugins list
# Kakao TalkChannel | kakao-talkchannel | loaded | ... 확인
```

## 설정

설치 후 게이트웨이를 재시작하면 자동으로 채널이 활성화됩니다.

```bash
openclaw gateway restart
```

### 기본 설정

`~/.openclaw/openclaw.json` (또는 `config.yaml`)에 자동 추가되거나 수동으로 추가:

```json
{
  "channels": {
    "kakao-talkchannel": {
      "accounts": {
        "default": {
          "enabled": true
        }
      }
    }
  }
}
```

## 연결 방법

> **중요**: 페어링 코드는 **OpenClaw가 먼저 생성**합니다. 카카오톡에서 `/pair`만 입력하면 코드가 나오지 않습니다.

### 올바른 연결 순서

1. OpenClaw에게 연결 요청 (예시)
   - "카카오톡 연결해줘"
   - "카톡채널 연결"
   - "카카오톡채널 연결"
   - "카톡 연동해줘"
2. **OpenClaw가 페어링 코드를 생성하여 표시** (예: `ABCD-1234`)
3. 카카오톡 채널에 접속: http://pf.kakao.com/_scexbC
4. 채팅창에 `/pair ABCD-1234` 입력 (**코드 포함!**)
5. "OpenClaw에 연결되었습니다" 메시지 확인
6. 연결 완료 - 이제 대화 가능

### 잘못된 흐름 (주의!)

- 카카오톡에서 `/pair`만 입력 → 코드가 나오지 않음
- 카카오에서 나온 코드를 OpenClaw에 입력 → 지원하지 않는 방식

### 테스트용 톡채널

http://pf.kakao.com/_scexbC

## 문제 해결

### 플러그인이 로드되지 않음

```bash
# 플러그인 상태 확인
openclaw plugins list

# 진단 실행
openclaw plugins doctor
```

### 채널이 표시되지 않음

```bash
# 채널 목록 확인
openclaw channels list
```

게이트웨이 재시작 필요:
```bash
openclaw gateway restart
```

## 라이선스

MIT
