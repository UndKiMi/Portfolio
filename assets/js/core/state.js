const state = {
  elements: {
    discord: {},
    github: {},
    sc: {}
  },
  cache: {
    github: null,
    lastGithubFetch: 0,
    discord: null,
    lastDiscordFetch: 0,
    lastDiscordData: null,
    sensCritique: null,
    lastScFetch: 0
  },
  discordFetchInProgress: false
};

const badgeIconsCache = new Map();

export function getState() {
  return state;
}

export function getElements() {
  return state.elements;
}

export function getCache() {
  return state.cache;
}

export function setDiscordFetchInProgress(value) {
  state.discordFetchInProgress = value;
}

export function isDiscordFetchInProgress() {
  return state.discordFetchInProgress;
}

export function getBadgeIconsCache() {
  return badgeIconsCache;
}

