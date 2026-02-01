# OpenClaw Kakao TalkChannel Plugin

Connect KakaoTalk Channel to OpenClaw.

[한국어](./README.md)

---

## User Guide

### Installation

Just ask OpenClaw:

> "Install KakaoTalk plugin"

That's it. OpenClaw handles the rest.

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
| `relayUrl` | Relay server | `https://k.tess.dev/` |
| `relayToken` | Relay token | env or auto |

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
