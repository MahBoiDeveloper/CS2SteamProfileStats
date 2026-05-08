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

let selectedSite = "";
let profilePath = "";
let currentUrl = "";

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

function updateFromInput({ loadSite = false } = {}) {
  const result = normalizeSteamProfile(input.value);

  if (!result.ok) {
    profilePath = "";
    render();
    setStatus(result.message, "error");
    return false;
  }

  profilePath = result.path;

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
  updateFromInput({ loadSite: true });
});

input.addEventListener("input", () => {
  const hadLoadedFrame = Boolean(siteFrame.getAttribute("src"));

  if (!input.value.trim()) {
    profilePath = "";
    render();
    setStatus("Enter your Steam profile and press Enter.");
    return;
  }

  updateFromInput({ loadSite: hadLoadedFrame });
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
    window.location.href = buildExternalUrl(tab.dataset.site);
  });

  tab.addEventListener("click", () => {
    selectedSite = tab.dataset.site;

    if (selectedSite === "csst") {
      updateFromInput();
      window.location.href = currentUrl || sites.csst.fallbackUrl;
      return;
    }

    render({ loadSite: Boolean(profilePath) });

    if (currentUrl) {
      setStatus(`Loading ${sites[selectedSite].name}.`, "ok");
    }
  });
});

render();
