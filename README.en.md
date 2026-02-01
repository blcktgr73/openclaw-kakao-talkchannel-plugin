# OpenClaw Kakao TalkChannel Plugin

Connect KakaoTalk Channel to OpenClaw.

[한국어](./README.md)

## Configuration

Add to `~/.openclaw/config.yaml`:

```yaml
channels:
  kakao-talkchannel:
    accounts:
      default:
        enabled: true
```

## How to Connect

1. Ask OpenClaw "Connect KakaoTalk"
2. OpenClaw provides a pairing code (e.g., `ABCD-1234`)
3. Type `/pair ABCD-1234` in KakaoTalk channel chat
4. Connected!

Test TalkChannel: http://pf.kakao.com/_scexbC

## Advanced Settings (Optional)

```yaml
channels:
  kakao-talkchannel:
    accounts:
      default:
        enabled: true
        channelId: "@example"      # For identification (optional)
        relayUrl: "https://..."    # Default: https://k.tess.dev/
        relayToken: "..."          # Or use OPENCLAW_TALKCHANNEL_RELAY_TOKEN env
        dmPolicy: pairing          # pairing | allowlist | open | disabled
```

## License

MIT
