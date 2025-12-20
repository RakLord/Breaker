export function ensureUiState(player) {
  if (!player.ui || typeof player.ui !== "object") {
    player.ui = { ballContextEnabled: false, showHpOverlay: false, ballCardMinimized: {} };
  }
  player.ui.ballContextEnabled = !!player.ui.ballContextEnabled;
  player.ui.showHpOverlay = !!player.ui.showHpOverlay;
  if (!player.ui.ballCardMinimized || typeof player.ui.ballCardMinimized !== "object") {
    player.ui.ballCardMinimized = {};
  }
  return player.ui;
}

export function syncUiStateFromPlayer(player, state) {
  const uiState = ensureUiState(player);
  state.ballContextEnabled = !!uiState.ballContextEnabled;
  state.showHpOverlay = !!uiState.showHpOverlay;
  if (!state.ballContextEnabled) state.ballContextType = null;
}

export function syncUiStateToPlayer(player, state) {
  const uiState = ensureUiState(player);
  uiState.ballContextEnabled = !!state.ballContextEnabled;
  uiState.showHpOverlay = !!state.showHpOverlay;
}

export function getBallCardMinimized(player, typeId) {
  const uiState = ensureUiState(player);
  return !!uiState.ballCardMinimized?.[typeId];
}

export function setBallCardMinimized(player, typeId, minimized) {
  const uiState = ensureUiState(player);
  uiState.ballCardMinimized[typeId] = !!minimized;
}
