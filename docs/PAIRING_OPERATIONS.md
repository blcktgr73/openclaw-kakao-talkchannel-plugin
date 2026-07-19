# 페어링 운영 가이드

카카오톡 채널 페어링 코드를 **SSH + `openclaw` CLI**로 얻는 방법입니다.

> **전제: 게이트웨이가 먼저 떠 있어야 합니다.** 페어링 코드는 게이트웨이 프로세스의
> 메모리에만 존재합니다. CLI는 별도 프로세스라서 게이트웨이 RPC로 읽어옵니다.
> 게이트웨이가 내려가 있으면 CLI가 그렇게 알려줍니다.

## 명령어

```bash
# 현재 페어링 코드 조회 (게이트웨이 재시작 불필요)
openclaw kakao pairing status

# 세션을 버리고 새 코드 발급 (게이트웨이 재시작 불필요)
openclaw kakao pairing new
```

옵션:

| 옵션 | 대상 | 설명 |
|---|---|---|
| `--account <id>` | 둘 다 | 계정 지정. 생략 시 실행 중인 첫 계정 |
| `--json` | 둘 다 | 원본 JSON 출력 (스크립트용) |
| `--timeout <초>` | `new` | 릴레이 응답 대기 시간 (기본 30, 최대 120) |

## 표준 절차

```bash
# 1. 게이트웨이가 떠 있는지 확인
openclaw gateway status

# 2. 코드 조회
openclaw kakao pairing status
```

출력:

```
account: default (default)

  페어링 코드: VZ4Q-3E8Q
  카카오톡에서 입력: /pair VZ4Q-3E8Q
  남은 시간: 4분 12초
```

3. 카카오톡 채널에 `/pair VZ4Q-3E8Q` 입력.
4. 확인:

```bash
openclaw kakao pairing status
# account: default (default)
#   state: paired (bot-user-key-…)
```

이미 페어링되어 있는데 새로 하고 싶으면 `openclaw kakao pairing new`.

## 이전 절차와의 차이

예전에는 이랬습니다:

```bash
# 더 이상 필요 없음
openclaw gateway restart >/dev/null 2>&1; sleep 60; \
journalctl --user -u openclaw-gateway --since "70 sec ago" --no-pager \
  | grep -oE "페어링 코드: [A-Z0-9-]*|Reusing the saved pairing" | tail -1
```

세 가지 문제가 있었습니다.

1. **재시작해야만 읽을 수 있었습니다.** 코드가 로그에 찍히는 순간을 놓치면 다시
   재시작하는 수밖에 없었습니다 — 계속 떠 있어야 할 프로세스를 재시작하면서.
2. **이중 재시작 함정.** `openclaw gateway restart`는 in-process 재시작과 systemd
   재시작을 약 45초 간격으로 각각 일으키고, 각자 다른 코드를 발급했습니다. 첫 코드로
   페어링하면 릴레이에서는 성공하지만 살아남은 프로세스는 그 세션을 모릅니다 —
   증상은 "`/pair` 성공 후 무응답"이었습니다. `--since`와 `tail -1`이 둘 다
   필수였던 이유입니다.
3. **코드를 한 번만 읽을 수 있었습니다.** 내부 `getPendingPairingInfo`가 읽으면서
   삭제하는 구현이었습니다.

지금은 재시작이 관여하지 않으므로 세 문제 모두 사라집니다.

## 상태 확인

`openclaw channels status`에도 페어링 상태가 나옵니다.

```
Warnings:
- kakao-talkchannel default: Kakao TalkChannel "default" is waiting to be paired (Run: openclaw kakao pairing status)
```

`--json`에는 구조화된 필드가 들어갑니다.

```bash
openclaw channels status --channel kakao-talkchannel --json \
  | jq '.channelAccounts["kakao-talkchannel"][0] | {pairingState, pairingExpiresInSeconds, pairedUserId}'
```

> **페어링 코드 자체는 `channels status`에 포함되지 않습니다.** 상태 출력은
> `openclaw doctor`, 지원 번들, 로그 등으로 널리 수집되는데 페어링 코드는 수명이
> 짧은 자격증명입니다. 코드를 출력하는 곳은 `openclaw kakao pairing status`
> 하나뿐입니다.

## 게이트웨이 RPC 직접 호출

CLI는 아래 메서드의 얇은 래퍼입니다. 스크립트에서 직접 부를 수도 있습니다.

```bash
openclaw gateway call kakao.pairing.status
openclaw gateway call kakao.pairing.new --params '{"timeoutMs":45000}'
```

| 메서드 | 스코프 | 설명 |
|---|---|---|
| `kakao.pairing.status` | `operator.read` | 현재 상태 조회. 부작용 없음 |
| `kakao.pairing.new` | `operator.write` | 세션 폐기 후 재발급 |

## 문제 해결

**`The OpenClaw gateway is not reachable`**
게이트웨이가 떠 있어야 합니다. `openclaw gateway start` 후 재시도.

**`No KakaoTalk account is running`**
게이트웨이는 떠 있지만 카카오 채널이 시작되지 않았습니다.
`openclaw channels status --channel kakao-talkchannel`로 `enabled`/`configured`를 확인하십시오.

**`This account uses a configured relayToken, so it never pairs`**
`relayToken`이 설정되어 있으면 `createSession`이 호출되지 않아 페어링 코드 자체가
존재하지 않습니다. `channels.kakao-talkchannel.accounts.<id>.relayToken`을 지우거나
`OPENCLAW_TALKCHANNEL_RELAY_TOKEN` 환경변수를 해제하십시오.

> 참고: `relayToken`을 설정하면 릴레이에서 `401 invalid token attempt`가 납니다.
> 릴레이 모드에서는 설정하지 마십시오.

**`Timed out … waiting for a pairing code`**
릴레이가 응답하지 않았습니다. `openclaw channels status --probe`로 릴레이 연결을
확인하고 `--timeout`을 늘려 재시도하십시오.

## 알려진 제약

- 페어링 상태는 **게이트웨이 프로세스 메모리**에 있습니다. 게이트웨이를 재시작하면
  저장된 세션 토큰으로 페어링은 복원되지만, 대기 중이던 미완료 코드는 사라집니다.
  그때는 `openclaw kakao pairing new`를 다시 실행하면 됩니다.
- 릴레이가 발급하는 코드의 유효시간은 릴레이가 정합니다(관측치 5분).
