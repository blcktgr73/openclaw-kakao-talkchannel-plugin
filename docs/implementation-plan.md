# OpenClaw Kakao Channel Plugin Implementation Plan

## Overview

Kakao Channel Plugin for OpenClaw supporting two connection modes:
- **Direct Mode**: Kakao webhook → OpenClaw Gateway (public HTTPS)
- **Relay Mode**: Kakao webhook → Relay Server → OpenClaw (local) → Relay → Kakao

**Decisions:**
- 두 연결 모드 동시 구현
- Relay 서버는 별도 저장소 (`../relay-server`)에서 다른 LLM agent가 구현
- 응답 포맷: 텍스트만 (simpleText) - MVP

**Guidelines:**
- 최종 응답 및 사용자 대면 메시지는 한국어로 작성
- 코드 주석은 영어 또는 한국어 가능
- 커밋 메시지는 gitmoji + 한국어 (`.gitmojirc.json` 참조)

## Project Structure

```
openclaw-kakao-plugin/
├── package.json
├── tsconfig.json
├── openclaw.plugin.json
├── index.ts                           # Plugin entry point
├── .claude/
│   └── skills/
│       ├── tdd-workflow/              # TDD 워크플로우 skill
│       │   └── SKILL.md
│       └── security-review/           # 보안 검토 skill
│           └── SKILL.md
├── src/
│   ├── channel.ts                     # ChannelPlugin implementation
│   ├── runtime.ts                     # Runtime abstraction
│   ├── types.ts                       # TypeScript types
│   ├── config/
│   │   ├── schema.ts                  # Zod config schema
│   │   └── accounts.ts                # Account resolution
│   ├── adapters/
│   │   ├── config.ts                  # ChannelConfigAdapter
│   │   ├── outbound.ts                # ChannelOutboundAdapter
│   │   ├── gateway.ts                 # ChannelGatewayAdapter
│   │   ├── status.ts                  # ChannelStatusAdapter
│   │   ├── setup.ts                   # ChannelSetupAdapter
│   │   ├── security.ts                # ChannelSecurityAdapter
│   │   └── pairing.ts                 # ChannelPairingAdapter (dmPolicy 지원)
│   ├── kakao/
│   │   ├── webhook-handler.ts         # Kakao webhook request handling
│   │   ├── payload.ts                 # SkillPayload parsing
│   │   ├── response.ts                # SkillResponse builder (v2.0)
│   │   ├── callback.ts                # Callback URL handling
│   │   └── api.ts                     # Kakao API client
│   └── relay/
│       ├── client.ts                  # Relay server client
│       └── poller.ts                  # Long-polling for relay mode
└── tests/
    ├── webhook.test.ts
    ├── response.test.ts
    └── relay.test.ts
```

## Config Schema

```yaml
channels:
  kakao:
    mode: "direct" | "relay"      # Connection mode
    enabled: true
    accounts:
      default:
        enabled: true
        channelId: "KAKAO_CHANNEL_ID"

        # Direct mode settings
        publicWebhookUrl: "https://gateway-host/kakao/webhook"
        webhookPath: "/kakao/webhook"

        # Relay mode settings
        relayUrl: "https://relay.example.com"
        relayToken: "USER_TOKEN"
        pollIntervalMs: 3000

        # Common settings
        dmPolicy: "pairing" | "allowlist" | "open" | "disabled"
        callbackTimeoutMs: 55000
```

## Implementation Details

### Phase 1: Core Types & Config (Week 1)

**1.1 TypeScript Types (`src/types.ts`)**
```typescript
// Kakao SkillPayload types
interface KakaoSkillPayload {
  intent: { id: string; name: string };
  userRequest: {
    timezone: string;
    utterance: string;
    lang: string;
    user: {
      id: string;
      type: string;
      properties: {
        plusfriendUserKey?: string;
        appUserId?: string;
        isFriend?: boolean;
      };
    };
    callbackUrl?: string;  // For callback mode
  };
  bot: { id: string; name: string };
  action: { id: string; name: string; params: Record<string, string> };
}

// Kakao SkillResponse types (v2.0)
interface KakaoSkillResponse {
  version: "2.0";
  useCallback?: boolean;
  template?: {
    outputs: KakaoOutput[];
    quickReplies?: KakaoQuickReply[];
  };
  context?: KakaoContextControl;
  data?: Record<string, any>;
}

// Account config
interface KakaoAccountConfig {
  enabled: boolean;
  channelId: string;
  mode: "direct" | "relay";
  publicWebhookUrl?: string;
  webhookPath?: string;
  relayUrl?: string;
  relayToken?: string;
  dmPolicy: "pairing" | "allowlist" | "open" | "disabled";
}

interface ResolvedKakaoAccount {
  accountId: string;
  config: KakaoAccountConfig;
  channelId: string;
  mode: "direct" | "relay";
}
```

**1.2 Runtime Abstraction (`src/runtime.ts`)**
```typescript
import type { PluginRuntime } from "openclaw/plugin-sdk";

let runtime: PluginRuntime | null = null;

export function setKakaoRuntime(next: PluginRuntime) {
  runtime = next;
}

export function getKakaoRuntime(): PluginRuntime {
  if (!runtime) {
    throw new Error("Kakao runtime not initialized");
  }
  return runtime;
}
```

**1.3 Config Schema (`src/config/schema.ts`)**
```typescript
import { z } from "zod";

export const KakaoAccountConfigSchema = z.object({
  enabled: z.boolean().default(true),
  channelId: z.string().min(1, "channelId is required"),
  mode: z.enum(["direct", "relay"]).default("direct"),
  
  // Direct mode settings
  publicWebhookUrl: z.string().url().optional(),
  webhookPath: z.string().default("/kakao/webhook"),
  
  // Relay mode settings
  relayUrl: z.string().url().optional(),
  relayToken: z.string().optional(),
  pollIntervalMs: z.number().min(1000).max(30000).default(3000),
  
  // Common settings
  dmPolicy: z.enum(["pairing", "allowlist", "open", "disabled"]).default("pairing"),
  allowFrom: z.array(z.string()).optional(),
  callbackTimeoutMs: z.number().min(5000).max(55000).default(55000),
});

export const KakaoChannelConfigSchema = z.object({
  enabled: z.boolean().default(true),
  mode: z.enum(["direct", "relay"]).default("direct"),
  accounts: z.record(z.string(), KakaoAccountConfigSchema).default({}),
});

export type KakaoAccountConfig = z.infer<typeof KakaoAccountConfigSchema>;
export type KakaoChannelConfig = z.infer<typeof KakaoChannelConfigSchema>;

// Validation helper
export function validateAccountConfig(input: unknown): 
  { ok: true; data: KakaoAccountConfig } | { ok: false; errors: string[] } {
  const result = KakaoAccountConfigSchema.safeParse(input);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { 
    ok: false, 
    errors: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`) 
  };
}
```

**1.4 Account Resolution (`src/config/accounts.ts`)**

### Phase 2: Kakao Protocol Layer (Week 1-2)

**2.1 Payload Parser (`src/kakao/payload.ts`)**
- Parse incoming SkillPayload
- Extract user ID (botUserKey or plusfriendUserKey)
- Extract utterance text
- Validate payload structure

**2.2 Response Builder (`src/kakao/response.ts`)**
```typescript
// Build v2.0 response format (MVP: text only)
function buildSimpleTextResponse(text: string): KakaoSkillResponse;
function buildCallbackAckResponse(): KakaoSkillResponse;

// Text chunking for 1000 char limit per simpleText
function chunkTextForKakao(text: string, limit: number): string[];
```

**2.3 Callback Handler (`src/kakao/callback.ts`)**
- Track pending callbacks with timeout
- POST response to callbackUrl within 1 minute
- Handle callback errors

### Phase 3: Connection Modes (Week 2)

**3.1 Direct Mode - Webhook Handler (`src/kakao/webhook-handler.ts`)**
```typescript
async function handleWebhook(
  req: Request,
  account: ResolvedKakaoAccount,
  runtime: KakaoRuntime
): Promise<KakaoSkillResponse> {
  const payload = parseSkillPayload(req.body);

  // Quick response path (< 5s)
  const quickResponse = await tryQuickResponse(payload, runtime);
  if (quickResponse) return quickResponse;

  // Use callback for slow responses
  if (payload.userRequest.callbackUrl) {
    scheduleCallbackResponse(payload, runtime);
    return buildCallbackAckResponse();
  }

  // Fallback: synchronous response
  return await generateResponse(payload, runtime);
}
```

**3.2 Relay Mode - Client (`src/relay/client.ts`)**
```typescript
// Poll for inbound messages
async function pollMessages(
  relayUrl: string,
  token: string,
  since?: string
): Promise<InboundMessage[]>;

// Send reply via relay
async function sendReply(
  relayUrl: string,
  token: string,
  messageId: string,
  response: KakaoSkillResponse
): Promise<void>;
```

**3.3 Relay Mode - Poller (`src/relay/poller.ts`)**
```typescript
import { getKakaoRuntime } from "../runtime";

interface PollerOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_POLLER_OPTIONS: PollerOptions = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

// Exponential backoff with jitter
function calculateBackoff(attempt: number, opts: PollerOptions): number {
  const delay = Math.min(
    opts.baseDelayMs * Math.pow(2, attempt),
    opts.maxDelayMs
  );
  const jitter = delay * 0.2 * Math.random();
  return delay + jitter;
}

// Long-running poller for relay mode with error recovery
export async function startRelayPoller(
  account: ResolvedKakaoAccount,
  abortSignal: AbortSignal,
  opts: PollerOptions = DEFAULT_POLLER_OPTIONS
): Promise<void> {
  const runtime = getKakaoRuntime();
  let cursor: string | undefined;
  let consecutiveErrors = 0;

  while (!abortSignal.aborted) {
    try {
      const messages = await pollMessages(
        account.config.relayUrl!,
        account.config.relayToken!,
        cursor
      );

      consecutiveErrors = 0; // Reset on success

      for (const msg of messages.messages) {
        cursor = msg.id;
        await processInboundMessage(msg, account, runtime);
      }

      // Normal polling interval
      await sleep(account.config.pollIntervalMs ?? 3000, abortSignal);
    } catch (error) {
      consecutiveErrors++;
      runtime.logger.warn(
        `[kakao:${account.accountId}] Poll error (attempt ${consecutiveErrors}): ${error}`
      );

      if (consecutiveErrors >= opts.maxRetries) {
        runtime.logger.error(
          `[kakao:${account.accountId}] Max retries exceeded, stopping poller`
        );
        throw error;
      }

      // Exponential backoff
      const backoff = calculateBackoff(consecutiveErrors, opts);
      runtime.logger.info(
        `[kakao:${account.accountId}] Retrying in ${backoff}ms`
      );
      await sleep(backoff, abortSignal);
    }
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new Error("Aborted"));
    });
  });
}
```

### Phase 4: ChannelPlugin Adapters (Week 2-3)

**4.1 Config Adapter (`src/adapters/config.ts`)**
```typescript
const configAdapter: ChannelConfigAdapter<ResolvedKakaoAccount> = {
  listAccountIds: (cfg) => Object.keys(cfg.channels?.kakao?.accounts ?? {}),
  resolveAccount: (cfg, accountId) => resolveKakaoAccount(cfg, accountId),
  defaultAccountId: (cfg) => "default",
  isConfigured: (account) => Boolean(account.channelId),
  isEnabled: (account) => account.config.enabled,
};
```

**4.2 Outbound Adapter (`src/adapters/outbound.ts`)**
```typescript
import type { ChannelOutboundAdapter, ChannelOutboundContext } from "openclaw/plugin-sdk";
import { resolveKakaoAccount } from "../config/accounts";
import { sendViaRelay } from "../relay/client";
import { sendViaCallback } from "../kakao/callback";

// Kakao simpleText 1000자 제한에 맞춘 텍스트 분할
// 500자 이후는 "더보기"로 표시되므로 가독성을 위해 500자 기준 분할
export function chunkTextForKakao(text: string, limit: number = 500): string[] {
  if (text.length <= limit) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= limit) {
      chunks.push(remaining);
      break;
    }

    // 문장 단위로 자르기 시도 (마침표, 느낌표, 물음표)
    let splitIndex = remaining.lastIndexOf(".", limit);
    if (splitIndex === -1 || splitIndex < limit * 0.5) {
      splitIndex = remaining.lastIndexOf("!", limit);
    }
    if (splitIndex === -1 || splitIndex < limit * 0.5) {
      splitIndex = remaining.lastIndexOf("?", limit);
    }
    if (splitIndex === -1 || splitIndex < limit * 0.5) {
      // 문장 구분자가 없으면 공백 기준
      splitIndex = remaining.lastIndexOf(" ", limit);
    }
    if (splitIndex === -1 || splitIndex < limit * 0.3) {
      // 공백도 없으면 강제 분할
      splitIndex = limit;
    }

    chunks.push(remaining.slice(0, splitIndex + 1).trim());
    remaining = remaining.slice(splitIndex + 1).trim();
  }

  return chunks;
}

export const outboundAdapter: ChannelOutboundAdapter = {
  // Note: deliveryMode affects how OpenClaw queues messages
  // "direct" = plugin handles delivery directly
  // "gateway" = OpenClaw gateway handles delivery  
  deliveryMode: "direct",
  
  textChunkLimit: 500,  // 가독성을 위해 500자 기준
  chunkerMode: "text",
  chunker: chunkTextForKakao,

  sendText: async (ctx: ChannelOutboundContext) => {
    const { to, text, accountId, cfg } = ctx;
    const account = resolveKakaoAccount(cfg, accountId);

    if (account.mode === "relay") {
      return sendViaRelay(account, to, text);
    } else {
      // Direct mode: 콜백 URL을 통해 응답
      return sendViaCallback(account, to, text, ctx.deps);
    }
  },
};
```

**4.3 Gateway Adapter (`src/adapters/gateway.ts`)**
```typescript
const gatewayAdapter: ChannelGatewayAdapter = {
  startAccount: async (ctx) => {
    const { account, runtime, abortSignal } = ctx;

    if (account.mode === "relay") {
      // Start relay poller
      return startRelayPoller(account, runtime, abortSignal);
    } else {
      // Direct mode: register webhook route with gateway HTTP server
      return registerWebhookRoute(account, runtime);
    }
  },

  stopAccount: async (ctx) => {
    // Cleanup: stop poller or unregister route
  },
};
```

**4.4 Status Adapter (`src/adapters/status.ts`)**
```typescript
import type { 
  ChannelStatusAdapter, 
  ChannelAccountSnapshot,
  ChannelStatusIssue 
} from "openclaw/plugin-sdk";
import type { ResolvedKakaoAccount } from "../types";

interface KakaoProbeResult {
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

async function probeRelayServer(account: ResolvedKakaoAccount): Promise<KakaoProbeResult> {
  if (!account.config.relayUrl) {
    return { ok: false, error: "relayUrl not configured" };
  }
  
  const start = Date.now();
  try {
    const response = await fetch(`${account.config.relayUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      return { ok: false, error: `HTTP ${response.status}` };
    }
    
    return { ok: true, latencyMs: Date.now() - start };
  } catch (error) {
    return { ok: false, error: String(error) };
  }
}

export const statusAdapter: ChannelStatusAdapter<ResolvedKakaoAccount> = {
  defaultRuntime: {
    accountId: "default",
    running: false,
    lastStartAt: null,
    lastStopAt: null,
    lastError: null,
  },

  probeAccount: async ({ account, timeoutMs }) => {
    if (account.mode === "relay") {
      return probeRelayServer(account);
    }
    // Direct mode: 항상 준비 상태 (웹훅 수신 대기)
    return { ok: true };
  },

  buildAccountSnapshot: ({ account, cfg, runtime, probe }): ChannelAccountSnapshot => ({
    accountId: account.accountId,
    name: account.config.channelId,
    enabled: account.config.enabled,
    configured: Boolean(account.config.channelId),
    mode: account.mode,
    running: runtime?.running ?? false,
    lastStartAt: runtime?.lastStartAt ?? null,
    lastStopAt: runtime?.lastStopAt ?? null,
    lastError: runtime?.lastError ?? null,
    probe,
    lastInboundAt: runtime?.lastInboundAt ?? null,
    lastOutboundAt: runtime?.lastOutboundAt ?? null,
  }),

  // 채널 상태 이슈 수집 (openclaw channels status에 표시)
  collectStatusIssues: (accounts: ChannelAccountSnapshot[]): ChannelStatusIssue[] => {
    const issues: ChannelStatusIssue[] = [];
    
    for (const account of accounts) {
      // 설정되었지만 비활성화된 계정
      if (account.configured && !account.enabled) {
        issues.push({
          level: "warn",
          message: `Kakao account "${account.accountId}" is configured but disabled`,
          accountId: account.accountId,
        });
      }
      
      // Relay 모드에서 서버 연결 실패
      if (account.mode === "relay" && account.probe && !account.probe.ok) {
        issues.push({
          level: "error",
          message: `Kakao relay server unreachable: ${account.probe.error}`,
          accountId: account.accountId,
        });
      }
      
      // 장시간 인바운드 메시지 없음 (30분 이상)
      if (account.running && account.lastInboundAt) {
        const silentMs = Date.now() - new Date(account.lastInboundAt).getTime();
        if (silentMs > 30 * 60 * 1000) {
          issues.push({
            level: "warn",
            message: `Kakao account "${account.accountId}" has not received messages for ${Math.round(silentMs / 60000)} minutes`,
            accountId: account.accountId,
          });
        }
      }
    }
    
    return issues;
  },
};
```

**4.5 Security Adapter (`src/adapters/security.ts`)**
```typescript
import type { ChannelSecurityAdapter, ChannelSecurityDmPolicy } from "openclaw/plugin-sdk";
import type { ResolvedKakaoAccount } from "../types";

export const securityAdapter: ChannelSecurityAdapter<ResolvedKakaoAccount> = {
  resolveDmPolicy: (ctx): ChannelSecurityDmPolicy | null => {
    const { account, accountId } = ctx;
    const policy = account.config.dmPolicy ?? "pairing";
    
    return {
      policy,
      allowFrom: account.config.allowFrom ?? [],
      policyPath: `channels.kakao.accounts.${accountId}.dmPolicy`,
      allowFromPath: `channels.kakao.accounts.${accountId}.allowFrom`,
      approveHint: `openclaw pairing approve kakao <userId>`,
      normalizeEntry: (raw: string) => raw.replace(/^kakao:/i, ""),
    };
  },

  collectWarnings: ({ account }) => {
    const warnings: string[] = [];
    
    if (account.config.dmPolicy === "open") {
      warnings.push(
        "- Kakao DM: dmPolicy='open' allows any user to message. " +
        "Consider 'pairing' or 'allowlist' for production."
      );
    }
    
    if (account.mode === "relay" && !account.config.relayToken) {
      warnings.push(
        "- Kakao relay mode: relayToken is not configured. " +
        "Messages cannot be received without authentication."
      );
    }
    
    return warnings;
  },
};
```

**4.6 Pairing Adapter (`src/adapters/pairing.ts`)**
```typescript
import type { ChannelPairingAdapter } from "openclaw/plugin-sdk";
import { getKakaoRuntime } from "../runtime";
import { sendDirectMessage } from "../kakao/api";

export const pairingAdapter: ChannelPairingAdapter = {
  // Kakao 사용자 ID 라벨
  idLabel: "kakaoUserId",
  
  // 사용자 ID 정규화 (prefix 제거)
  normalizeAllowEntry: (entry: string) => {
    return entry.replace(/^(kakao|kakaotalk):/i, "").trim();
  },
  
  // 페어링 승인 시 사용자에게 알림 전송
  notifyApproval: async ({ cfg, id }) => {
    const runtime = getKakaoRuntime();
    const account = resolveKakaoAccount(cfg, "default");
    
    const message = "✅ OpenClaw 연동이 승인되었습니다. 이제 대화를 시작할 수 있습니다.";
    
    try {
      if (account.mode === "relay") {
        // Relay 모드에서는 relay 서버를 통해 메시지 전송
        await sendViaRelay(account, id, message);
      } else {
        // Direct 모드에서는 저장된 콜백 URL 필요 (제한적)
        runtime.logger.warn(
          `[kakao] Cannot send approval notification in direct mode without callback URL`
        );
      }
    } catch (error) {
      runtime.logger.error(`[kakao] Failed to send approval notification: ${error}`);
    }
  },
};
```

### Phase 5: Plugin Entry & Integration (Week 3)

**5.1 Plugin Metadata (`openclaw.plugin.json`)**
```json
{
  "name": "openclaw-kakao-plugin",
  "version": "0.1.0",
  "description": "Kakao Channel integration for OpenClaw",
  "main": "dist/index.js",
  "openclaw": {
    "channels": ["kakao"]
  }
}
```

**5.2 Plugin Entry (`index.ts`)**
```typescript
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { kakaoPlugin } from "./src/channel";
import { setKakaoRuntime } from "./src/runtime";
import { createWebhookHandler } from "./src/kakao/webhook-handler";
import { resolveKakaoAccount } from "./src/config/accounts";

const plugin = {
  id: "kakao",
  name: "Kakao",
  description: "Kakao Channel plugin for OpenClaw",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setKakaoRuntime(api.runtime);
    api.registerChannel({ plugin: kakaoPlugin });
    
    // Register webhook HTTP route for direct mode
    api.registerHttpRoute({
      path: "/kakao/webhook",
      handler: async (req, res) => {
        try {
          const account = resolveKakaoAccount(api.config, "default");
          if (account.mode !== "direct") {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Direct mode not enabled" }));
            return;
          }
          
          const handler = createWebhookHandler(account, api.runtime);
          await handler(req, res);
        } catch (error) {
          api.logger.error(`Webhook error: ${error}`);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "Internal server error" }));
        }
      },
    });
  },
};

export default plugin;
```

**5.3 Channel Plugin (`src/channel.ts`)**
```typescript
import type { ChannelPlugin } from "openclaw/plugin-sdk";
import type { ResolvedKakaoAccount } from "./types";
import { configAdapter } from "./adapters/config";
import { outboundAdapter } from "./adapters/outbound";
import { gatewayAdapter } from "./adapters/gateway";
import { statusAdapter } from "./adapters/status";
import { securityAdapter } from "./adapters/security";
import { pairingAdapter } from "./adapters/pairing";
import { setupAdapter } from "./adapters/setup";
import { KakaoChannelConfigSchema } from "./config/schema";
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";

export const kakaoPlugin: ChannelPlugin<ResolvedKakaoAccount> = {
  id: "kakao",
  meta: {
    id: "kakao",
    label: "Kakao Channel",
    selectionLabel: "카카오톡 채널",
    docsPath: "/docs/channels/kakao",
    blurb: "KakaoTalk 채널 챗봇을 OpenClaw에 연결합니다",
    aliases: ["kakaotalk", "kakao-channel"],
  },
  
  // Kakao 채널 기능 정의
  capabilities: {
    chatTypes: ["direct"],    // Kakao는 1:1 DM만 지원
    media: false,             // MVP: 텍스트만 지원
    threads: false,           // 스레드 미지원
    reactions: false,         // 리액션 미지원
    nativeCommands: false,    // 네이티브 명령어 미지원
    blockStreaming: true,     // 스트리밍 응답 불가 (5초 타임아웃)
  },
  
  // Config reload triggers
  reload: { configPrefixes: ["channels.kakao"] },
  
  // Zod schema for config validation
  configSchema: buildChannelConfigSchema(KakaoChannelConfigSchema),

  // Required adapters
  config: configAdapter,
  outbound: outboundAdapter,
  
  // Optional adapters
  gateway: gatewayAdapter,
  status: statusAdapter,
  security: securityAdapter,
  pairing: pairingAdapter,    // dmPolicy: "pairing" 지원
  setup: setupAdapter,
};
```

## Key Implementation Notes

### Kakao Timing Constraints
- **Skill Timeout**: 5 seconds for synchronous response
- **Callback Validity**: 1 minute, single use
- Strategy: Try quick response first, fall back to callback

### User Identification
- Primary: `userRequest.user.id` (botUserKey, max 70 chars)
- Secondary: `properties.plusfriendUserKey` (consistent across bots)
- Both are bot-specific; no cross-bot user matching

### Response Format (MVP: Text Only)
- Must be version 2.0
- Text limit: 1000 chars per simpleText (500 visible, rest in "more")
- MVP: simpleText only, no cards or quickReplies
- Future: Outputs max 3 components, QuickReplies max 10 items

### Error Handling
- Invalid webhook signature → 401
- Missing relay token → Mark channel misconfigured
- Callback failure → Log and surface in status

## Verification

### Unit Tests
```bash
pnpm test
```
- Payload parsing
- Response building
- Config validation

### Integration Tests
1. Start OpenClaw gateway with Kakao plugin
2. Configure test account (relay mode with local relay server)
3. Send test webhook → verify response
4. Verify callback flow with delayed response

### Manual Testing
1. Set up Kakao Channel bot in Kakao Business
2. Configure webhook URL (direct mode) or relay server
3. Send test message via KakaoTalk
4. Verify OpenClaw receives and responds

## Dependencies

```json
{
  "dependencies": {
    "zod": "^3.22.0"
  },
  "peerDependencies": {
    "openclaw": "^x.x.x"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "vitest": "^1.0.0"
  }
}
```

## Timeline

- **Phase 0**: 프로젝트 초기화, skill 복사
- **Week 1**: Types, config schema, payload/response handlers
- **Week 2**: Webhook handler, relay client/poller, adapters
- **Week 3**: Plugin integration, testing, documentation
