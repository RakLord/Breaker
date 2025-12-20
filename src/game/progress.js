export function ensureProgress(player) {
  if (!player.progress || typeof player.progress !== "object") {
    player.progress = { level: 1, masterSeed: (Math.random() * 2 ** 32) >>> 0 };
  }
  player.progress.level = Math.max(1, (player.progress.level ?? 1) | 0);
  if (!Number.isFinite(player.progress.masterSeed)) {
    player.progress.masterSeed = (Math.random() * 2 ** 32) >>> 0;
  } else {
    player.progress.masterSeed = player.progress.masterSeed >>> 0;
  }
  return player.progress;
}
