import tippy from "tippy.js";

export const TOOLTIP_TEXT = {
  "ball-focus": "Focus view: only show the hovered ball type on the canvas.",
  "cell-hp": "Toggle brick HP numbers on the grid.",
  "clears-density": "Spend clears to increase brick density.",
  "clears-grid": "Spend clears to shrink cells and fit more bricks.",
  "clears-hp": "Spend clears to reduce starting brick HP.",
  "star-propagation": "Unlock propagation upgrades for balls.",
  "star-critical": "Unlock critical hit upgrades for balls.",
  "star-execution": "Unlock execute upgrades to finish low HP bricks.",
  "star-prop-cap": "Increase the propagation upgrade cap.",
  "star-normal-cap": "Increase the Normal ball cap by 1 (max +2).",
  "star-clears-log": "More clears based on bricks cleared.",
  "star-dmg-multi": "Double all ball damage.",
  "star-persist": "Keep normal ball upgrades after prestige.",
  "star-dps": "Show DPS stats on ball cards.",
  "star-adv-persist": "Keep non-normal ball upgrades after prestige.",
  "star-heavy-ball": "Unlock the Heavy ball.",
  "star-collapse": "Star resets award multiple stars based on level.",
  "star-ballcount": "Keep your balls when you prestige Clears.",
  "star-basic-balls": "Normal balls get +5 damage and +5 speed.",
  "star-brick-boost": "Weaker Bricks is 2x stronger per tier (max 3).",
  "star-more-points": "Gain 1.2x points per level (max 10).",
  "star-buffer-overflow": "Gain 10% of buffered clears per level completion (max 3).",
  "star-more-stars": "Multiply star prestige gains by log10(clears).",
  "star-board-wipe": "0.01% chance per cell kill to wipe the board.",
  "star-more-board-wipes": "Multiplies Board Wipe chance by 10x.",
  "star-clear-fire-sale": "Clear shop upgrades cost 100x less.",
  "star-better-formula": "Boost star gains based on current clears (3 levels).",
  "ball-damage": "Increase ball damage",
  "ball-speed": "Increase ball speed.",
  "ball-size": "Increase Heavy ball size.",
  "ball-range": "Increase splash radius.",
  "ball-propagation": "Increase extra hits after a block is hit.",
  "ball-crit": "Increase critical hit chance.",
  "ball-exec": "Increase execute threshold on low HP bricks.",
};

function ensureTooltipTarget(el, key) {
  if (!el || !key) return null;
  if (el.tagName === "BUTTON") {
    const parent = el.parentElement;
    if (parent?.classList?.contains("tooltip-wrap")) return parent;
    const wrapper = document.createElement("span");
    wrapper.className = "tooltip-wrap";
    wrapper.dataset.tooltipKey = key;
    el.removeAttribute("data-tooltip-key");
    parent?.insertBefore(wrapper, el);
    wrapper.appendChild(el);
    return wrapper;
  }
  return el;
}

export function initTooltips(root = document) {
  const nodes = root.querySelectorAll("[data-tooltip-key]");
  nodes.forEach((el) => {
    const key = el.dataset.tooltipKey;
    const content = TOOLTIP_TEXT[key];
    if (!content) return;
    const target = ensureTooltipTarget(el, key);
    if (!target || target._tippy) return;
    tippy(target, {
      content,
      theme: "breaker",
      delay: [250, 0],
      maxWidth: 260,
      placement: "top",
    });
  });
}
