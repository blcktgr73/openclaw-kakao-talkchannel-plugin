# OpenClaw Kakao TalkChannel Plugin

Connect KakaoTalk Channel to OpenClaw.

[한국어](./README.md)

## How to Connect

No configuration required - works out of the box after installation.

1. Ask OpenClaw "Connect KakaoTalk"
2. OpenClaw provides a pairing code (e.g., `ABCD-1234`)
3. Type `/pair ABCD-1234` in KakaoTalk channel chat
4. Connected!

## Advanced Settings (Optional)

```yaml
channels:
  kakao-talkchannel:
    enabled: true
    channelId: "@example"      # For identification (optional)
    relayUrl: "https://..."    # Default: https://k.tess.dev/
    relayToken: "..."          # Or use OPENCLAW_TALKCHANNEL_RELAY_TOKEN env
    dmPolicy: pairing          # pairing | allowlist | open | disabled
```

## Kakao Open Builder Setup

1. Create channel at [Kakao Business](https://business.kakao.com)
2. Open Builder > Add skill server: `https://k.tess.dev/kakao-talkchannel/webhook`
3. Connect skill to fallback block
4. Deploy

## Development

```bash
pnpm install && pnpm build
pnpm test
```

## License

MIT
