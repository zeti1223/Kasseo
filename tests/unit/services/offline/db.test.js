import { describe, it, expect } from "vitest";
import {
  cacheGet,
  cacheSet,
  queueAdd,
  queueList,
  queueRemove,
  withTimeout,
} from "@/services/offline/db";

describe("offline/db.js", () => {
  describe("cache", () => {
    it("returns null for a key that was never set", async () => {
      expect(await cacheGet("nonexistent-key-" + Math.random())).toBeNull();
    });

    it("stores and retrieves a value", async () => {
      const key = "test-cache-key";
      const value = { foo: "bar", n: 42 };
      await cacheSet(key, value);
      expect(await cacheGet(key)).toEqual(value);
    });

    it("overwrites a previously cached value", async () => {
      const key = "test-cache-overwrite";
      await cacheSet(key, "first");
      await cacheSet(key, "second");
      expect(await cacheGet(key)).toBe("second");
    });
  });

  describe("queue", () => {
    it("starts empty for a fresh queue entry set (no stray leftovers)", async () => {
      const before = await queueList();
      const id = await queueAdd({ kind: "set", path: "transactions/g1/t1", payload: { a: 1 } });
      const after = await queueList();
      expect(after.length).toBe(before.length + 1);
      const added = after.find((o) => o.id === id);
      expect(added).toMatchObject({ kind: "set", path: "transactions/g1/t1", payload: { a: 1 } });
      await queueRemove(id);
    });

    it("preserves insertion order", async () => {
      const id1 = await queueAdd({ kind: "set", path: "transactions/g2/a", payload: {} });
      const id2 = await queueAdd({ kind: "set", path: "transactions/g2/b", payload: {} });
      const list = await queueList();
      const idx1 = list.findIndex((o) => o.id === id1);
      const idx2 = list.findIndex((o) => o.id === id2);
      expect(idx1).toBeLessThan(idx2);
      await queueRemove(id1);
      await queueRemove(id2);
    });

    it("removes an entry by id", async () => {
      const id = await queueAdd({ kind: "remove", path: "transactions/g3/t3" });
      await queueRemove(id);
      const list = await queueList();
      expect(list.find((o) => o.id === id)).toBeUndefined();
    });
  });

  describe("withTimeout", () => {
    it("resolves normally when the promise settles first", async () => {
      const result = await withTimeout(Promise.resolve("done"), 1000);
      expect(result).toBe("done");
    });

    it("rejects if the promise takes longer than the timeout", async () => {
      const neverResolves = new Promise(() => {});
      await expect(withTimeout(neverResolves, 20)).rejects.toThrow(/Timed out/);
    });
  });
});
