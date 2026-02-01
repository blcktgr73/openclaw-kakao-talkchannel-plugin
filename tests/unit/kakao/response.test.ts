/**
 * Kakao SkillResponse Builder Tests
 * 
 * Tests for response building functions that create v2.0 format responses
 * with proper text chunking and callback handling.
 */
import { describe, it, expect } from "vitest";
import {
  buildSimpleTextResponse,
  buildCallbackAckResponse,
  buildErrorResponse,
  chunkTextForKakao,
  buildMultiTextResponse,
} from "../../../src/kakao/response";
import type { KakaoSkillResponse } from "../../../src/types";

describe("Kakao Response Builder", () => {
  describe("buildSimpleTextResponse", () => {
    it("should build v2.0 response with simpleText", () => {
      const response = buildSimpleTextResponse("Hello, Kakao!");

      expect(response.version).toBe("2.0");
      expect(response.template).toBeDefined();
      expect(response.template?.outputs).toHaveLength(1);
      expect(response.template?.outputs[0]).toEqual({
        simpleText: { text: "Hello, Kakao!" },
      });
    });

    it("should not set useCallback flag", () => {
      const response = buildSimpleTextResponse("Test");

      expect(response.useCallback).toBeUndefined();
    });

    it("should handle empty string", () => {
      const response = buildSimpleTextResponse("");

      expect(response.template?.outputs[0]).toEqual({
        simpleText: { text: "" },
      });
    });

    it("should handle Korean text", () => {
      const response = buildSimpleTextResponse("안녕하세요!");

      expect(response.template?.outputs[0]).toEqual({
        simpleText: { text: "안녕하세요!" },
      });
    });

    it("should handle text with special characters", () => {
      const text = "Hello! How are you? I'm fine.";
      const response = buildSimpleTextResponse(text);

      expect(response.template?.outputs[0]).toEqual({
        simpleText: { text },
      });
    });
  });

  describe("buildCallbackAckResponse", () => {
    it("should build callback acknowledgment response", () => {
      const response = buildCallbackAckResponse();

      expect(response.version).toBe("2.0");
      expect(response.useCallback).toBe(true);
    });

    it("should not include template", () => {
      const response = buildCallbackAckResponse();

      expect(response.template).toBeUndefined();
    });

    it("should return consistent structure", () => {
      const response1 = buildCallbackAckResponse();
      const response2 = buildCallbackAckResponse();

      expect(response1).toEqual(response2);
    });
  });

  describe("buildErrorResponse", () => {
    it("should build error response with message", () => {
      const response = buildErrorResponse("Something went wrong");

      expect(response.version).toBe("2.0");
      expect(response.template?.outputs[0]).toEqual({
        simpleText: { text: "Something went wrong" },
      });
    });

    it("should handle error message with details", () => {
      const message = "Error: Invalid request format";
      const response = buildErrorResponse(message);

      expect(response.template?.outputs[0]).toEqual({
        simpleText: { text: message },
      });
    });

    it("should not set useCallback flag", () => {
      const response = buildErrorResponse("Error");

      expect(response.useCallback).toBeUndefined();
    });
  });

  describe("chunkTextForKakao", () => {
    it("should return single chunk for short text", () => {
      const text = "Hello, world!";
      const chunks = chunkTextForKakao(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(text);
    });

    it("should use default limit of 500 characters", () => {
      const text = "a".repeat(600);
      const chunks = chunkTextForKakao(text);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(500);
      });
    });

    it("should respect custom limit", () => {
      const text = "a".repeat(300);
      const chunks = chunkTextForKakao(text, 100);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(100);
      });
    });

    it("should split at sentence boundaries (period)", () => {
      const text = "First sentence. Second sentence. Third sentence.";
      const chunks = chunkTextForKakao(text, 30);

      // Should split at periods, not in the middle of words
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(30);
      });
    });

    it("should split at exclamation mark", () => {
      const text = "First! Second! Third!";
      const chunks = chunkTextForKakao(text, 15);

      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(15);
      });
    });

    it("should split at question mark", () => {
      const text = "First? Second? Third?";
      const chunks = chunkTextForKakao(text, 15);

      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(15);
      });
    });

    it("should handle text without sentence boundaries", () => {
      const text = "a".repeat(600);
      const chunks = chunkTextForKakao(text);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(500);
      });
    });

    it("should preserve sentence structure", () => {
      const text = "Hello. World. How are you?";
      const chunks = chunkTextForKakao(text, 50);

      const joined = chunks.join("");
      expect(joined).toBe(text);
    });

    it("should handle empty string", () => {
      const chunks = chunkTextForKakao("");

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe("");
    });

    it("should handle Korean text with sentence boundaries", () => {
      const text = "안녕하세요. 반갑습니다. 어떻게 도와드릴까요?";
      const chunks = chunkTextForKakao(text, 100);

      chunks.forEach((chunk) => {
        expect(chunk.length).toBeLessThanOrEqual(100);
      });
    });
  });

  describe("buildMultiTextResponse", () => {
    it("should build response with single text", () => {
      const response = buildMultiTextResponse(["Hello"]);

      expect(response.version).toBe("2.0");
      expect(response.template?.outputs).toHaveLength(1);
      expect(response.template?.outputs[0]).toEqual({
        simpleText: { text: "Hello" },
      });
    });

    it("should build response with multiple texts", () => {
      const texts = ["First", "Second", "Third"];
      const response = buildMultiTextResponse(texts);

      expect(response.template?.outputs).toHaveLength(3);
      texts.forEach((text, index) => {
        expect(response.template?.outputs[index]).toEqual({
          simpleText: { text },
        });
      });
    });

    it("should enforce Kakao limit of 3 outputs maximum", () => {
      const texts = ["One", "Two", "Three", "Four", "Five"];
      const response = buildMultiTextResponse(texts);

      expect(response.template?.outputs.length).toBeLessThanOrEqual(3);
    });

    it("should handle empty array", () => {
      const response = buildMultiTextResponse([]);

      expect(response.version).toBe("2.0");
      expect(response.template?.outputs).toHaveLength(0);
    });

    it("should not set useCallback flag", () => {
      const response = buildMultiTextResponse(["Text"]);

      expect(response.useCallback).toBeUndefined();
    });

    it("should preserve text order", () => {
      const texts = ["Alpha", "Beta", "Gamma"];
      const response = buildMultiTextResponse(texts);

      texts.forEach((text, index) => {
        expect(response.template?.outputs[index]).toEqual({
          simpleText: { text },
        });
      });
    });

    it("should handle texts with special characters", () => {
      const texts = ["Hello!", "How are you?", "I'm fine."];
      const response = buildMultiTextResponse(texts);

      expect(response.template?.outputs).toHaveLength(3);
      texts.forEach((text, index) => {
        expect(response.template?.outputs[index]).toEqual({
          simpleText: { text },
        });
      });
    });

    it("should handle Korean texts", () => {
      const texts = ["안녕하세요", "반갑습니다", "도움이 되셨나요?"];
      const response = buildMultiTextResponse(texts);

      expect(response.template?.outputs).toHaveLength(3);
      texts.forEach((text, index) => {
        expect(response.template?.outputs[index]).toEqual({
          simpleText: { text },
        });
      });
    });
  });

  describe("Response structure validation", () => {
    it("all responses should have version 2.0", () => {
      const responses: KakaoSkillResponse[] = [
        buildSimpleTextResponse("test"),
        buildCallbackAckResponse(),
        buildErrorResponse("error"),
        buildMultiTextResponse(["text"]),
      ];

      responses.forEach((response) => {
        expect(response.version).toBe("2.0");
      });
    });

    it("should not include context or data fields by default", () => {
      const response = buildSimpleTextResponse("test");

      expect(response.context).toBeUndefined();
      expect(response.data).toBeUndefined();
    });
  });
});
