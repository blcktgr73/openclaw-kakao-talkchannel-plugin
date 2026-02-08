# OpenClaw Kakao TalkChannel Plugin

Connect KakaoTalk Channel to OpenClaw.

[한국어](./README.md)

---

## Installation

### npm

```bash
npm install @openclaw/kakao-talkchannel
```

```bash
pnpm add @openclaw/kakao-talkchannel
```

### OpenClaw CLI

Just ask OpenClaw:

> "Install KakaoTalk plugin"

That's it. OpenClaw handles the rest.

---

## User Guide

### Connect KakaoTalk

1. Ask OpenClaw: **"Connect KakaoTalk"**
2. OpenClaw provides a pairing code (e.g., `ABCD-1234`)
3. Open [KakaoTalk Channel](http://pf.kakao.com/_scexbC)
4. Type `/pair ABCD-1234` in the chat
5. Connected!

> **Important**: OpenClaw must generate the code first.

### Troubleshooting

| Issue | Ask OpenClaw |
|-------|--------------|
| Plugin not working | "Diagnose plugin" |
| Channel not visible | "Restart gateway" |
| Pairing failed | "Connect KakaoTalk" (start over) |

---

## OpenClaw Agent Guide

> This section is automation instructions for OpenClaw.

### When asked to install plugin

When user asks "install KakaoTalk plugin", "set up KakaoTalk", etc.:

```bash
# 1. Install
openclaw plugins install @openclaw/kakao-talkchannel

# 2. Verify (check kakao-talkchannel is loaded)
openclaw plugins list

# 3. Restart gateway
openclaw gateway restart

# 4. Check channels
openclaw channels list
```

### When asked to connect KakaoTalk

When user asks "connect KakaoTalk", "link KakaoTalk", etc.:

1. Generate pairing code
2. Instruct user:
   > "Enter `/pair {code}` in the KakaoTalk channel (http://pf.kakao.com/_scexbC)"
3. Wait for pairing completion

### When asked to install local plugin

When user specifies a path for local installation:

```bash
# Link mode (for development, changes reflect immediately)
openclaw plugins install -l {path}

# Copy mode
openclaw plugins install {path}
```

---

## Relay Server

This plugin communicates with KakaoTalk channels through a **relay server**. There are two ways to use it.

### Option 1: Use the default channel (Recommended)

Works out of the box with no configuration. The default relay server (`k.tess.dev`) and shared KakaoTalk channel ([Samantha](http://pf.kakao.com/_scexbC)) are provided.

- No setup required, works immediately after installation
- Connect to your OpenClaw instance via pairing code
- Multiple users share a single channel

### Option 2: Deploy your own relay server

If you want to operate your own KakaoTalk channel and relay server:

1. Deploy the relay server from [kakao-talkchannel-relay-openclaw](https://github.com/kakao-bart-lee/kakao-talkchannel-relay-openclaw)
2. Create a chatbot and connect skills in [Kakao i OpenBuilder](https://i.kakao.com/) (see the relay server's [setup guide](https://github.com/kakao-bart-lee/kakao-talkchannel-relay-openclaw/blob/main/docs/setup-guide.md))
3. Create an Account in the relay server's Admin UI and get a `relayToken`
4. Set `relayUrl` and `relayToken` in plugin config

```json
{
  "channels": {
    "kakao-talkchannel": {
      "accounts": {
        "default": {
          "relayUrl": "https://your-relay-server.example.com",
          "relayToken": "your_token"
        }
      }
    }
  }
}
```

With your own relay server you can:
- Operate an independent KakaoTalk channel
- Customize channel branding and profile
- Manage message logs and Admin UI directly

---

## Configuration Reference

In most cases, no configuration is needed. Works out of the box.

### Config file location

`~/.openclaw/openclaw.json` or `config.yaml`

### User settings

| Option | Description | Default |
|--------|-------------|---------|
| `enabled` | Enable channel | `true` |
| `dmPolicy` | DM policy | `"pairing"` |
| `allowFrom` | Allowed user list (`allowlist` mode) | - |

#### dmPolicy options

| Value | Description |
|-------|-------------|
| `pairing` | Paired users only (default, recommended) |
| `allowlist` | Only users in `allowFrom` list |
| `open` | All users |
| `disabled` | Disable DM |

### Advanced settings (usually not needed)

| Option | Description | Default |
|--------|-------------|---------|
| `channelId` | Channel identifier | auto |
| `relayUrl` | Relay server URL (change when [self-hosting](#option-2-deploy-your-own-relay-server)) | `https://k.tess.dev/` |
| `relayToken` | Relay auth token (required for self-hosted server) | env or auto |

### Example configuration

```json
{
  "channels": {
    "kakao-talkchannel": {
      "accounts": {
        "default": {
          "enabled": true,
          "dmPolicy": "pairing"
        }
      }
    }
  }
}
```

---

## License

MIT
