# Relay / Self-Hosting TODO

이 문서는 `openclaw-kakao-talkchannel-plugin`를 occloud 환경에 맞게 가져가기 위한 작업 목록입니다.

전제:
- fork repo: `blcktgr73/openclaw-kakao-talkchannel-plugin`
- 작업 브랜치 분리 없이 `main` 기준으로 진행
- 배포 대상은 occloud 인프라
- relay 도메인: `kakao-occloud.duckdns.org`
- reverse proxy: Caddy
- 목표: 외부 기본 relay(`k.tess.dev`) 의존을 줄이고 self-host relay를 기준으로 운영 가능하게 만들기

---

## 1. 목표 정리

### 1차 목표
- 현재 plugin의 relay 의존 구조를 이해하고 문서화한다.
- self-host relay 전제에서 필요한 설정과 운영 절차를 정리한다.
- `k.tess.dev`를 기본 운영 경로처럼 보이게 하는 문서/기본값/가정을 재검토한다.

### 2차 목표
- occloud 환경에서 relay를 운영할 수 있도록 배포 구성을 정리한다.
- Kakao 연결 설정을 Web UI로 wrapping하기 쉬운 구조로 정리한다.

### 3차 목표
- 향후 auto-session-hygiene 같은 UX 개선 작업의 기반을 만든다.

---

## 2. 작업 원칙

- `AGENTS.md`와 `CLAUDE.md`를 함께 따른다.
- 작은 Transformation 단위로 작업한다.
- relay 구조/책임 경계는 문서와 코드에서 함께 정리한다.
- 가능한 한 `bd` 이슈 단위로 쪼개서 진행한다.
- 세션 종료 전 `bd sync` + `git push`까지 완료한다.

---

## 3. 우선순위 TODO

## TODO-01. upstream/fork 작업 기반 정리

목표:
- 현재 로컬 repo가 fork 기준 작업 상태인지 정리
- origin/upstream 관계 확인

확인할 것:
- `origin`이 `blcktgr73/openclaw-kakao-talkchannel-plugin`인지
- `upstream`이 `kakao-bart-lee/openclaw-kakao-talkchannel-plugin`인지
- main 기준으로 작업해도 괜찮은지

산출물:
- remote 구조 확인
- upstream sync 전략 간단 메모

---

## TODO-02. relay 의존 지점 목록화

목표:
- 현재 코드/문서에서 relay 관련 의존이 어디에 있는지 정리

확인 대상:
- `README.md`
- `openclaw.plugin.json`
- `src/config/schema.ts`
- `src/adapters/gateway.ts`
- `src/relay/*`

정리할 항목:
- `k.tess.dev` 하드코딩 또는 기본값 위치
- `relayUrl`, `relayToken`, `sessionToken` 사용 위치
- pairing/session 흐름이 relay에 얼마나 결합되어 있는지
- health check / sendReply / SSE가 relay에 어떻게 묶여 있는지

산출물:
- 의존 맵 문서 또는 메모

---

## TODO-03. self-host relay 운영 기준 문서 작성

목표:
- `kakao-occloud.duckdns.org` 기준 운영 문서를 만든다.

포함할 내용:
- relay를 왜 self-host 하려는지
- 기본 public relay 대신 self-host를 권장하는 이유
- 최소 배포 구조
- 필수 env 변수
- HTTPS/Caddy 전제
- health check 방식
- 장애 시 점검 포인트

후보 문서:
- `docs/RELAY_SELF_HOSTING.md`
- 또는 `docs/OCCLOUD_DEPLOYMENT.md`

---

## TODO-04. Caddy / Docker 배포 구조 초안 작성

목표:
- occloud 서버에서 relay를 어디에 어떻게 붙일지 명시

정리할 것:
- 같은 Hetzner VM 안의 별도 Docker service로 둘지
- Caddy host routing
  - `occloud.duckdns.org`
  - `kakao-occloud.duckdns.org`
- relay upstream 포트
- 내부 네트워크 접근 방식

산출물:
- compose 예시
- Caddy route 예시

---

## TODO-05. 기본 relay 가정 재검토

목표:
- plugin README와 config가 public relay를 기본 운영 경로처럼 보이게 하는 부분을 완화

검토 포인트:
- `DEFAULT_RELAY_URL`를 그대로 둘지
- 기본값은 유지하되 README 기본 안내를 self-host 우선으로 바꿀지
- 환경별 profile/dev/prod 전략이 필요한지

가능한 옵션:
- A. 기본값 유지, 문서만 변경
- B. 기본값을 self-host placeholder로 변경
- C. 기본값 제거하고 명시 설정 요구

이 TODO는 설계 옵션 비교가 필요하다.

---

## TODO-06. relay 책임 경계 문서화

목표:
- relay가 꼭 해야 하는 일과 plugin/runtime가 해야 하는 일을 구분

정리 대상:
- Kakao webhook 수신
- 이벤트 라우팅
- pairing/session binding
- reply 중계
- auth/token validation
- plugin 내부 session hygiene와의 경계

산출물:
- 간단한 architecture note

---

## TODO-07. occloud Web UI wrapping 관점 정리

목표:
- 나중에 Web UI에서 어떤 설정을 감쌀지 미리 정리

후보 항목:
- enable/disable
- relayUrl
- relayToken
- channelId
- pairing 상태
- health 상태
- reconnect/reset control

산출물:
- UI settings checklist

---

## TODO-08. auto-session-hygiene 설계 연결

목표:
- relay/self-host 정리 후 붙일 수 있도록 session hygiene 설계를 연결

포함할 것:
- compact suggestion
- quiet hours threshold
- known error 기반 reset suggestion
- 사용자별 상태 저장 위치
- plugin 내부 구현으로 충분한지 여부

이 작업은 relay baseline 정리 후 진행 권장.

---

## 4. `bd`로 쪼개기 좋은 이슈 제안

### 추천 이슈 목록

1. `Map relay dependencies across code and docs`
2. `Document self-host relay deployment for occloud`
3. `Draft Docker + Caddy deployment model for kakao relay`
4. `Decide default relay strategy for production use`
5. `Document relay vs plugin responsibility boundaries`
6. `Prepare config/UI wrapping checklist for occloud`
7. `Design auto-session-hygiene follow-up plan`

---

## 5. 지금 당장 시작할 순서

가장 먼저 추천하는 실제 순서:

1. `bd onboard`
2. relay 의존 지점 목록화
3. self-host relay 문서 초안 작성
4. Caddy/Docker 배포 초안 작성
5. 기본 relay 전략 결정

---

## 6. 메모

- main 브랜치에서 바로 작업하기로 했으므로, 더 작은 커밋과 문서화가 중요함
- 구조 작업은 코드보다 문서 정리부터 시작하는 편이 안전함
- `kakao-occloud.duckdns.org`를 기준 host로 삼는다
