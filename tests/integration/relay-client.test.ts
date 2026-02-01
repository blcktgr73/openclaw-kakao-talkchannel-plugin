import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendReply,
  healthCheck,
} from '../../src/relay/client.js';
import type { RelayClientConfig, KakaoSkillResponse } from '../../src/types.js';

describe('Relay Client Integration', () => {
  const mockConfig: RelayClientConfig = {
    relayUrl: 'https://relay.example.com',
    relayToken: 'test-token-123',
  };
  
  let originalFetch: typeof globalThis.fetch;
  
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });
  
  describe('sendReply', () => {
    it('should send reply with correct payload', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, deliveredAt: Date.now() }),
      });
      
      const response: KakaoSkillResponse = {
        version: '2.0',
        template: {
          outputs: [{ simpleText: { text: '안녕하세요!' } }],
        },
      };
      
      await sendReply(mockConfig, 'msg_001', response);
      
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/reply'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockConfig.relayToken}`,
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('msg_001'),
        })
      );
    });
    
    it('should throw on expired callback', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 410,
        statusText: 'Gone',
        json: () => Promise.resolve({ error: 'Callback expired' }),
      });
      
      const response: KakaoSkillResponse = {
        version: '2.0',
        template: { outputs: [{ simpleText: { text: 'test' } }] },
      };
      
      await expect(sendReply(mockConfig, 'msg_001', response)).rejects.toThrow('410');
    });
    
    it('should include response in request body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });
      
      const response: KakaoSkillResponse = {
        version: '2.0',
        template: {
          outputs: [{ simpleText: { text: '테스트 응답' } }],
        },
      };
      
      await sendReply(mockConfig, 'msg_123', response);
      
      const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      
      expect(body.messageId).toBe('msg_123');
      expect(body.response.version).toBe('2.0');
      expect(body.response.template.outputs[0].simpleText.text).toBe('테스트 응답');
    });
  });
  
  describe('healthCheck', () => {
    it('should return ok:true when relay is healthy', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', timestamp: Date.now() }),
      });
      
      const result = await healthCheck(mockConfig);
      
      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeTypeOf('number');
    });
    
    it('should return ok:false when relay is unreachable', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));
      
      const result = await healthCheck(mockConfig);
      
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
    
    it('should return ok:false on HTTP error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });
      
      const result = await healthCheck(mockConfig);
      
      expect(result.ok).toBe(false);
      expect(result.error).toContain('503');
    });
    
    it('should measure latency', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        await new Promise(r => setTimeout(r, 50));
        return { ok: true, json: () => Promise.resolve({ status: 'ok' }) };
      });
      
      const result = await healthCheck(mockConfig);
      
      expect(result.ok).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(50);
    });
  });
  
  describe('Request Timeout', () => {
    it('should timeout on slow response', async () => {
      const slowConfig: RelayClientConfig = {
        ...mockConfig,
        timeoutMs: 50,
      };
      
      globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
          }, 500);
          
          options?.signal?.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });
      
      const response: KakaoSkillResponse = {
        version: '2.0',
        template: { outputs: [{ simpleText: { text: 'test' } }] },
      };
      
      await expect(sendReply(slowConfig, 'msg', response)).rejects.toThrow();
    });
  });
});
