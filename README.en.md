# OpenClaw Kakao TalkChannel Plugin

A plugin that connects Kakao Talk Channel chatbots to OpenClaw.

[한국어](./README.md)

## Features

- **Two Connection Modes**
  - **Direct Mode**: Direct connection via public webhook URL
  - **Relay Mode**: NAT/firewall bypass via Relay server (SSE-based)
- **DM Policy Support**: pairing, allowlist, open, disabled
- **Kakao i Open Builder Skill Server Protocol** (v2.0)
- **Callback URL Support**: Async response to bypass 5-second timeout

## Requirements

- Node.js 18+
- OpenClaw (compatible version)
- Kakao Business Channel account

## Installation

```bash
# Clone to plugins directory
cd ~/.openclaw/plugins
git clone https://github.com/talelapse/openclaw-kakao-talkchannel-plugin.git kakao-talkchannel

# Install dependencies and build
cd kakao-talkchannel
pnpm install
pnpm build
```

## Configuration

Add Kakao channel configuration to `~/.openclaw/config.yaml`:

### Direct Mode (Public Server)

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    mode: direct
    accounts:
      default:
        enabled: true
        channelId: "YOUR_KAKAO_CHANNEL_ID"
        publicWebhookUrl: "https://your-server.com/kakao-talkchannel/webhook"
        webhookPath: "/kakao-talkchannel/webhook"
        dmPolicy: pairing  # pairing | allowlist | open | disabled
        callbackTimeoutMs: 55000
```

### Relay Mode (Behind NAT/Firewall)

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    mode: relay
    accounts:
      default:
        enabled: true
        channelId: "YOUR_KAKAO_CHANNEL_ID"
        relayUrl: "https://relay.example.com"
        relayToken: "YOUR_RELAY_TOKEN"
        reconnectDelayMs: 1000
        maxReconnectDelayMs: 30000
        dmPolicy: pairing
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable/disable account |
| `channelId` | string | *required* | Kakao Channel ID |
| `mode` | string | `"direct"` | Connection mode (`direct` \| `relay`) |
| `publicWebhookUrl` | string | - | Direct mode: Public webhook URL |
| `webhookPath` | string | `"/kakao-talkchannel/webhook"` | Direct mode: Webhook path |
| `relayUrl` | string | - | Relay mode: Relay server URL |
| `relayToken` | string | - | Relay mode: Auth token |
| `reconnectDelayMs` | number | `1000` | Relay mode: SSE reconnect base delay (500-10000ms) |
| `maxReconnectDelayMs` | number | `30000` | Relay mode: SSE reconnect max delay (5000-60000ms) |
| `dmPolicy` | string | `"pairing"` | DM policy |
| `allowFrom` | string[] | - | Allowlist mode: Allowed user ID list |
| `callbackTimeoutMs` | number | `55000` | Callback timeout (5000-55000ms) |

### DM Policies

| Policy | Description |
|--------|-------------|
| `pairing` | Users must be approved for pairing to chat |
| `allowlist` | Only users in `allowFrom` list can chat |
| `open` | All users allowed (not recommended for production) |
| `disabled` | DM disabled |

## Kakao Open Builder Setup

1. Create a channel at [Kakao Business](https://business.kakao.com)
2. Add skill server in Open Builder:
   - **Direct Mode**: `https://your-server.com/kakao-talkchannel/webhook`
   - **Relay Mode**: Relay server's `/kakao-talkchannel/webhook` endpoint
3. Connect skill to fallback block
4. Deploy

## API

### Webhook Endpoint

```
POST /kakao-talkchannel/webhook
Content-Type: application/json
```

Handles Kakao i Open Builder skill requests.

**Request Body**: Kakao SkillPayload

**Response**: Kakao SkillResponse (v2.0)

```json
{
  "version": "2.0",
  "template": {
    "outputs": [
      {
        "simpleText": {
          "text": "Hello! How can I help you?"
        }
      }
    ]
  }
}
```

### Callback Response

For responses that take longer than 5 seconds, use callback URL for async response:

```json
{
  "version": "2.0",
  "useCallback": true
}
```

Then POST the final response to `callbackUrl` within 1 minute.

## Limitations

### Kakao Platform Limits

- **Response Time**: Sync response 5s, callback response 1min
- **Text Length**: simpleText max 1000 chars ("more" button after 500)
- **outputs**: Max 3
- **quickReplies**: Max 10

### MVP Limits

Current version only supports text (simpleText):

- ❌ Image/card responses
- ❌ QuickReplies
- ❌ Streaming responses

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Type check
npx tsc --noEmit

# Build
pnpm build
```

### Project Structure

```
openclaw-kakao-talkchannel-plugin/
├── index.ts                    # Plugin entry point
├── src/
│   ├── channel.ts              # ChannelPlugin implementation
│   ├── runtime.ts              # PluginRuntime abstraction
│   ├── types.ts                # TypeScript type definitions
│   ├── config/
│   │   ├── schema.ts           # Zod config schema
│   │   └── accounts.ts         # Account resolution
│   ├── kakao/
│   │   ├── payload.ts          # SkillPayload parsing
│   │   ├── response.ts         # SkillResponse builder
│   │   ├── callback.ts         # Callback URL handling
│   │   └── webhook-handler.ts  # Webhook handler
│   ├── relay/
│   │   ├── client.ts           # Relay server client
│   │   ├── sse.ts              # SSE client
│   │   └── stream.ts           # SSE stream management
│   └── adapters/               # 7 channel adapters
│       ├── config.ts
│       ├── outbound.ts
│       ├── status.ts
│       ├── security.ts
│       ├── pairing.ts
│       ├── gateway.ts
│       └── setup.ts
└── tests/
    ├── fixtures/               # Test fixtures
    └── unit/                   # Unit tests
```

### Testing

```bash
# Full test
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

## Troubleshooting

### "Kakao runtime not initialized"

Plugin is not properly registered with OpenClaw. Check the plugin path in `~/.openclaw/config.yaml`.

### Relay Server Connection Failed

1. Verify `relayUrl` is correct
2. Verify `relayToken` is valid
3. Check relay server status: `curl https://relay.example.com/health`

### 5-Second Timeout Error

Make sure callback URL is enabled. Enable "Use Callback" when configuring the skill in Open Builder.

## License

MIT

## Related Documentation

- [Kakao i Open Builder Guide](https://i.kakao.com/docs/skill-response-format)
- [OpenClaw Plugin Development Guide](https://openclaw.dev/docs/plugins)
