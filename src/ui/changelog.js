export const CHANGELOG_LATEST = {
  version: "V0.2.4",
  items: [
    "Buffer Overflow star upgrade (Tier 4).",
    "More Stars star upgrade (Tier 5).",
    "Board Wipe star upgrade (Tier 4).",
    "More Board Wipes star upgrade (Tier 5).",
    "Clear Fire Sale star upgrade (Tier 5).",
    "Ball DPS tracking (10s window) shown in ball cards.",
    "DPS Stats star upgrade (Tier 1).",
    "Starboard Mult star upgrade (Tier 5).",
    "Manual Splash Ball star upgrade (Tier 2).",
    "Time Star Mult star upgrade (Tier 3).",
    "Stars modal shows time spent in current reset.",
    "Special Ball Cap star upgrade (Tier 3).",
  ],
};

export function populateChangelog(dom, changelog = CHANGELOG_LATEST) {
  if (!dom) return;
  const { appVersionEl, changelogVersionEl, changelogListEl } = dom;
  if (appVersionEl) appVersionEl.textContent = changelog.version;
  if (changelogVersionEl) changelogVersionEl.textContent = changelog.version;
  if (!changelogListEl) return;
  changelogListEl.innerHTML = "";
  for (const item of changelog.items) {
    const li = document.createElement("li");
    li.textContent = item;
    changelogListEl.appendChild(li);
  }
}

export function createChangelogController({ appVersionEl, changelogModal }) {
  let changelogHideTimer = null;

  function openChangelogModal() {
    if (!changelogModal) return;
    if (changelogHideTimer) {
      clearTimeout(changelogHideTimer);
      changelogHideTimer = null;
    }
    changelogModal.classList.remove("hidden");
    changelogModal.setAttribute("aria-hidden", "false");
    if (appVersionEl) appVersionEl.setAttribute("aria-expanded", "true");
  }

  function closeChangelogModal() {
    if (!changelogModal) return;
    changelogModal.classList.add("hidden");
    changelogModal.setAttribute("aria-hidden", "true");
    if (appVersionEl) appVersionEl.setAttribute("aria-expanded", "false");
  }

  function scheduleChangelogClose() {
    if (changelogHideTimer) clearTimeout(changelogHideTimer);
    changelogHideTimer = setTimeout(closeChangelogModal, 120);
  }

  return {
    openChangelogModal,
    closeChangelogModal,
    scheduleChangelogClose,
  };
}
