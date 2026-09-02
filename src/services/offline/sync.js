import { ref as dbRef, set, update, remove } from "firebase/database";
import { db } from "@/services/firebase/config";
import { queueList, queueRemove } from "./db";

let flushing = false;

async function applyOp(op) {
  const target = dbRef(db, op.path);
  if (op.kind === "set") return set(target, op.payload);
  if (op.kind === "update") return update(target, op.payload);
  if (op.kind === "remove") return remove(target);
  console.warn("Unknown queued offline op kind:", op.kind);
}

/**
 * Replays every queued write against Firebase, strictly in the order they
 * were made. Stops at the first failure and leaves the rest of the queue
 * intact — an earlier write must never be skipped ahead of, since a later
 * one (e.g. an edit) can depend on it having landed first. The remaining
 * queue is retried the next time this is called (typically when the app
 * comes back online).
 */
export async function flushQueue() {
  if (flushing) return;
  flushing = true;
  try {
    const ops = await queueList();
    ops.sort((a, b) => a.id - b.id);
    for (const op of ops) {
      try {
        await applyOp(op);
        await queueRemove(op.id);
      } catch (err) {
        console.warn("Failed to sync a queued offline write, will retry later:", err);
        break;
      }
    }
  } finally {
    flushing = false;
  }
}
