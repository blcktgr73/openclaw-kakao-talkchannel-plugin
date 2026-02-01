# Relay Server API Spec (for ../relay-server)

다른 LLM agent가 relay 서버를 구현할 때 참고할 API 명세입니다.

## Base URL
```
https://relay.example.com
```

## 1. Kakao Webhook Receiver (Public)

```
POST /kakao/webhook
```

Kakao Channel 봇 시스템이 호출하는 웹훅 엔드포인트.

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:** Kakao SkillPayload (see types below)

**Response:**
```json
{
  "version": "2.0",
  "useCallback": true
}
```

**Behavior:**
1. Kakao 시그니처 검증 (선택)
2. `userRequest.user.properties.plusfriendUserKey`로 account 매핑
3. 메시지를 큐에 저장
4. `useCallback: true` ACK 반환
5. OpenClaw가 reply하면 callbackUrl로 최종 응답 전송

## 2. OpenClaw Message Stream (SSE)

```
GET /messages/stream
```

OpenClaw 플러그인이 실시간으로 메시지를 수신하는 SSE(Server-Sent Events) 엔드포인트.

**Request Headers:**
```
Authorization: Bearer <relay_token>
Accept: text/event-stream
Cache-Control: no-cache
Last-Event-ID: <optional_last_event_id>
```

**SSE Events:**

| Event | Data | Description |
|-------|------|-------------|
| `message` | InboundMessage JSON | 새 메시지 도착 |
| `ping` | `{}` | 연결 유지 heartbeat (30초마다) |
| `error` | `{ "code": "...", "message": "..." }` | 에러 발생 |

**Example Stream:**
```
event: ping
data: {}

event: message
id: msg_abc123
data: {"id":"msg_abc123","timestamp":1706700000000,"kakaoPayload":{...},"normalized":{"userId":"user_xyz","text":"안녕하세요","channelId":"kakao_channel_123"},"callbackUrl":"https://bot-api.kakao.com/callback/xxx","callbackExpiresAt":1706700060000}

event: ping
data: {}
```

**Connection Behavior:**
- 연결 유지 시간: 무제한 (클라이언트가 끊을 때까지)
- Heartbeat: 30초마다 `ping` 이벤트 전송
- 재연결: 클라이언트 책임, `Last-Event-ID` 헤더로 이전 위치부터 resume 가능
- 연결 끊김 시 exponential backoff로 재연결 권장

**Error Responses:**
- `401 Unauthorized`: Invalid token
- `429 Too Many Requests`: Rate limit exceeded

## 3. OpenClaw Reply

```
POST /openclaw/reply
```

OpenClaw 플러그인이 응답을 보내는 엔드포인트.

**Request Headers:**
```
Content-Type: application/json
Authorization: Bearer <relay_token>
```

**Request Body:**
```json
{
  "messageId": "msg_abc123",
  "response": {
    "version": "2.0",
    "template": {
      "outputs": [
        {
          "simpleText": {
            "text": "안녕하세요! 무엇을 도와드릴까요?"
          }
        }
      ]
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "deliveredAt": 1706700005000
}
```

**Error Responses:**
- `400 Bad Request`: Invalid response format
- `401 Unauthorized`: Invalid token
- `404 Not Found`: Message not found or expired
- `410 Gone`: Callback URL expired

## 4. Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": 1706700000000
}
```

## Data Models

### Account (Relay 내부)
```typescript
interface RelayAccount {
  id: string;                    // Internal account ID
  openclawUserId: string;        // OpenClaw user identifier
  relayToken: string;            // Auth token (hashed in DB)
  kakaoChannelId: string;        // Kakao Channel ID
  createdAt: Date;
  updatedAt: Date;
}
```

### Kakao User Mapping
```typescript
interface KakaoUserMapping {
  kakaoUserKey: string;          // plusfriendUserKey from Kakao
  accountId: string;             // Links to RelayAccount
  lastSeenAt: Date;
}
```

### Inbound Message Queue
```typescript
interface InboundMessage {
  id: string;
  accountId: string;
  kakaoPayload: KakaoSkillPayload;
  normalizedMessage: {
    userId: string;
    text: string;
    channelId: string;
  };
  callbackUrl: string;
  callbackExpiresAt: Date;       // createdAt + 60s
  status: "queued" | "delivered" | "expired";
  createdAt: Date;
  deliveredAt?: Date;
}
```

## Kakao SkillPayload Type (Reference)

```typescript
interface KakaoSkillPayload {
  intent: {
    id: string;
    name: string;
  };
  userRequest: {
    timezone: string;            // "Asia/Seoul"
    block: { id: string; name: string };
    utterance: string;           // User's message
    lang: string;                // "ko"
    user: {
      id: string;                // botUserKey (max 70 chars)
      type: "botUserKey";
      properties: {
        plusfriendUserKey?: string;  // Stable across bots
        appUserId?: string;
        isFriend?: boolean;
      };
    };
    callbackUrl?: string;        // Only if callback enabled
  };
  bot: {
    id: string;
    name: string;
  };
  action: {
    id: string;
    name: string;
    params: Record<string, string>;
    detailParams: Record<string, { origin: string; value: string }>;
    clientExtra: Record<string, any>;
  };
}
```

## Kakao SkillResponse Type (v2.0)

```typescript
interface KakaoSkillResponse {
  version: "2.0";
  useCallback?: boolean;         // true for async response
  template?: {
    outputs: KakaoOutput[];      // 1-3 outputs
    quickReplies?: KakaoQuickReply[];  // max 10
  };
  context?: KakaoContextControl;
  data?: Record<string, any>;
}

interface KakaoSimpleText {
  simpleText: {
    text: string;                // max 1000 chars
  };
}

type KakaoOutput = KakaoSimpleText;  // MVP: text only
```

## Implementation Notes

1. **Callback Timeout**: Kakao callback URL expires in 1 minute. Relay must POST response before expiry.

2. **Message TTL**: Queue messages for 5-15 minutes max. Expire if not pulled.

3. **Rate Limiting**: Apply per-account rate limits (e.g., 100 req/min).

4. **SSE Heartbeat**: Send `ping` event every 30 seconds to keep connection alive and detect dead clients.

5. **User Mapping**: Use `plusfriendUserKey` as primary user identifier (stable across bots).

6. **Signature Verification**: (TBD) Kakao may provide webhook signatures for validation.

## Environment Variables

```bash
# Server config
PORT=3000
RELAY_BASE_URL=https://relay.example.com

# Kakao config
KAKAO_SIGNATURE_SECRET=optional_secret_for_webhook_validation

# Queue config
QUEUE_TTL_SECONDS=900  # 15 minutes
SSE_HEARTBEAT_INTERVAL_SECONDS=30

# Database
DATABASE_URL=postgresql://...
```
