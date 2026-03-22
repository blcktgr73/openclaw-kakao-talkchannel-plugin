# OpenClaw Kakao TalkChannel Plugin

Read AGENTS.md for coding standards, testing patterns, and commit conventions.

## Project

OpenClaw 플랫폼에 카카오톡 채널을 연결하는 플러그인.
SSE 릴레이 기반으로 카카오 i 오픈빌더 스킬 콜백을 처리합니다.

## Quick Commands

```bash
pnpm dev              # Watch mode (tsc --watch)
pnpm build            # Build to dist/
pnpm typecheck        # Type check without emit
pnpm lint             # ESLint (src/ tests/ index.ts)
pnpm test             # Vitest watch mode
pnpm test:run         # Single run (CI)
pnpm test:coverage    # Coverage report (80%+ thresholds)
```

## Tech Stack

- **Runtime**: Node.js 22.12+, ESM (`"type": "module"`)
- **Language**: TypeScript 5.3+ (strict, NodeNext module)
- **Validation**: Zod
- **Testing**: Vitest (v8 coverage, 80% thresholds)
- **Peer Dependency**: openclaw SDK
- **Release**: release-please (Conventional Commits)
- **Package Manager**: pnpm

## Key Directories

```
src/
├── adapters/     # OpenClaw adapter 구현 (config, gateway, outbound, pairing, security, setup, status)
├── relay/        # SSE 릴레이 클라이언트 (client, sse, stream, session)
├── kakao/        # 카카오 타입 & 유틸 (callback, limits, payload, response)
├── config/       # Zod config schemas
├── channel.ts    # 메인 플러그인 export
├── runtime.ts    # 런타임 싱글톤
└── types.ts      # 코어 타입
tests/
├── unit/         # src/ 미러 구조
├── integration/  # E2E 테스트
├── fixtures/     # 테스트 데이터
└── setup.ts      # Vitest 설정
```

## Architecture

- **Relay 모드**: 공유 릴레이(`k.tess.dev`) 또는 셀프호스트 릴레이
- **인증**: Pairing (sessionToken) 또는 Account (relayToken, 셀프호스트용)
- **DM Policy**: `pairing` | `allowlist` | `open` | `disabled`
- **기본 채널**: "Samantha" (`http://pf.kakao.com/_scexbC`)

## Key Documents

- [AGENTS.md](AGENTS.md) — 코딩 규칙, 테스트 패턴, 커밋 컨벤션
- [README.md](README.md) — 설치/사용법 (한국어)
- [README.en.md](README.en.md) — Installation/usage (English)
- [docs/DEVELOPMENT_OPERATING_MODEL.md](docs/DEVELOPMENT_OPERATING_MODEL.md) — 개발 철학
- [docs/RELAY_SELF_HOSTING.md](docs/RELAY_SELF_HOSTING.md) — 릴레이 셀프호스팅 가이드
- [docs/RELAY_DEPENDENCY_MAP.md](docs/RELAY_DEPENDENCY_MAP.md) — 릴레이 아키텍처

---

## Kakao Card Message Guide

카카오톡 채널로 다양한 형태의 메시지를 보낼 수 있습니다.

### 중요 규칙

**카드 메시지를 보낼 때는 JSON만 단독으로 보내세요.**

```
# 잘못된 예:
"결과입니다! {"textCard":{"title":"결과"}}"

# 올바른 예:
{"textCard":{"title":"결과","description":"설명"}}
```

### Card Types

| Type | 용도 |
|------|------|
| `textCard` | 텍스트 + 버튼 |
| `basicCard` | 이미지 + 텍스트 + 버튼 |
| `listCard` | 리스트 형태 |
| `commerceCard` | 상품 정보 |
| `simpleImage` | 이미지만 |
| `carousel` | 여러 카드 슬라이드 |

### Button Actions

| action | 설명 | 필수 필드 |
|--------|------|-----------|
| `message` | 메시지 전송 | `messageText` |
| `webLink` | 웹페이지 열기 | `webLinkUrl` |
| `phone` | 전화 걸기 | `phoneNumber` |
| `share` | 공유하기 | - |
| `operator` | 상담원 연결 | - |

### Limits

- 말풍선 최대 3개 (outputs)
- quickReplies 최대 10개
- 버튼 최대 3개 (카드당)
- carousel 아이템 최대 10개
