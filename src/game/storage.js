import { normalizePlayer } from "../../player.js";

function base64EncodeUtf8(str) {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  } catch {
    try {
      return btoa(unescape(encodeURIComponent(str)));
    } catch {
      return "";
    }
  }
}

function base64DecodeUtf8(str) {
  try {
    const binary = atob(str);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    try {
      return decodeURIComponent(escape(atob(str)));
    } catch {
      return null;
    }
  }
}

export function buildPlayerSnapshot({ player, game, grid, state }) {
  const snapshot = normalizePlayer({
    ...player,
    game: {
      ...(player.game ?? {}),
      balls: game.balls.map((b) => b.toJSONData()),
      grid: grid.toJSONData(),
      initialBlocks: state.initialBlocks,
    },
  });
  snapshot.meta = snapshot.meta || {};
  snapshot.meta.lastSavedAt = Date.now();
  return snapshot;
}

export function encodeSaveString(snapshot) {
  try {
    return base64EncodeUtf8(JSON.stringify(snapshot));
  } catch {
    return "";
  }
}

export function decodeSaveString(raw) {
  if (!raw) return null;
  const decoded = base64DecodeUtf8(raw);
  if (!decoded) return null;
  try {
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
