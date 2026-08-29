import { describe, it, expect, vi } from "vitest";
import { Capacitor } from "@capacitor/core";
import { getAppBaseUrl } from "@/constants/appUrl";

describe("appUrl.js", () => {
  it("returns window.location.origin on web platform", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(false);
    expect(getAppBaseUrl()).toBe(window.location.origin);
  });

  it("returns production or env URL on native platform", () => {
    vi.spyOn(Capacitor, "isNativePlatform").mockReturnValue(true);
    expect(getAppBaseUrl()).toBe("https://kasseo.eu");
  });
});
