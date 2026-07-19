# 페어링 운영 가이드

카카오톡 채널 페어링 코드를 **SSH + `openclaw` CLI**로 얻는 방법입니다.

> **전제: 게이트웨이가 먼저 떠 있어야 합니다.** 페어링 코드는 게이트웨이 프로세스의
> 메모리에 존재하며, 게이트웨이가 이를 파일로 발행할 때만 CLI가 읽을 수 있습니다.
> 게이트웨이가 내려가 있으면 CLI가 그렇게 알려줍니다.

## CLI가 게이트웨이와 통신하는 방식

플러그인 CLI 명령은 **실행 중인 게이트웨이를 직접 호출할 수 없습니다.** 2026-07-20에
실기에서 확인했습니다:

- `runtime.gateway.isAvailable()`은 "이 프로세스가 활성 Gateway request context를
  소유하는가"를 뜻합니다 — 게이트웨이 *안에서* 도는 플러그인 코드에만 참이고,
  CLI에서는 항상 거짓입니다.
- 호스트 자신의 `channels status`가 쓰는 `callGateway`는 `openclaw/plugin-sdk`에서
  export되지 않습니다.

그래서 두 프로세스는 파일로 주고받습니다. 각 파일은 **쓰는 쪽이 하나뿐**입니다.

| 파일 | 쓰는 쪽 | 읽는 쪽 |
|---|---|---|
| `~/.openclaw/kakao-talkchannel/pairing-state.json` | 게이트웨이 | CLI |
| `~/.openclaw/kakao-talkchannel/pairing-request.json` | CLI | 게이트웨이 (1초 폴링) |

두 파일 모두 원자적 쓰기 + `0600`입니다. 상태 파일에는 쓴 프로세스의 pid가 들어가서,
CLI가 죽은 게이트웨이가 남긴 파일을 신뢰하지 않고 stale로 판정합니다.

게이트웨이 RPC 메서드도 **여전히 존재하고 동작합니다** — 플러그인 CLI에서만 못 닿을
뿐입니다.

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

CLI와는 별개의 경로입니다. 호스트의 `openclaw gateway call`은 게이트웨이에 직접
닿으므로, CLI가 어떤 이유로 막히면 대체 수단이 됩니다. 2026-07-20 실기 확인 완료.

```bash
openclaw gateway call kakao.pairing.status
openclaw gateway call kakao.pairing.new --params '{"timeoutMs":45000}'
```

| 메서드 | 스코프 | 설명 |
|---|---|---|
| `kakao.pairing.status` | `operator.read` | 현재 상태 조회. 부작용 없음 |
| `kakao.pairing.new` | `operator.write` | 세션 폐기 후 재발급 |

## 문제 해결

**`No KakaoTalk pairing state found`**
게이트웨이가 상태를 발행하고 있지 않습니다 — 게이트웨이가 내려가 있거나, 카카오
채널 계정이 시작되지 않았습니다.

```bash
openclaw gateway status
openclaw channels status --channel kakao-talkchannel
```

**`KakaoTalk pairing state is stale`**
상태 파일은 있지만 그것을 쓴 프로세스가 이미 죽었습니다. 게이트웨이가 비정상 종료한
경우입니다. `openclaw gateway restart` 후 재시도하십시오.

**`Timed out … waiting for a new pairing code`**
게이트웨이가 요청 파일을 집어가지 못했거나, 릴레이가 응답하지 않았습니다.

```bash
journalctl --user -u openclaw-gateway --since "2 min ago" | grep -i kakao
```

로그에 `Re-issue requested via CLI`가 없으면 게이트웨이가 요청을 못 본 것이고,
`CLI re-issue failed`가 있으면 그 사유가 실제 원인입니다.

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

- 페어링 상태는 **게이트웨이 프로세스 메모리**에 있고 파일은 그 사본입니다.
  게이트웨이를 재시작하면 저장된 세션 토큰으로 페어링은 복원되지만, 대기 중이던
  미완료 코드는 사라집니다. 그때는 `openclaw kakao pairing new`를 다시 실행하십시오.
- 게이트웨이는 재기동 시 남아 있던 요청 파일을 **버립니다.** 죽어 있는 동안 쌓인
  요청이 나중에 엉뚱한 시점에 코드를 발급하는 것을 막기 위함입니다.
- `pairing new`는 게이트웨이의 1초 폴링 주기만큼 지연될 수 있습니다.
- 릴레이가 발급하는 코드의 유효시간은 릴레이가 정합니다(관측치 5분).
- 상태 파일은 `0600`이지만 **평문**입니다. 게이트웨이를 돌리는 계정에 접근할 수 있는
  사람은 대기 중인 페어링 코드를 볼 수 있습니다.
