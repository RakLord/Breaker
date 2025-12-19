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
  "star-clears-log": "More clears based on bricks cleared.",
  "star-dmg-multi": "Double all ball damage.",
  "star-persist": "Keep normal ball upgrades after prestige.",
  "star-adv-persist": "Keep non-normal ball upgrades after prestige.",
  "ball-damage": "Increase ball damage",
  "ball-speed": "Increase ball speed.",
  "ball-range": "Increase splash radius.",
  "ball-propagation": "Increase extra hits after a block is hit.",
  "ball-crit": "Increase critical hit chance.",
  "ball-exec": "Increase execute threshold on low HP bricks.",
};

export function initTooltips(root = document) {
  const nodes = root.querySelectorAll("[data-tooltip-key]");
  nodes.forEach((el) => {
    if (el._tippy) return;
    const key = el.dataset.tooltipKey;
    const content = TOOLTIP_TEXT[key];
    if (!content) return;
    tippy(el, {
      content,
      theme: "breaker",
      delay: [250, 0],
      maxWidth: 260,
      placement: "top",
    });
  });
}
