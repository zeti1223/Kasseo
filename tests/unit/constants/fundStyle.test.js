import { describe, it, expect } from "vitest";
import {
  DEFAULT_FUND_COLOR,
  DEFAULT_FUND_ICON,
  FUND_COLORS,
  FUND_ICONS,
  getMyFundColor,
  getFundIcon,
} from "@/constants/fundStyle";

describe("fundStyle.js", () => {
  it("defines default values and options lists", () => {
    expect(DEFAULT_FUND_COLOR).toBe("#C8A5FC");
    expect(DEFAULT_FUND_ICON).toBe("fas fa-wallet");
    expect(FUND_COLORS.length).toBeGreaterThan(5);
    expect(FUND_ICONS.length).toBeGreaterThan(10);
  });

  describe("getMyFundColor", () => {
    it("returns member custom color if set", () => {
      const group = {
        members: {
          u1: { color: "#A7F49D" },
        },
      };
      expect(getMyFundColor(group, "u1")).toBe("#A7F49D");
    });

    it("falls back to DEFAULT_FUND_COLOR if not set", () => {
      const group = { members: {} };
      expect(getMyFundColor(group, "u2")).toBe(DEFAULT_FUND_COLOR);
      expect(getMyFundColor(null, "u2")).toBe(DEFAULT_FUND_COLOR);
    });
  });

  describe("getFundIcon", () => {
    it("returns group icon if set", () => {
      expect(getFundIcon({ icon: "fas fa-rocket" })).toBe("fas fa-rocket");
    });

    it("falls back to DEFAULT_FUND_ICON if not set", () => {
      expect(getFundIcon({})).toBe(DEFAULT_FUND_ICON);
      expect(getFundIcon(null)).toBe(DEFAULT_FUND_ICON);
    });
  });
});
