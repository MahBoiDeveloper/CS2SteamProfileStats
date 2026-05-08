const sites = {
  csrep: {
    name: "csrep.gg",
    host: "wsteamcommunity.com"
  },
  leetify: {
    name: "leetify.com",
    host: "steamcommunity.gg"
  },
  csst: {
    name: "csst.at",
    host: "steamcommunity.rip",
    fallbackUrl: "https://csst.at/"
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

let selectedSite = "csrep";
let profilePath = "";
let currentUrl = "";

function normalizeSteamProfile(value) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { ok: false, message: "Введите ссылку на Steam-профиль." };
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
    return { ok: false, message: "Не удалось прочитать ссылку. Проверьте формат URL." };
  }

  const host = url.hostname.toLowerCase();

  if (!steamHosts.has(host)) {
    return { ok: false, message: "Нужна ссылка на профиль Steam Community." };
  }

  const parts = url.pathname.split("/").filter(Boolean);

  if (parts.length < 2) {
    return { ok: false, message: "В ссылке должен быть путь /id/name/ или /profiles/steamid/." };
  }

  const kind = parts[0].toLowerCase();
  const profile = parts[1];

  if (kind === "id" && /^[a-zA-Z0-9_-]{2,64}$/.test(profile)) {
    return { ok: true, path: `/id/${profile}/` };
  }

  if (kind === "profiles" && /^7656119\d{10,}$/.test(profile)) {
    return { ok: true, path: `/profiles/${profile}/` };
  }

  return { ok: false, message: "Поддерживаются только /id/name/ и /profiles/steamid/." };
}

function buildRedirectUrl() {
  if (!profilePath) {
    return "";
  }

  return `https://${sites[selectedSite].host}${profilePath}`;
}

function setStatus(message, state = "") {
  statusText.textContent = message;
  statusText.classList.toggle("is-error", state === "error");
  statusText.classList.toggle("is-ok", state === "ok");
}

function clearFrame(message = "содержимое сайта") {
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
  sitePanel.setAttribute("aria-labelledby", `tab-${selectedSite}`);

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
  render({ loadSite });
  setStatus(loadSite
    ? `Загружаю ${sites[selectedSite].name}.`
    : `Профиль распознан для ${sites[selectedSite].name}.`,
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
    setStatus("Введите Steam-профиль и нажмите Enter.");
    return;
  }

  updateFromInput({ loadSite: hadLoadedFrame });
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    selectedSite = tab.dataset.site;

    if (selectedSite === "csst") {
      updateFromInput();
      window.location.href = currentUrl || sites.csst.fallbackUrl;
      return;
    }

    render({ loadSite: Boolean(profilePath) });

    if (currentUrl) {
      setStatus(`Загружаю ${sites[selectedSite].name}.`, "ok");
    }
  });
});

render();
