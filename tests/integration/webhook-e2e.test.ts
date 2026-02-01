/**
 * Webhook End-to-End Integration Tests
 * 
 * HTTP 요청부터 응답까지 전체 흐름을 테스트합니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createWebhookHandler, handleWebhook } from '../../src/kakao/webhook-handler.js';
import { validSkillPayload, skillPayloadWithCallback } from '../fixtures/payloads.js';
import type { ResolvedKakaoAccount, KakaoSkillPayload } from '../../src/types.js';

describe('Webhook End-to-End', () => {
  let mockAccount: ResolvedKakaoAccount;
  let onMessageMock: ReturnType<typeof vi.fn>;
  
  beforeEach(() => {
    onMessageMock = vi.fn().mockResolvedValue('안녕하세요! 무엇을 도와드릴까요?');
    
    mockAccount = {
      accountId: 'default',
      channelId: 'test-channel',
      mode: 'direct',
      config: {
        enabled: true,
        channelId: 'test-channel',
        mode: 'direct',
        dmPolicy: 'open',
        webhookPath: '/kakao/webhook',
        pollIntervalMs: 3000,
        callbackTimeoutMs: 55000,
      },
    };
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  describe('Full Request Flow', () => {
    it('should process valid payload and return response', async () => {
      const handler = createWebhookHandler(mockAccount, onMessageMock);
      
      const response = await handler(validSkillPayload);
      
      expect(response).toMatchObject({
        version: '2.0',
        template: {
          outputs: expect.arrayContaining([
            expect.objectContaining({
              simpleText: expect.objectContaining({
                text: '안녕하세요! 무엇을 도와드릴까요?',
              }),
            }),
          ]),
        },
      });
      
      expect(onMessageMock).toHaveBeenCalledWith(
        expect.objectContaining({
          userRequest: expect.objectContaining({
            utterance: '안녕하세요',
          }),
        })
      );
    });
    
    it('should return callback ack when callback URL is present', async () => {
      const handler = createWebhookHandler(mockAccount, onMessageMock);
      
      const response = await handler(skillPayloadWithCallback);
      
      expect(response).toMatchObject({
        version: '2.0',
        useCallback: true,
      });
      
      // Callback 모드에서는 onMessage가 호출되지 않음
      expect(onMessageMock).not.toHaveBeenCalled();
    });
    
    it('should return error response for invalid payload', async () => {
      const handler = createWebhookHandler(mockAccount, onMessageMock);
      
      const response = await handler({ invalid: 'payload' });
      
      expect(response).toMatchObject({
        version: '2.0',
        template: {
          outputs: expect.arrayContaining([
            expect.objectContaining({
              simpleText: expect.objectContaining({
                text: expect.stringContaining('죄송합니다'),
              }),
            }),
          ]),
        },
      });
    });
  });
  
  describe('handleWebhook direct call', () => {
    it('should handle valid webhook request', async () => {
      const ctx = {
        account: mockAccount,
        onMessage: onMessageMock,
      };
      
      const response = await handleWebhook(validSkillPayload, ctx);
      
      expect(response.version).toBe('2.0');
      expect(response.template?.outputs).toHaveLength(1);
    });
  });
  
  describe('Error Recovery', () => {
    it('should handle onMessage errors gracefully', async () => {
      onMessageMock.mockRejectedValue(new Error('Processing failed'));
      
      const handler = createWebhookHandler(mockAccount, onMessageMock);
      
      const response = await handler(validSkillPayload);
      
      // 에러가 발생해도 유효한 Kakao 응답 반환
      expect(response).toHaveProperty('version', '2.0');
      expect(response.template?.outputs[0].simpleText.text).toContain('죄송합니다');
    });
    
    it('should handle missing required fields', async () => {
      const handler = createWebhookHandler(mockAccount, onMessageMock);
      
      const invalidPayload = {
        intent: { id: 'i1', name: 'n1' },
        // userRequest missing
        bot: { id: 'b1', name: 'bot' },
        action: { id: 'a1', name: 'action', params: {}, detailParams: {}, clientExtra: {} },
      };
      
      const response = await handler(invalidPayload);
      
      expect(response.version).toBe('2.0');
      expect(response.template?.outputs[0].simpleText.text).toContain('죄송합니다');
    });
  });
  
  describe('Multiple Message Handling', () => {
    it('should handle sequential requests', async () => {
      const handler = createWebhookHandler(mockAccount, onMessageMock);
      
      const responses = await Promise.all([
        handler(validSkillPayload),
        handler({ ...validSkillPayload, userRequest: { ...validSkillPayload.userRequest, utterance: '두번째 메시지' } }),
      ]);
      
      expect(responses).toHaveLength(2);
      expect(responses[0].version).toBe('2.0');
      expect(responses[1].version).toBe('2.0');
      expect(onMessageMock).toHaveBeenCalledTimes(2);
    });
  });
});
