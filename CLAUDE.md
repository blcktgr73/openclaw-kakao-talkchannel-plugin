# CLAUDE.md

이 파일은 Claude Code가 이 저장소에서 작업할 때 참고하는 가이드입니다.

## 프로젝트 개요

OpenClaw Kakao TalkChannel Plugin은 카카오톡 채널을 OpenClaw에 연결하는 플러그인입니다.

## 커밋 컨벤션

**CRITICAL:** 이 프로젝트는 **release-please**를 사용하므로 **Conventional Commits** 형식을 따릅니다.

### 형식

```
<type>: <한글 메시지>
```

### 주의사항

- **이모지를 사용하지 마세요** - release-please가 커밋 타입을 인식하지 못합니다
- 타입은 반드시 메시지 **맨 앞**에 위치해야 합니다

### 올바른 예시

```
feat: 새로운 기능 추가
fix: 버그 수정
docs: 문서 추가/수정
refactor: 코드 리팩토링
test: 테스트 추가/수정
chore: 빌드, 설정 변경
```

### 잘못된 예시 (사용 금지)

```
✨ feat: 새로운 기능 추가    # 이모지가 앞에 있으면 안됨
🐛 fix: 버그 수정            # 이모지가 앞에 있으면 안됨
feat: 새로운 기능 추가 ✨    # 뒤에 있어도 불필요
```

### 타입별 버전 범프

- `feat:` - Minor 버전 (0.1.0 → 0.2.0)
- `fix:` - Patch 버전 (0.1.0 → 0.1.1)
- `feat!:` 또는 `BREAKING CHANGE:` - Major 버전 (0.1.0 → 1.0.0)
- 기타 (`docs:`, `refactor:`, `test:`, `chore:`) - CHANGELOG에 기록되지만 버전 범프 없음

## 개발 명령어

```bash
# 개발
pnpm dev          # 개발 모드 실행
pnpm build        # 빌드

# 테스트
pnpm test         # 테스트 (watch 모드)
pnpm test:run     # 테스트 실행 (CI용)
pnpm test:coverage # 커버리지 포함 테스트

# 코드 품질
pnpm lint         # ESLint 실행
pnpm format       # Prettier 포맷팅
pnpm typecheck    # TypeScript 타입 체크
```

## 프로젝트 구조

```
src/
├── adapters/     # OpenClaw 어댑터 구현
├── config/       # 설정 스키마
├── kakao/        # 카카오 API 관련
├── relay/        # SSE 릴레이 클라이언트
└── index.ts      # 플러그인 엔트리포인트
tests/
├── unit/         # 단위 테스트
└── integration/  # 통합 테스트
```

## 릴리스

- `main` 브랜치에 push하면 release-please가 자동으로 PR 생성
- PR이 머지되면 자동으로 npm에 배포
