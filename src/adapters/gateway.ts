/**
 * Kakao Channel Gateway Adapter (Simplified)
 *
 * Relay mode only - always starts SSE stream.
 * Uses OpenClaw standard naming: account, startAccount, stopAccount
 *
 * Message dispatch follows OpenClaw pattern:
 * SSE message → finalizeInboundContext → dispatchReplyWithBufferedBlockDispatcher
 */

import type {
  ResolvedKakaoTalkChannel,
  InboundMessage,
  KakaoSkillResponse,
  KakaoOutput,
  KakaoChannelData,
  DeliverPayload,
} from "../types.js";
import { startRelayStream, type StreamCallbacks } from "../relay/stream.js";
import { getKakaoRuntime } from "../runtime.js";
import { sendReply } from "../relay/client.js";
import { stripMarkdown } from "../kakao/response.js";

/**
 * 사용자별 메시지 활동 추적
 * 메시지 개수 기반으로 /compact 안내 시점 결정
 */
interface UserActivity {
  messageCount: number;
  lastWarningCount: number;
}

const userActivity = new Map<string, UserActivity>();

/**
 * 사용자 활동 업데이트 및 경고 필요 여부 판단
 * 50개 메시지마다 경고하되, 마지막 경고 후 최소 50개 간격 유지
 */
function shouldShowSessionWarning(userId: string): boolean {
  const activity = userActivity.get(userId) || {
    messageCount: 0,
    lastWarningCount: -50, // 첫 경고를 50개 시점에 표시하기 위함
  };

  activity.messageCount++;
  userActivity.set(userId, activity);

  // 50개 단위마다 체크 (50, 100, 150...)
  const isCheckpoint = activity.messageCount % 50 === 0;
  // 마지막 경고 이후 최소 50개 메시지 경과
  const enoughGap = activity.messageCount - activity.lastWarningCount >= 50;

  if (isCheckpoint && enoughGap) {
    activity.lastWarningCount = activity.messageCount;
    userActivity.set(userId, activity);
    return true;
  }

  return false;
}

/**
 * 메시지 텍스트에서 카카오 카드 JSON 감지
 * JSON 형태이고 카드 키가 있으면 파싱하여 반환
 */
function tryParseKakaoCard(text: string): KakaoChannelData | null {
  const trimmed = text.trim();

  // JSON 형태가 아니면 스킵
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);

    // 카카오 카드 키 목록
    const cardKeys = [
      'textCard', 'basicCard', 'listCard',
      'commerceCard', 'itemCard', 'carousel',
      'simpleText', 'simpleImage', 'quickReplies', 'outputs'
    ];

    // 카드 키가 하나라도 있으면 카드로 인식
    if (cardKeys.some(key => key in parsed)) {
      return parsed as KakaoChannelData;
    }
  } catch {
    // JSON 파싱 실패 = 일반 텍스트
  }

  return null;
}

function buildOutputsFromChannelData(kakaoData: KakaoChannelData): KakaoOutput[] {
  if (kakaoData.outputs && kakaoData.outputs.length > 0) {
    return kakaoData.outputs;
  }

  const outputs: KakaoOutput[] = [];

  if (kakaoData.simpleText) {
    outputs.push({ simpleText: kakaoData.simpleText });
  }
  if (kakaoData.simpleImage) {
    outputs.push({ simpleImage: kakaoData.simpleImage });
  }
  if (kakaoData.textCard) {
    outputs.push({ textCard: kakaoData.textCard });
  }
  if (kakaoData.basicCard) {
    outputs.push({ basicCard: kakaoData.basicCard });
  }
  if (kakaoData.commerceCard) {
    outputs.push({ commerceCard: kakaoData.commerceCard });
  }
  if (kakaoData.listCard) {
    outputs.push({ listCard: kakaoData.listCard });
  }
  if (kakaoData.itemCard) {
    outputs.push({ itemCard: kakaoData.itemCard });
  }
  if (kakaoData.carousel) {
    outputs.push({ carousel: kakaoData.carousel });
  }

  return outputs;
}

export interface GatewayContext {
  account: ResolvedKakaoTalkChannel;
  accountId: string;
  cfg: unknown;
  abortSignal: AbortSignal;
  log?: {
    info: (msg: string) => void;
    warn: (msg: string) => void;
    error: (msg: string) => void;
  };
}

export interface StopAccountContext {
  accountId: string;
}

export interface StartAccountResult {
  pairingCode?: string;
  expiresIn?: number;
}

// Store for pairing info to be retrieved later
let pendingPairingInfo: { pairingCode: string; expiresIn: number } | null = null;

export function getPendingPairingInfo(): { pairingCode: string; expiresIn: number } | null {
  const info = pendingPairingInfo;
  pendingPairingInfo = null; // Clear after reading
  return info;
}

/**
 * Build OpenClaw message context from InboundMessage
 */
function buildMessageContext(
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  accountId: string
): Record<string, unknown> {
  const { normalized } = msg;
  const sessionKey = `agent:main:kakao-talkchannel:dm:${normalized.userId}`;

  return {
    // Message content
    Body: normalized.text,
    RawBody: normalized.text,
    BodyForAgent: normalized.text,
    BodyForCommands: normalized.text,

    // Identifiers
    From: `kakao:${normalized.userId}`,
    To: `kakao:${normalized.channelId}`,
    Provider: "kakao-talkchannel",
    Surface: "kakao-talkchannel",
    MessageSid: msg.id,
    MessageSidFull: msg.id,

    // Routing
    SessionKey: sessionKey,
    AccountId: accountId,

    // Chat context (always DM for now)
    ChatType: "direct",
    Timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),

    // Sender details
    SenderId: normalized.userId,

    // Control (authorize commands for paired users)
    CommandAuthorized: true,
  };
}

/**
 * 플러그인 자체 커맨드 핸들러 타입
 */
type CommandHandler = (
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  accountId: string,
  relayUrl: string,
  relayToken: string,
  log?: GatewayContext["log"]
) => Promise<void>;

/**
 * /help 또는 /? - 사용 가이드 캐러셀 (3장)
 */
async function handleHelpCommand(
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  _accountId: string,
  relayUrl: string,
  relayToken: string,
  log?: GatewayContext["log"]
): Promise<void> {
  const response: KakaoSkillResponse = {
    version: "2.0",
    template: {
      outputs: [
        {
          carousel: {
            type: "basicCard",
            items: [
              {
                title: "기본 사용법",
                description: "그냥 대화하세요!\nOpenClaw 에이전트가 자동으로 응답합니다.",
                thumbnail: {
                  imageUrl: "https://raw.githubusercontent.com/kakao-bart-lee/openclaw-kakao-talkchannel-plugin/main/images/openclaw-icon.png",
                  fixedRatio: true
                },
                buttons: [
                  {
                    label: "/session",
                    action: "message",
                    messageText: "/session"
                  },
                  {
                    label: "/relay",
                    action: "message",
                    messageText: "/relay"
                  }
                ],
                buttonLayout: "horizontal"
              },
              {
                title: "세션 관리",
                description: "OpenClaw 코어 버그로 인해 대화가 길어지면 tool 에러가 발생할 수 있습니다.\n\n정기적으로 /compact 하거나 문제 발생 시 /reset 하세요.",
                thumbnail: {
                  imageUrl: "https://raw.githubusercontent.com/kakao-bart-lee/openclaw-kakao-talkchannel-plugin/main/images/lobster-emoji-large-google.png",
                  fixedRatio: true
                },
                buttons: [
                  {
                    label: "/compact",
                    action: "message",
                    messageText: "/compact"
                  },
                  {
                    label: "/reset",
                    action: "message",
                    messageText: "/reset"
                  }
                ],
                buttonLayout: "horizontal"
              },
              {
                title: "링크 & 정보",
                description: "GitHub에서 소스코드 확인 및 이슈 제보\n\nREADME에서 자세한 사용법을 확인하세요.",
                thumbnail: {
                  imageUrl: "https://raw.githubusercontent.com/kakao-bart-lee/openclaw-kakao-talkchannel-plugin/main/images/github-logo.webp",
                  fixedRatio: true
                },
                buttons: [
                  {
                    label: "이슈 제보",
                    action: "webLink",
                    webLinkUrl: "https://github.com/kakao-bart-lee/openclaw-kakao-talkchannel-plugin/issues"
                  },
                  {
                    label: "README",
                    action: "webLink",
                    webLinkUrl: "https://github.com/kakao-bart-lee/openclaw-kakao-talkchannel-plugin#readme"
                  }
                ],
                buttonLayout: "horizontal"
              }
            ]
          }
        }
      ]
    }
  };

  try {
    await sendReply({ relayUrl, relayToken }, msg.id, response);
    log?.info(`[kakao-talkchannel:${account.talkchannelId}] Help carousel sent`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.error(`[kakao-talkchannel:${account.talkchannelId}] Help command failed: ${errMsg}`);
  }
}

/**
 * /github - GitHub 리포지토리 바로가기
 */
async function handleGithubCommand(
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  _accountId: string,
  relayUrl: string,
  relayToken: string,
  log?: GatewayContext["log"]
): Promise<void> {
  const response: KakaoSkillResponse = {
    version: "2.0",
    template: {
      outputs: [
        {
          basicCard: {
            title: "📦 OpenClaw Kakao TalkChannel",
            description: "GitHub 리포지토리\n\n⭐ Star & 기여 환영!\n📖 README에서 자세한 사용법 확인\n🐛 이슈 제보 및 기능 제안",
            thumbnail: {
              imageUrl: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
            },
            buttons: [
              {
                label: "리포지토리 열기",
                action: "webLink",
                webLinkUrl: "https://github.com/kakao-bart-lee/openclaw-kakao-talkchannel-plugin"
              },
              {
                label: "이슈 제보",
                action: "webLink",
                webLinkUrl: "https://github.com/kakao-bart-lee/openclaw-kakao-talkchannel-plugin/issues"
              },
              {
                label: "README",
                action: "webLink",
                webLinkUrl: "https://github.com/kakao-bart-lee/openclaw-kakao-talkchannel-plugin#readme"
              }
            ]
          }
        }
      ]
    }
  };

  try {
    await sendReply({ relayUrl, relayToken }, msg.id, response);
    log?.info(`[kakao-talkchannel:${account.talkchannelId}] GitHub card sent`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.error(`[kakao-talkchannel:${account.talkchannelId}] GitHub command failed: ${errMsg}`);
  }
}

/**
 * /about - 플러그인 정보
 */
async function handleAboutCommand(
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  _accountId: string,
  relayUrl: string,
  relayToken: string,
  log?: GatewayContext["log"]
): Promise<void> {
  const response: KakaoSkillResponse = {
    version: "2.0",
    template: {
      outputs: [
        {
          listCard: {
            header: {
              title: "ℹ️ 플러그인 정보"
            },
            items: [
              {
                title: "버전",
                description: "v0.3.0"
              },
              {
                title: "패키지",
                description: "@openclaw/kakao-talkchannel"
              },
              {
                title: "설명",
                description: "Kakao TalkChannel ↔ OpenClaw 연결"
              },
              {
                title: "Node 요구사항",
                description: ">=18"
              }
            ],
            buttons: [
              {
                label: "GitHub",
                action: "webLink",
                webLinkUrl: "https://github.com/kakao-bart-lee/openclaw-kakao-talkchannel-plugin"
              },
              {
                label: "도움말",
                action: "message",
                messageText: "/help"
              }
            ]
          }
        }
      ]
    }
  };

  try {
    await sendReply({ relayUrl, relayToken }, msg.id, response);
    log?.info(`[kakao-talkchannel:${account.talkchannelId}] About card sent`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.error(`[kakao-talkchannel:${account.talkchannelId}] About command failed: ${errMsg}`);
  }
}

/**
 * /relay - 릴레이 서버 상태 확인
 */
async function handleRelayCommand(
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  _accountId: string,
  relayUrl: string,
  relayToken: string,
  log?: GatewayContext["log"]
): Promise<void> {
  // 릴레이 서버 health check
  const startTime = Date.now();
  let status = "❌ 연결 실패";
  let latency = "N/A";
  let sessionStatus = "알 수 없음";

  try {
    const healthUrl = `${relayUrl}health`;
    const healthResponse = await fetch(healthUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${relayToken}` }
    });

    if (healthResponse.ok) {
      const responseTime = Date.now() - startTime;
      status = "✅ 정상";
      latency = `${responseTime}ms`;
      sessionStatus = relayToken ? "페어링 완료" : "토큰 없음";
    } else {
      status = `⚠️ HTTP ${healthResponse.status}`;
    }
  } catch (err) {
    status = "❌ 연결 실패";
    log?.error(`[kakao-talkchannel:${account.talkchannelId}] Relay health check failed: ${err}`);
  }

  const response: KakaoSkillResponse = {
    version: "2.0",
    template: {
      outputs: [
        {
          textCard: {
            title: "🌐 릴레이 서버 상태",
            description:
              `서버: ${relayUrl}\n` +
              `상태: ${status}\n` +
              `응답시간: ${latency}\n` +
              `세션: ${sessionStatus}`,
            buttons: [
              {
                label: "재확인",
                action: "message",
                messageText: "/relay"
              },
              {
                label: "세션 정보",
                action: "message",
                messageText: "/session"
              }
            ]
          }
        }
      ]
    }
  };

  try {
    await sendReply({ relayUrl, relayToken }, msg.id, response);
    log?.info(`[kakao-talkchannel:${account.talkchannelId}] Relay status sent`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.error(`[kakao-talkchannel:${account.talkchannelId}] Relay command failed: ${errMsg}`);
  }
}

/**
 * /session - 세션 정보
 */
async function handleSessionCommand(
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  _accountId: string,
  relayUrl: string,
  relayToken: string,
  log?: GatewayContext["log"]
): Promise<void> {
  const userId = msg.normalized.userId;
  const activity = userActivity.get(userId);
  const messageCount = activity?.messageCount || 0;
  const lastWarningCount = activity?.lastWarningCount || 0;

  // 간단한 세션 정보
  const sessionInfo =
    `메시지: ${messageCount}개\n` +
    `마지막 경고: ${lastWarningCount > 0 ? lastWarningCount + '개 시점' : '없음'}\n` +
    `페어링: ✅ ${userId}\n` +
    `토큰: ${relayToken ? '연결됨' : '없음'}`;

  const response: KakaoSkillResponse = {
    version: "2.0",
    template: {
      outputs: [
        {
          textCard: {
            title: "📊 현재 세션",
            description: sessionInfo,
            buttons: [
              {
                label: "/compact 실행",
                action: "message",
                messageText: "/compact"
              },
              {
                label: "릴레이 상태",
                action: "message",
                messageText: "/relay"
              },
              {
                label: "도움말",
                action: "message",
                messageText: "/help"
              }
            ]
          }
        }
      ]
    }
  };

  try {
    await sendReply({ relayUrl, relayToken }, msg.id, response);
    log?.info(`[kakao-talkchannel:${account.talkchannelId}] Session info sent`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    log?.error(`[kakao-talkchannel:${account.talkchannelId}] Session command failed: ${errMsg}`);
  }
}

/**
 * 플러그인 커맨드 맵
 */
const PLUGIN_COMMANDS: Record<string, CommandHandler> = {
  '/help': handleHelpCommand,
  '/?': handleHelpCommand,
  '/github': handleGithubCommand,
  '/about': handleAboutCommand,
  '/relay': handleRelayCommand,
  '/session': handleSessionCommand,
};

/**
 * Handle inbound message by dispatching to OpenClaw agent system
 */
async function handleInboundMessage(
  msg: InboundMessage,
  account: ResolvedKakaoTalkChannel,
  accountId: string,
  cfg: unknown,
  log?: GatewayContext["log"]
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const runtime = getKakaoRuntime() as any;
  const channel = runtime.channel;

  log?.info(`[kakao-talkchannel:${account.talkchannelId}] Received message: ${msg.id}`);

  // Get relay config for command handlers
  const relayUrl = account.config.relayUrl ?? "https://kakao-relay.talelapse.in";
  const relayToken = account.config.sessionToken ?? account.config.relayToken ?? "";

  // 플러그인 커맨드 체크
  const messageText = msg.normalized.text.trim();
  if (messageText.startsWith('/')) {
    const command = messageText.split(' ')[0].toLowerCase();
    const handler = PLUGIN_COMMANDS[command];

    if (handler) {
      log?.info(`[kakao-talkchannel:${account.talkchannelId}] Plugin command: ${command}`);
      await handler(msg, account, accountId, relayUrl, relayToken, log);
      return; // 커맨드 처리 완료, OpenClaw로 디스패치 안 함
    }
  }

  // 세션 관리 경고 체크
  const userId = msg.normalized.userId;
  const shouldWarn = shouldShowSessionWarning(userId);
  if (shouldWarn) {
    log?.info(`[kakao-talkchannel:${account.talkchannelId}] Session warning triggered for ${userId}`);
  }

  // Build and finalize message context
  const rawCtx = buildMessageContext(msg, account, accountId);
  const ctxPayload = channel.reply.finalizeInboundContext(rawCtx);

  // Dispatch to OpenClaw agent system
  await channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg,
    dispatcherOptions: {
      deliver: async (payload: DeliverPayload) => {
        const template: KakaoSkillResponse["template"] = { outputs: [] };
        const kakaoData = payload.channelData?.kakao;

        if (kakaoData) {
          const channelOutputs = buildOutputsFromChannelData(kakaoData);
          template.outputs.push(...channelOutputs);

          if (kakaoData.quickReplies && kakaoData.quickReplies.length > 0) {
            template.quickReplies = kakaoData.quickReplies.slice(0, 10);
          }
        }

        if (template.outputs.length === 0) {
          if (payload.mediaUrls && payload.mediaUrls.length > 0) {
            for (const url of payload.mediaUrls.slice(0, 3)) {
              template.outputs.push({ simpleImage: { imageUrl: url } });
            }
          }

          if (payload.text) {
            // 1️⃣ JSON 카드 감지 시도
            const cardData = tryParseKakaoCard(payload.text);
            if (cardData) {
              // 카드로 변환
              const cardOutputs = buildOutputsFromChannelData(cardData);
              template.outputs.push(...cardOutputs);

              // quickReplies도 처리
              if (cardData.quickReplies && cardData.quickReplies.length > 0) {
                template.quickReplies = cardData.quickReplies.slice(0, 10);
              }
            } else {
              // 2️⃣ 일반 텍스트
              const plainText = stripMarkdown(payload.text);
              template.outputs.push({ simpleText: { text: plainText } });
            }
          }
        }

        if (template.outputs.length === 0) return;

        template.outputs = template.outputs.slice(0, 3);

        // 세션 관리 안내를 quickReplies로 추가
        if (shouldWarn) {
          const activity = userActivity.get(msg.normalized.userId);
          const messageCount = activity?.messageCount || 0;

          if (!template.quickReplies) {
            template.quickReplies = [];
          }

          // 경고 버튼을 맨 앞에 추가
          template.quickReplies.unshift(
            {
              label: `💡 /compact (${messageCount}개)`,
              action: "message",
              messageText: "/compact"
            },
            {
              label: "도움말",
              action: "message",
              messageText: "세션 관리가 뭐야?"
            }
          );

          // 최대 10개 제한
          template.quickReplies = template.quickReplies.slice(0, 10);
        }

        const response: KakaoSkillResponse = {
          version: "2.0",
          template,
        };

        try {
          await sendReply(
            { relayUrl, relayToken },
            msg.id,
            response
          );
          log?.info(`[kakao-talkchannel:${account.talkchannelId}] Reply sent for ${msg.id}`);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          log?.error(`[kakao-talkchannel:${account.talkchannelId}] Reply failed: ${errMsg}`);
        }
      },
      onReplyStart: async () => {
        // Could send typing indicator if supported
      },
      onIdle: async () => {
        // Stop typing indicator
      },
      onError: (err: Error, info: { kind: string }) => {
        log?.error(`[kakao-talkchannel:${account.talkchannelId}] Dispatch ${info.kind} error: ${err.message}`);
      },
    },
  });
}

export const gatewayAdapter = {
  startAccount: async (ctx: GatewayContext): Promise<void> => {
    const { account, accountId, cfg, abortSignal, log } = ctx;

    log?.info(
      `[kakao-talkchannel:${account.talkchannelId}] Starting SSE stream to ${account.config.relayUrl}`
    );

    const callbacks: StreamCallbacks = {
      onPairingRequired: (pairingCode, expiresIn) => {
        // Store pairing info for later retrieval
        pendingPairingInfo = { pairingCode, expiresIn };

        // Log the pairing code prominently
        log?.info(`[kakao-talkchannel:${account.talkchannelId}] ========================================`);
        log?.info(`[kakao-talkchannel:${account.talkchannelId}] 🔗 페어링 코드: ${pairingCode}`);
        log?.info(`[kakao-talkchannel:${account.talkchannelId}] 카카오톡에서 /pair ${pairingCode} 입력하세요`);
        log?.info(`[kakao-talkchannel:${account.talkchannelId}] 유효시간: ${Math.floor(expiresIn / 60)}분`);
        log?.info(`[kakao-talkchannel:${account.talkchannelId}] ========================================`);
      },
      onPairingComplete: (kakaoUserId) => {
        log?.info(`[kakao-talkchannel:${account.talkchannelId}] ✅ 페어링 완료: ${kakaoUserId}`);
      },
      onPairingExpired: (reason) => {
        log?.info(`[kakao-talkchannel:${account.talkchannelId}] ⚠️ 페어링 만료: ${reason}`);
      },
    };

    // Message handler that dispatches to OpenClaw
    const onMessage = async (msg: InboundMessage): Promise<void> => {
      await handleInboundMessage(msg, account, accountId, cfg, log);
    };

    return startRelayStream(account, onMessage, abortSignal, {}, callbacks, log);
  },

  stopAccount: async (_ctx: StopAccountContext): Promise<void> => {
    return Promise.resolve();
  },

  getPendingPairingInfo,
};
