# OpenClaw Kakao TalkChannel Plugin

Connect KakaoTalk Channel to OpenClaw.

[한국어](./README.md)

## Features

- **Zero Configuration**: Connect KakaoTalk through conversation
- **Auto Session Creation**: No manual token setup required
- **Pairing Code System**: Simple `/pair XXXX-XXXX` command to connect

## Quick Start

### 1. Install Plugin

```bash
cd ~/.openclaw/plugins
git clone https://github.com/kakao-bart-lee/openclaw-kakao-talkchannel-plugin.git kakao-talkchannel
cd kakao-talkchannel
pnpm install && pnpm build
```

### 2. Configure OpenClaw

`~/.openclaw/config.yaml`:

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    mode: relay
```

### 3. Connect

Tell OpenClaw "Connect KakaoTalk":

```
OpenClaw: Search for [Channel Name] in KakaoTalk and
         type '/pair ABCD-1234' in the chat.
         (Valid for 5 minutes)
```

Type `/pair ABCD-1234` in KakaoTalk → Connected!

## Connection Modes

### Relay Mode (Recommended)

Works behind NAT/firewall.

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    mode: relay
    # That's it! Token is auto-generated.
```

**Advanced Settings** (Optional):

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    mode: relay
    talkchannels:
      default:
        relayUrl: "https://custom-relay.example.com"  # Default: https://k.tess.dev/
        relayToken: "your-token"  # Manual token (or use OPENCLAW_TALKCHANNEL_RELAY_TOKEN env)
```

### Direct Mode

For servers with public endpoints.

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    mode: direct
    talkchannels:
      default:
        channelId: "YOUR_KAKAO_CHANNEL_ID"
        publicWebhookUrl: "https://your-server.com/kakao-talkchannel/webhook"
        dmPolicy: pairing
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | string | `"direct"` | Connection mode (`direct` \| `relay`) |
| `channelId` | string | - | Direct mode: required, Relay mode: optional |
| `relayUrl` | string | `"https://k.tess.dev/"` | Relay server URL |
| `relayToken` | string | - | Relay auth token (auto-generated if not set) |
| `dmPolicy` | string | `"pairing"` | DM policy |
| `callbackTimeoutMs` | number | `55000` | Callback timeout (ms) |

### DM Policies

| Policy | Description |
|--------|-------------|
| `pairing` | Users must be approved via pairing |
| `allowlist` | Only users in `allowFrom` list |
| `open` | Allow all users (not recommended) |
| `disabled` | Disable DM |

## Kakao Open Builder Setup

1. Create a channel at [Kakao Business](https://business.kakao.com)
2. Add skill server in Open Builder:
   - **Relay Mode**: `https://k.tess.dev/kakao-talkchannel/webhook`
   - **Direct Mode**: `https://your-server.com/kakao-talkchannel/webhook`
3. Connect skill to fallback block
4. Deploy

## Development

### Installation

```bash
# 1. Install dependencies
pnpm install

# 2. Build
pnpm build

# 3. Install to OpenClaw (development link mode)
openclaw plugins install -l .
```

### Commands

```bash
pnpm build       # Build
pnpm test        # Test
pnpm test:watch  # Test (watch mode)
```

## License

MIT
