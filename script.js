const sites = {
  csrep: {
    name: "csrep.gg",
    host: "wsteamcommunity.com",
    fallbackUrl: "https://csrep.gg/"
  },
  leetify: {
    name: "leetify.com",
    host: "steamcommunity.gg",
    fallbackUrl: "https://leetify.com/"
  },
  csst: {
    name: "csst.at",
    host: "steamcommunity.rip",
    fallbackUrl: "https://csst.at/"
  },
  fastgg: {
    name: "fastgg.pro",
    fixedUrl: "https://fastgg.pro/trust-factor-checker/",
    fallbackUrl: "https://fastgg.pro/trust-factor-checker/"
  }
};

const steamHosts = new Set([
  "steamcommunity.com",
  "www.steamcommunity.com",
  "wsteamcommunity.com",
  "www.wsteamcommunity.com",
  "steamcommunity.gg",
  "www.steamcommunity.gg",
  "steamcommunity.rip",
  "www.steamcommunity.rip"
]);

const form = document.querySelector("#profileForm");
const input = document.querySelector("#steamInput");
const tabs = Array.from(document.querySelectorAll(".tab"));
const sitePanel = document.querySelector("#sitePanel");
const siteFrame = document.querySelector("#siteFrame");
const framePlaceholder = document.querySelector("#framePlaceholder");
const statusText = document.querySelector("#statusText");
const profileHistory = document.querySelector("#profileHistory");
const historyList = document.querySelector("#historyList");
const historyTooltip = document.createElement("div");

const historyStorageKey = "cs2site.profileSearchHistory";
const historyLimit = 16;
const historyRefreshAfter = 1000 * 60 * 60 * 24 * 7;

let selectedSite = "";
let profilePath = "";
let currentUrl = "";
let searchHistory = loadSearchHistory();
const pendingProfileRequests = new Map();

historyTooltip.className = "history-tooltip";
historyTooltip.hidden = true;
document.body.append(historyTooltip);

function normalizeSteamProfile(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: false, message: "Enter your Steam profile link." };
  }

  if (/^7656119\d{10,}$/.test(trimmed)) {
    return { ok: true, path: `/profiles/${trimmed}/` };
  }

  if (/^[a-zA-Z0-9_-]{2,64}$/.test(trimmed)) {
    return { ok: true, path: `/id/${trimmed}/` };
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  let url;

  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, message: "Could not read the link. Check the URL format." };
  }

  const host = url.hostname.toLowerCase();

  if (!steamHosts.has(host)) {
    return { ok: false, message: "Use a Steam Community profile link." };
  }

  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length < 2) {
    return { ok: false, message: "The link must contain /id/name/ or /profiles/steamid/." };
  }

  const kind = parts[0].toLowerCase();
  const profile = parts[1];

  if (kind === "id" && /^[a-zA-Z0-9_-]{2,64}$/.test(profile)) {
    return { ok: true, path: `/id/${profile}/` };
  }

  if (kind === "profiles" && /^7656119\d{10,}$/.test(profile)) {
    return { ok: true, path: `/profiles/${profile}/` };
  }

  return { ok: false, message: "Only /id/name/ and /profiles/steamid/ links are supported." };
}

function isSupportedProfilePath(path) {
  return /^\/(?:id\/[a-zA-Z0-9_-]{2,64}|profiles\/7656119\d{10,})\/$/.test(path);
}

function buildSteamProfileUrl(path) {
  return `https://steamcommunity.com${path}`;
}

function getProfileSlug(path) {
  const parts = path.split("/").filter(Boolean);
  return parts[1] || "Steam";
}

function getFallbackName(path) {
  const slug = getProfileSlug(path);

  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

function getInitials(name) {
  const normalized = name.trim();

  if (!normalized) {
    return "ST";
  }

  const words = normalized.split(/\s+/).filter(Boolean);

  if (words.length > 1) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return normalized.slice(0, 2).toUpperCase();
}

function loadSearchHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((entry) => ({
        profilePath: typeof entry.profilePath === "string" ? entry.profilePath : "",
        profileUrl: typeof entry.profileUrl === "string" ? entry.profileUrl : "",
        nickname: typeof entry.nickname === "string" ? entry.nickname : "",
        avatarUrl: typeof entry.avatarUrl === "string" ? entry.avatarUrl : "",
        savedAt: Number(entry.savedAt) || 0,
        fetchedAt: Number(entry.fetchedAt) || 0
      }))
      .filter((entry) => isSupportedProfilePath(entry.profilePath))
      .slice(0, historyLimit);
  } catch {
    return [];
  }
}

function saveSearchHistory() {
  try {
    localStorage.setItem(historyStorageKey, JSON.stringify(searchHistory.slice(0, historyLimit)));
  } catch {
    // History is optional; keep the page usable if storage is unavailable.
  }
}

function createHistoryClearButton() {
  const button = document.createElement("button");
  button.className = "history-clear";
  button.type = "button";
  button.title = "Delete saved accounts";
  button.setAttribute("aria-label", "Delete saved accounts");

  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");

  const label = document.createElement("span");
  label.className = "visually-hidden";
  label.textContent = "Delete saved accounts";

  icon.append(path);
  button.append(icon, label);

  return button;
}

function renderHistory() {
  hideHistoryTooltip();
  historyList.replaceChildren();
  profileHistory.hidden = searchHistory.length === 0;

  if (searchHistory.length > 0) {
    historyList.append(createHistoryClearButton());
  }

  searchHistory.forEach((entry) => {
    const nickname = entry.nickname || getFallbackName(entry.profilePath);
    const profileUrl = entry.profileUrl || buildSteamProfileUrl(entry.profilePath);
    const item = document.createElement("button");
    const hasAvatar = Boolean(entry.avatarUrl);

    item.className = "history-avatar";
    item.classList.toggle("has-image", hasAvatar);
    item.type = "button";
    item.dataset.nickname = nickname;
    item.dataset.profileUrl = profileUrl;
    item.setAttribute("aria-label", `Вставить профиль ${nickname}: ${profileUrl}`);

    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";

    if (hasAvatar) {
      image.src = entry.avatarUrl;
    }

    image.addEventListener("error", () => {
      item.classList.remove("has-image");
      image.removeAttribute("src");
    });

    const fallback = document.createElement("span");
    fallback.className = "history-fallback";
    fallback.textContent = getInitials(nickname);

    item.append(image, fallback);
    historyList.append(item);
  });
}

function positionHistoryTooltip(item) {
  const itemRect = item.getBoundingClientRect();
  historyTooltip.style.left = `${itemRect.left + itemRect.width / 2}px`;
  historyTooltip.style.top = `${Math.max(8, itemRect.top - 10)}px`;

  window.requestAnimationFrame(() => {
    const tooltipRect = historyTooltip.getBoundingClientRect();
    const minLeft = tooltipRect.width / 2 + 8;
    const maxLeft = window.innerWidth - tooltipRect.width / 2 - 8;
    const preferredLeft = itemRect.left + itemRect.width / 2;
    const safeLeft = Math.min(Math.max(preferredLeft, minLeft), maxLeft);

    historyTooltip.style.left = `${safeLeft}px`;
  });
}

function showHistoryTooltip(item) {
  const nickname = item.dataset.nickname || "";
  const profileUrl = item.dataset.profileUrl || "";

  historyTooltip.replaceChildren();

  const tooltipName = document.createElement("span");
  tooltipName.className = "history-name";
  tooltipName.textContent = nickname;

  const tooltipLink = document.createElement("span");
  tooltipLink.className = "history-link";
  tooltipLink.textContent = profileUrl;

  historyTooltip.append(tooltipName, tooltipLink);
  historyTooltip.hidden = false;
  positionHistoryTooltip(item);
}

function hideHistoryTooltip() {
  historyTooltip.hidden = true;
}

function insertHistoryProfile(item) {
  const profileUrl = item.dataset.profileUrl || "";

  if (!profileUrl) {
    return;
  }

  input.value = profileUrl;
  input.focus();
  updateFromInput();
}

function upsertHistoryEntry(entry) {
  if (!isSupportedProfilePath(entry.profilePath)) {
    return;
  }

  const profileUrl = entry.profileUrl || buildSteamProfileUrl(entry.profilePath);
  const existing = searchHistory.find((item) => item.profilePath === entry.profilePath);
  const nextEntry = {
    profilePath: entry.profilePath,
    profileUrl,
    nickname: entry.nickname || existing?.nickname || getFallbackName(entry.profilePath),
    avatarUrl: entry.avatarUrl || existing?.avatarUrl || "",
    savedAt: entry.savedAt || existing?.savedAt || Date.now(),
    fetchedAt: entry.fetchedAt || existing?.fetchedAt || 0
  };

  searchHistory = [
    nextEntry,
    ...searchHistory.filter((item) => item.profilePath !== entry.profilePath)
  ].slice(0, historyLimit);

  saveSearchHistory();
  renderHistory();
}

function clearSearchHistory() {
  if (searchHistory.length === 0 || !window.confirm("Удалить все сохраненные аккаунты?")) {
    return;
  }

  searchHistory = [];
  hideHistoryTooltip();

  try {
    localStorage.removeItem(historyStorageKey);
  } catch {
    // History is optional; keep the page usable if storage is unavailable.
  }

  renderHistory();
  setStatus("Saved accounts removed.");
}

function rememberProfile(path) {
  if (!isSupportedProfilePath(path)) {
    return;
  }

  upsertHistoryEntry({
    profilePath: path,
    profileUrl: buildSteamProfileUrl(path),
    savedAt: Date.now()
  });

  refreshHistoryEntry(path);
}

function readXmlText(xml, selector) {
  return xml.querySelector(selector)?.textContent?.trim() || "";
}

async function fetchTextWithTimeout(url, timeout = 8000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      cache: "force-cache",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Profile request failed: ${response.status}`);
    }

    return await response.text();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchJsonWithTimeout(url, timeout = 8000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      cache: "force-cache",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Profile request failed: ${response.status}`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function fetchPlayerDbProfileMetadata(path) {
  const lookupId = getProfileSlug(path);
  const data = await fetchJsonWithTimeout(`https://playerdb.co/api/player/steam/${encodeURIComponent(lookupId)}`);
  const player = data?.data?.player;
  const meta = player?.meta || {};

  if (!data?.success || !player) {
    throw new Error("PlayerDB did not return a Steam profile.");
  }

  const nickname = player.username || meta.personaname || "";
  const profileUrl = meta.profileurl || buildSteamProfileUrl(path);
  const avatarUrl = player.avatar || meta.avatarfull || meta.avatarmedium || meta.avatar || "";

  if (!nickname && !avatarUrl) {
    throw new Error("PlayerDB response does not include visible profile metadata.");
  }

  return {
    profilePath: path,
    profileUrl,
    nickname,
    avatarUrl,
    fetchedAt: Date.now()
  };
}

async function fetchSteamXmlProfileMetadata(path) {
  const steamXmlUrl = `${buildSteamProfileUrl(path)}?xml=1`;
  const metadataUrls = [steamXmlUrl];

  for (const url of metadataUrls) {
    try {
      const text = await fetchTextWithTimeout(url);
      const xml = new DOMParser().parseFromString(text, "text/xml");

      if (xml.querySelector("parsererror")) {
        continue;
      }

      const error = readXmlText(xml, "error");

      if (error) {
        continue;
      }

      const nickname = readXmlText(xml, "steamID");
      const profileUrl = readXmlText(xml, "profileURL") || buildSteamProfileUrl(path);
      const avatarUrl = readXmlText(xml, "avatarFull")
        || readXmlText(xml, "avatarMedium")
        || readXmlText(xml, "avatarIcon");

      if (nickname || avatarUrl) {
        return {
          profilePath: path,
          profileUrl,
          nickname,
          avatarUrl,
          fetchedAt: Date.now()
        };
      }
    } catch {
      // The direct Steam XML request can be blocked by CORS on static hosting.
    }
  }

  throw new Error("Could not load Steam profile metadata.");
}

async function fetchSteamProfileMetadata(path) {
  const loaders = [
    fetchPlayerDbProfileMetadata,
    fetchSteamXmlProfileMetadata
  ];

  for (const loader of loaders) {
    try {
      return await loader(path);
    } catch {
      // Try the next metadata source.
    }
  }

  throw new Error("Could not load Steam profile metadata.");
}

function refreshHistoryEntry(path) {
  if (pendingProfileRequests.has(path)) {
    return pendingProfileRequests.get(path);
  }

  const request = fetchSteamProfileMetadata(path)
    .then((metadata) => {
      if (searchHistory.some((entry) => entry.profilePath === metadata.profilePath)) {
        upsertHistoryEntry(metadata);
      }

      return metadata;
    })
    .catch(() => null)
    .finally(() => {
      pendingProfileRequests.delete(path);
    });

  pendingProfileRequests.set(path, request);
  return request;
}

function refreshStaleHistory() {
  const now = Date.now();

  searchHistory
    .filter((entry) => !entry.avatarUrl || now - entry.fetchedAt > historyRefreshAfter)
    .slice(0, 4)
    .forEach((entry) => refreshHistoryEntry(entry.profilePath));
}

function buildRedirectUrl() {
  if (!profilePath || !selectedSite) {
    return "";
  }

  return buildSiteUrl(selectedSite, profilePath);
}

function buildSiteUrl(siteKey, path) {
  const site = sites[siteKey];

  if (!site) {
    return "";
  }

  if (site.fixedUrl) {
    return site.fixedUrl;
  }

  if (!path) {
    return "";
  }

  return `https://${site.host}${path}`;
}

function buildExternalUrl(siteKey) {
  const site = sites[siteKey];
  const parsedProfile = normalizeSteamProfile(input.value);
  const path = parsedProfile.ok ? parsedProfile.path : profilePath;

  if (!path) {
    return site.fallbackUrl;
  }

  return buildSiteUrl(siteKey, path) || site.fallbackUrl;
}

function openExternalPage(siteKey) {
  const result = normalizeSteamProfile(input.value);

  if (result.ok) {
    profilePath = result.path;
    rememberProfile(result.path);
  }

  window.open(buildExternalUrl(siteKey), "_blank", "noopener");
}

function setStatus(message, state = "") {
  statusText.textContent = message;
  statusText.classList.toggle("is-error", state === "error");
  statusText.classList.toggle("is-ok", state === "ok");
}

function clearFrame(message = "There will be rendered selected site") {
  siteFrame.hidden = true;
  siteFrame.removeAttribute("src");
  framePlaceholder.hidden = false;
  framePlaceholder.textContent = message;
}

function loadFrame() {
  if (!currentUrl) {
    clearFrame();
    return;
  }

  framePlaceholder.hidden = true;
  siteFrame.hidden = false;

  if (siteFrame.src !== currentUrl) {
    siteFrame.src = currentUrl;
  }
}

function render({ loadSite = false } = {}) {
  if (selectedSite) {
    sitePanel.setAttribute("aria-labelledby", `tab-${selectedSite}`);
    sitePanel.removeAttribute("aria-label");
  } else {
    sitePanel.removeAttribute("aria-labelledby");
    sitePanel.setAttribute("aria-label", "Встроенный просмотр выбранного сайта");
  }

  tabs.forEach((tab) => {
    const isActive = tab.dataset.site === selectedSite;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  currentUrl = buildRedirectUrl();

  if (!currentUrl) {
    clearFrame();
    return;
  }

  if (loadSite) {
    loadFrame();
  }
}

function updateFromInput({ loadSite = false, saveSearch = false } = {}) {
  const result = normalizeSteamProfile(input.value);

  if (!result.ok) {
    profilePath = "";
    render();
    setStatus(result.message, "error");
    return false;
  }

  profilePath = result.path;

  if (saveSearch) {
    rememberProfile(profilePath);
  }

  if (!selectedSite) {
    render();
    setStatus("Select a site tab.", "error");
    return false;
  }

  render({ loadSite });
  setStatus(loadSite
    ? `Loading ${sites[selectedSite].name}.`
    : `Profile recognized for ${sites[selectedSite].name}.`,
  "ok");
  return true;
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  updateFromInput({ loadSite: true, saveSearch: true });
});

input.addEventListener("input", () => {
  const hadLoadedFrame = Boolean(siteFrame.getAttribute("src"));

  if (!input.value.trim()) {
    profilePath = "";
    render();
    setStatus("Enter your Steam profile and press Enter.");
    return;
  }

  updateFromInput({ loadSite: hadLoadedFrame, saveSearch: hadLoadedFrame });
});

historyList.addEventListener("pointerover", (event) => {
  const item = event.target.closest(".history-avatar");

  if (item && historyList.contains(item)) {
    showHistoryTooltip(item);
  }
});

historyList.addEventListener("pointerout", (event) => {
  const item = event.target.closest(".history-avatar");

  if (item && !item.contains(event.relatedTarget)) {
    hideHistoryTooltip();
  }
});

historyList.addEventListener("focusin", (event) => {
  const item = event.target.closest(".history-avatar");

  if (item && historyList.contains(item)) {
    showHistoryTooltip(item);
  }
});

historyList.addEventListener("focusout", hideHistoryTooltip);
window.addEventListener("resize", hideHistoryTooltip);
historyList.addEventListener("scroll", hideHistoryTooltip);

historyList.addEventListener("click", (event) => {
  const clearButton = event.target.closest(".history-clear");

  if (clearButton && historyList.contains(clearButton)) {
    clearSearchHistory();
    return;
  }

  const item = event.target.closest(".history-avatar");

  if (item && historyList.contains(item)) {
    insertHistoryProfile(item);
  }
});

tabs.forEach((tab) => {
  tab.addEventListener("mousedown", (event) => {
    if (event.button === 1) {
      event.preventDefault();
    }
  });

  tab.addEventListener("auxclick", (event) => {
    if (event.button !== 1) {
      return;
    }

    event.preventDefault();
    openExternalPage(tab.dataset.site);
  });

  tab.addEventListener("click", () => {
    const siteKey = tab.dataset.site;

    if (siteKey === "csst") {
      openExternalPage(siteKey);
      setStatus(`Opened ${sites.csst.name} in a new tab.`, "ok");
      return;
    }

    selectedSite = siteKey;

    if (input.value.trim()) {
      updateFromInput({ loadSite: true, saveSearch: true });
    } else {
      render();
    }

    if (currentUrl) {
      setStatus(`Loading ${sites[selectedSite].name}.`, "ok");
    }
  });
});

renderHistory();
refreshStaleHistory();
render();
