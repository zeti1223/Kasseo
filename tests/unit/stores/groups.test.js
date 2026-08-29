import { describe, it, expect, beforeEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { isMemberAdmin, getMemberRole, useGroupsStore } from "@/stores/groups";

// Mock firebase
vi.mock("firebase/database", () => ({
  ref: vi.fn((db, path) => ({ db, path })),
  push: vi.fn(() => ({ key: "new_key" })),
  set: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  get: vi.fn(),
  onValue: vi.fn(),
}));

vi.mock("@/services/firebase/config", () => ({
  db: {},
}));

describe("groups role helper functions", () => {
  describe("isMemberAdmin", () => {
    it("returns true when member role is 'admin'", () => {
      const member = { id: "user1", role: "admin" };
      expect(isMemberAdmin(member, "other_owner")).toBe(true);
    });

    it("returns false when member role is 'member'", () => {
      const member = { id: "user1", role: "member" };
      expect(isMemberAdmin(member, "other_owner")).toBe(false);
    });

    it("falls back to ownerId if role is undefined/missing", () => {
      const member1 = { id: "owner123" };
      expect(isMemberAdmin(member1, "owner123")).toBe(true);

      const member2 = { uid: "owner123" };
      expect(isMemberAdmin(member2, "owner123")).toBe(true);

      const member3 = { id: "user456" };
      expect(isMemberAdmin(member3, "owner123")).toBe(false);
    });

    it("returns false for null or undefined member", () => {
      expect(isMemberAdmin(null, "owner123")).toBe(false);
      expect(isMemberAdmin(undefined, "owner123")).toBe(false);
    });
  });

  describe("getMemberRole", () => {
    it("returns member.role if defined", () => {
      expect(getMemberRole({ id: "user1", role: "admin" })).toBe("admin");
      expect(getMemberRole({ id: "user2", role: "member" })).toBe("member");
    });

    it("falls back to admin if member matches ownerId", () => {
      expect(getMemberRole({ id: "user1" }, "user1")).toBe("admin");
      expect(getMemberRole({ id: "user2" }, "user1")).toBe("member");
    });

    it("defaults to member if no member or role", () => {
      expect(getMemberRole(null)).toBe("member");
      expect(getMemberRole({})).toBe("member");
    });
  });
});

describe("groups store updateMemberRole and removeMember protections", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("prevents demoting the last admin in a group", async () => {
    const { get } = await import("firebase/database");
    get.mockResolvedValueOnce({
      exists: () => true,
      val: () => ({
        members: {
          admin1: { role: "admin", displayName: "Admin One" },
          user2: { role: "member", displayName: "User Two" },
        },
      }),
    });

    const store = useGroupsStore();
    await expect(store.updateMemberRole("group1", "admin1", "member")).rejects.toThrow(
      "Cannot demote the last remaining admin",
    );
  });

  it("allows demoting an admin when another admin exists", async () => {
    const { get, set } = await import("firebase/database");
    get.mockResolvedValueOnce({
      exists: () => true,
      val: () => ({
        members: {
          admin1: { role: "admin", displayName: "Admin One" },
          admin2: { role: "admin", displayName: "Admin Two" },
        },
      }),
    });
    set.mockResolvedValueOnce();

    const store = useGroupsStore();
    await expect(store.updateMemberRole("group1", "admin1", "member")).resolves.not.toThrow();
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ path: "groups/group1/members/admin1/role" }),
      "member",
    );
  });

  it("prevents removing the last admin when other members exist", async () => {
    const { get } = await import("firebase/database");
    get.mockResolvedValueOnce({
      exists: () => true,
      val: () => ({
        members: {
          admin1: { role: "admin", displayName: "Admin One" },
          user2: { role: "member", displayName: "User Two" },
        },
      }),
    });

    const store = useGroupsStore();
    await expect(store.removeMember("group1", "admin1")).rejects.toThrow(
      "Cannot remove the last remaining admin",
    );
  });

  it("allows removing a member if they are not the last admin", async () => {
    const { get, remove } = await import("firebase/database");
    get.mockResolvedValueOnce({
      exists: () => true,
      val: () => ({
        members: {
          admin1: { role: "admin", displayName: "Admin One" },
          user2: { role: "member", displayName: "User Two" },
        },
      }),
    });
    remove.mockResolvedValue();

    const store = useGroupsStore();
    await expect(store.removeMember("group1", "user2")).resolves.not.toThrow();
  });
});
