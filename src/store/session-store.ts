import { randomUUID } from "node:crypto";
import type { Redis } from "ioredis";
import type { Session } from "../bot/types.js";

/**
 * Short-lived conversation state lives in Redis (fast, expires on its own).
 * The finished CV sections live in Supabase (durable). See cv-repository.ts.
 */
export interface SessionStore {
  get(waId: string): Promise<Session | null>;
  save(session: Session): Promise<void>;
  delete(waId: string): Promise<void>;
  /** Returns true the first time a WhatsApp message id is seen. Meta retries webhooks, so duplicates happen. */
  markSeen(messageId: string): Promise<boolean>;
  /** Runs fn while holding a per-user lock, so two quick messages from one person are handled in order. */
  withLock<T>(waId: string, fn: () => Promise<T>): Promise<T>;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days of inactivity; the CV itself is safe in Supabase
const SEEN_TTL_SECONDS = 60 * 60 * 24; // Meta retries for up to ~a day
const LOCK_TTL_MS = 15_000;
const LOCK_WAIT_MS = 10_000;

const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end`;

export class RedisSessionStore implements SessionStore {
  constructor(private readonly redis: Redis) {}

  async get(waId: string): Promise<Session | null> {
    const raw = await this.redis.get(`sess:${waId}`);
    return raw ? (JSON.parse(raw) as Session) : null;
  }

  async save(session: Session): Promise<void> {
    await this.redis.set(`sess:${session.waId}`, JSON.stringify(session), "EX", SESSION_TTL_SECONDS);
  }

  async delete(waId: string): Promise<void> {
    await this.redis.del(`sess:${waId}`);
  }

  async markSeen(messageId: string): Promise<boolean> {
    const ok = await this.redis.set(`seen:${messageId}`, "1", "EX", SEEN_TTL_SECONDS, "NX");
    return ok === "OK";
  }

  async withLock<T>(waId: string, fn: () => Promise<T>): Promise<T> {
    const key = `lock:${waId}`;
    const token = randomUUID();
    const deadline = Date.now() + LOCK_WAIT_MS;
    while ((await this.redis.set(key, token, "PX", LOCK_TTL_MS, "NX")) !== "OK") {
      if (Date.now() > deadline) throw new Error(`Timed out waiting for lock ${key}`);
      await new Promise((r) => setTimeout(r, 100));
    }
    try {
      return await fn();
    } finally {
      await this.redis.eval(RELEASE_LOCK_LUA, 1, key, token);
    }
  }
}

/** In-memory version for tests and the local chat simulator. Not for production (single process only). */
export class MemorySessionStore implements SessionStore {
  private sessions = new Map<string, string>();
  private seen = new Set<string>();
  private locks = new Map<string, Promise<unknown>>();

  async get(waId: string) {
    const raw = this.sessions.get(waId);
    return raw ? (JSON.parse(raw) as Session) : null;
  }
  async save(session: Session) {
    this.sessions.set(session.waId, JSON.stringify(session));
  }
  async delete(waId: string) {
    this.sessions.delete(waId);
  }
  async markSeen(messageId: string) {
    if (this.seen.has(messageId)) return false;
    this.seen.add(messageId);
    return true;
  }
  async withLock<T>(waId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.locks.get(waId) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    this.locks.set(waId, run.catch(() => undefined));
    return run;
  }
}
