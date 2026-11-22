import type { Pos } from "./nav";

/**
 * Deck ⇄ presenter window. Messages carry absolute positions, never "next", so a message that
 * arrives twice (postMessage and BroadcastChannel) changes nothing the second time.
 * Every message also carries the deck's id: a presenter window only follows the deck that opened
 * it, so a second deck tab left open somewhere cannot hijack the talk.
 * postMessage works from file:// as well as http://; BroadcastChannel covers a reloaded deck.
 */
export type Msg =
  | { kind: "state"; pos: Pos; startedAt: number | null }
  | { kind: "set"; pos: Pos }
  | { kind: "timer"; startedAt: number | null }
  | { kind: "hello" };

const TAG = "mieruka-pitch";
let channel: BroadcastChannel | null = null;
try {
  channel = new BroadcastChannel(TAG);
} catch {
  channel = null;
}

let peer: Window | null = null;

export function setPeer(w: Window | null) {
  peer = w;
}

/** Stable for the life of a deck tab, including reloads. */
export function deckId(): string {
  const key = "mieruka-deck-id";
  try {
    const v = sessionStorage.getItem(key);
    if (v) return v;
    const fresh = Math.random().toString(36).slice(2, 8);
    sessionStorage.setItem(key, fresh);
    return fresh;
  } catch {
    return Math.random().toString(36).slice(2, 8);
  }
}

export function post(id: string, msg: Msg) {
  const data = { tag: TAG, id, msg };
  try {
    if (peer && !peer.closed) peer.postMessage(data, "*");
  } catch {
    /* the other window went away */
  }
  try {
    channel?.postMessage(data);
  } catch {
    /* opaque origins can refuse BroadcastChannel */
  }
}

export function listen(fn: (msg: Msg, id: string, source: Window | null) => void) {
  const onMessage = (e: MessageEvent) => {
    if (e.data && e.data.tag === TAG && typeof e.data.id === "string") fn(e.data.msg as Msg, e.data.id, (e.source as Window | null) ?? null);
  };
  window.addEventListener("message", onMessage);
  channel?.addEventListener("message", onMessage);
  return () => {
    window.removeEventListener("message", onMessage);
    channel?.removeEventListener("message", onMessage);
  };
}
