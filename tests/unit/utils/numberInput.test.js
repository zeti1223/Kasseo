import { describe, it, expect, vi } from "vitest";
import {
  handleNumberKeyDown,
  sanitizeNumberInput,
  handleNumberPaste,
} from "@/utils/numberInput";

describe("numberInput.js", () => {
  describe("sanitizeNumberInput", () => {
    it("returns empty string for null and undefined", () => {
      expect(sanitizeNumberInput(null)).toBe("");
      expect(sanitizeNumberInput(undefined)).toBe("");
    });

    it("sanitizes integer input when allowDecimal is false", () => {
      expect(sanitizeNumberInput("123abc456", false)).toBe("123456");
      expect(sanitizeNumberInput("12.34", false)).toBe("1234");
      expect(sanitizeNumberInput("!@#100$", false)).toBe("100");
    });

    it("sanitizes float input when allowDecimal is true", () => {
      expect(sanitizeNumberInput("12.34")).toBe("12.34");
      expect(sanitizeNumberInput("12,34")).toBe("12.34");
      expect(sanitizeNumberInput("12.34.56")).toBe("12.3456");
      expect(sanitizeNumberInput("abc12.34def")).toBe("12.34");
    });
  });

  describe("handleNumberKeyDown", () => {
    it("allows navigation and control keys", () => {
      const allowedKeys = [
        "Backspace",
        "Delete",
        "Tab",
        "Escape",
        "Enter",
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
        "Home",
        "End",
      ];

      allowedKeys.forEach((key) => {
        const event = { key, preventDefault: vi.fn() };
        handleNumberKeyDown(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
      });
    });

    it("allows modifier shortcuts (Ctrl, Meta, Alt)", () => {
      const eventCtrl = { key: "c", ctrlKey: true, preventDefault: vi.fn() };
      handleNumberKeyDown(eventCtrl);
      expect(eventCtrl.preventDefault).not.toHaveBeenCalled();

      const eventMeta = { key: "v", metaKey: true, preventDefault: vi.fn() };
      handleNumberKeyDown(eventMeta);
      expect(eventMeta.preventDefault).not.toHaveBeenCalled();
    });

    it("allows digits 0-9", () => {
      for (let i = 0; i <= 9; i++) {
        const event = { key: String(i), preventDefault: vi.fn() };
        handleNumberKeyDown(event);
        expect(event.preventDefault).not.toHaveBeenCalled();
      }
    });

    it("prevents letters and special characters", () => {
      ["e", "E", "+", "-", "a", "Z", "$", "!"].forEach((key) => {
        const event = { key, preventDefault: vi.fn() };
        handleNumberKeyDown(event);
        expect(event.preventDefault).toHaveBeenCalled();
      });
    });

    it("allows decimal point if not already present", () => {
      const input = { value: "123" };
      const event = { key: ".", target: input, preventDefault: vi.fn() };
      handleNumberKeyDown(event, true);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it("prevents second decimal point if already present", () => {
      const input = { value: "123.4" };
      const event = { key: ".", target: input, preventDefault: vi.fn() };
      handleNumberKeyDown(event, true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("converts comma to dot when comma is pressed", () => {
      const input = {
        value: "123",
        selectionStart: 3,
        selectionEnd: 3,
        dispatchEvent: vi.fn(),
      };
      const event = { key: ",", target: input, preventDefault: vi.fn() };
      handleNumberKeyDown(event, true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(input.value).toBe("123.");
      expect(input.dispatchEvent).toHaveBeenCalled();
    });
  });

  describe("handleNumberPaste", () => {
    it("cleans non-numeric characters when pasted", () => {
      const input = {
        value: "",
        selectionStart: 0,
        selectionEnd: 0,
        dispatchEvent: vi.fn(),
      };
      const event = {
        clipboardData: {
          getData: () => "abc123.45xyz",
        },
        target: input,
        preventDefault: vi.fn(),
      };

      handleNumberPaste(event, true);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(input.value).toBe("123.45");
      expect(input.dispatchEvent).toHaveBeenCalled();
    });

    it("does nothing if pasted content is already clean numbers", () => {
      const input = { value: "" };
      const event = {
        clipboardData: {
          getData: () => "123.45",
        },
        target: input,
        preventDefault: vi.fn(),
      };

      handleNumberPaste(event, true);
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });
});
