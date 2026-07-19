# 배포 검증 절차

2026-07-20 페어링 CLI 변경분을 실제 VM에서 검증하는 절차입니다.
**단위 테스트 659건은 통과했지만, 실행 중인 게이트웨이에 붙여본 적은 없습니다.**

소요 시간 약 20분. 카카오톡 앱이 필요합니다(페어링 코드 입력).

---

## 0. 사전 확인

```bash
# 서비스 호스트를 거쳐 대상 VM으로
ssh openclaw

# 현재 상태 기록 — 롤백 기준점
openclaw --version
openclaw plugins list | grep -i kakao
cp ~/.openclaw/openclaw.json ~/openclaw.json.bak-$(date +%Y%m%d-%H%M)
```

`openclaw.json` 백업은 반드시 하십시오. 페어링 재발급이 `sessionToken`을 지웁니다.

**현재 페어링 상태를 기록해 두십시오.** 이미 페어링되어 있다면 §4에서 일부러 깨뜨리게
됩니다.

---

## 1. 배포

플러그인은 링크 설치입니다. 소스를 갱신하고 다시 빌드합니다.

```bash
cd ~/kakao-plugin        # 실제 경로는 openclaw plugins list 로 확인
git fetch origin
git log --oneline -1     # 배포 전 커밋 기록 (롤백용)
git pull origin main
git log --oneline -1     # 9a6d843 이어야 함

npm install
npm run build            # tsc. 실패하면 여기서 중단하고 롤백
```

빌드가 실패하면 배포하지 말고 §7로 가십시오.

```bash
openclaw gateway restart
sleep 20
openclaw gateway status
```

---

## 2. CLI가 등록됐는지 — 가장 먼저 확인할 것

이것이 실패하면 나머지는 볼 필요가 없습니다.

```bash
openclaw kakao --help
```

**기대**: `pairing` 서브커맨드가 보입니다.

**실패 시**: `registerCli`가 드롭된 것입니다. 호스트는 `commands`/`descriptors`
메타데이터가 없으면 조용히 등록을 버립니다. 게이트웨이 로그에서 진단 메시지를
찾으십시오.

```bash
journalctl --user -u openclaw-gateway --since "2 min ago" --no-pager \
  | grep -iE "cli registration|kakao|plugin"
```

> 이 검증이 통과하면 **`registerCli`가 실제로 동작한다는 것이 처음으로 실증**됩니다.
> 지금까지는 SDK 타입 선언과 번들 확장의 사용례만 근거였습니다.

---

## 3. 조회 — 재시작 없이, 몇 번이든

```bash
openclaw kakao pairing status
```

**기대 (이미 페어링된 경우)**:

```
account: default (default)
  state: paired (…)
  A new code is not needed. Use `pairing new` to force one.
```

**기대 (미페어링)**: `state: unpaired` 와 `openclaw kakao pairing new` 안내.

이제 **비파괴 읽기**를 확인합니다 — 이전 구현이 못 하던 것입니다.

```bash
openclaw kakao pairing status
openclaw kakao pairing status
openclaw kakao pairing status
```

**기대**: 세 번 다 같은 출력. 두 번째부터 비어 있으면 실패입니다.

JSON도 확인:

```bash
openclaw kakao pairing status --json | jq .
```

---

## 4. 재발급 — 게이트웨이 재시작 없이 (핵심 검증)

**게이트웨이 PID를 먼저 기록하십시오.** 재시작이 일어나지 않았음을 증명하는 근거입니다.

```bash
PID_BEFORE=$(systemctl --user show -p MainPID --value openclaw-gateway)
echo "before: $PID_BEFORE"

time openclaw kakao pairing new
```

**기대**:

```
account: default (default)

  페어링 코드: XXXX-XXXX
  카카오톡에서 입력: /pair XXXX-XXXX
  남은 시간: 4분 5X초
```

수 초 안에 반환돼야 합니다(릴레이 왕복 + 세션 생성).

```bash
PID_AFTER=$(systemctl --user show -p MainPID --value openclaw-gateway)
echo "after: $PID_AFTER"
[ "$PID_BEFORE" = "$PID_AFTER" ] && echo "PASS: no restart" || echo "FAIL: gateway restarted"
```

**`PASS: no restart`가 이 변경의 핵심 주장입니다.** 여기서 실패하면 감시 루프가
의도대로 동작하지 않은 것입니다.

발급된 코드가 계속 읽히는지도 확인:

```bash
openclaw kakao pairing status   # 같은 코드가 나와야 함
```

---

## 5. 실제 페어링 왕복

1. 카카오톡 채널에 `/pair XXXX-XXXX` 입력.
2. 즉시 확인:

```bash
openclaw kakao pairing status
# state: paired (bot-user-key-…) 이어야 함
```

3. **중복 config 쓰기가 사라졌는지** — ClawHub #89 검증:

```bash
journalctl --user -u openclaw-gateway --since "2 min ago" --no-pager \
  | grep -c "페어링 완료"
```

**기대: `1`.** 이전에는 릴레이가 2초 내 4회 보내 4가 나왔고 `openclaw.json`을 4번
썼습니다.

4. 토큰이 저장됐는지:

```bash
jq '.channels["kakao-talkchannel"].accounts.default.sessionToken != null' \
  ~/.openclaw/openclaw.json
# true
```

5. 실제 대화:

카카오톡에서 아무 메시지나 보내고 응답이 오는지 확인. 이것이 회귀가 없음을 보이는
최종 증거입니다.

---

## 6. 상태 표면

```bash
openclaw channels status --channel kakao-talkchannel
```

**기대**: 페어링 상태가 반영되고, 미페어링이면 `Warnings:` 아래에
`Run: openclaw kakao pairing new` 같은 안내가 보입니다.

> 이전에는 `collectStatusIssues`가 `{level, message}`를 반환해 **어떤 issue도
> 렌더링되지 않았습니다.** 경고가 하나라도 보이면 그 수정이 실증된 것입니다.

**페어링 코드가 여기 노출되지 않는지 반드시 확인하십시오** — 의도적 설계입니다.

```bash
openclaw kakao pairing new >/dev/null    # 코드 발급
CODE=$(openclaw kakao pairing status --json | jq -r '.account.pairingCode')
openclaw channels status --channel kakao-talkchannel --json | grep -c "$CODE"
# 기대: 0
openclaw doctor 2>&1 | grep -c "$CODE"
# 기대: 0
```

`0`이 아니면 코드가 지원 번들·로그로 새고 있는 것입니다. 보고해 주십시오.

릴레이 헬스체크(D1)도 함께:

```bash
openclaw channels status --channel kakao-talkchannel --probe --json \
  | jq '.channelAccounts["kakao-talkchannel"][0].probe'
# ok: true 여야 함 (//health 이중 슬래시가 사라졌으므로)
```

---

## 7. 롤백

증상이 보이면 즉시:

```bash
cd ~/kakao-plugin
git checkout <배포 전 커밋>      # §1에서 기록한 것
npm run build
openclaw gateway restart
sleep 20

cp ~/openclaw.json.bak-YYYYMMDD-HHMM ~/.openclaw/openclaw.json
openclaw gateway restart
```

롤백 후에는 예전 절차로 페어링해야 합니다:

```bash
openclaw gateway restart >/dev/null 2>&1; sleep 60; \
journalctl --user -u openclaw-gateway --since "70 sec ago" --no-pager \
  | grep -oE "페어링 코드: [A-Z0-9-]*|Reusing the saved pairing" | tail -1
```

---

## 8. 릴레이 관측 — D2/D4/D5 해소용 (선택, 그러나 권장)

이미 VM에 들어와 있는 김에, 미해결 결함 3건을 한 번에 풀 수 있는 데이터를
수집하십시오. 이 관측 없이는 그 결함들을 고칠 수 없습니다.

```bash
TOKEN=$(jq -r '.channels["kakao-talkchannel"].accounts.default.sessionToken' \
  ~/.openclaw/openclaw.json)
RELAY=$(jq -r '.channels["kakao-talkchannel"].accounts.default.relayUrl' \
  ~/.openclaw/openclaw.json)

# 6분 이상 흘려보내십시오 (300초 타임아웃 경계를 넘겨야 함)
timeout 400 curl -N -sS \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream" \
  "${RELAY}v1/events" \
  | ts '[%Y-%m-%d %H:%M:%S]' \
  | tee ~/relay-observation-$(date +%Y%m%d-%H%M).log
```

`ts`가 없으면: `sudo apt install moreutils`.

**이 로그에서 답이 나오는 것들**:

| 질문 | 보는 법 | 어떤 결함이 풀리나 |
|---|---|---|
| ping 주기는? | `ping` 이벤트 타임스탬프 간격 | D4 워치독 임계값 결정 |
| 300초에 끊기나? | 5분 지점에서 스트림 종료 여부 | D2 확정 |
| 멀티라인 `data:`를 보내나? | 한 이벤트 블록에 `data:` 줄이 2개 이상인지 | D5 영향 범위 |

`/health` 경로도 함께 확인해 주십시오 (D1이 안전했는지 사후 확인):

```bash
curl -s -o /dev/null -w "%{http_code} /health\n"  "${RELAY}health"
curl -s -o /dev/null -w "%{http_code} //health\n" "${RELAY}/health"
```

둘 다 200이면 D1 수정은 무해했던 것이고, `//health`만 200이면 릴레이가 그 경로에
의존하고 있었다는 뜻이니 알려주십시오.

---

## 결과 보고 양식

```
[ ] 2. openclaw kakao --help 에 pairing 노출
[ ] 3. status 3회 연속 동일 출력 (비파괴)
[ ] 4. pairing new 후 PID 동일 (재시작 없음)   ← 핵심
[ ] 5. /pair 성공, "페어링 완료" 로그 정확히 1회
[ ] 5. 카카오톡 대화 왕복 정상
[ ] 6. channels status 에 경고 렌더링
[ ] 6. 페어링 코드가 status/doctor 에 노출되지 않음
[ ] 6. probe ok:true
[ ] 8. 릴레이 관측 로그 확보
```

실패한 항목은 명령어와 실제 출력을 그대로 붙여 주십시오.
