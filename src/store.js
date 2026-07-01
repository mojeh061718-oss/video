// localStorage-backed app state. Everything is small JSON under a `kidtube:` prefix.
// Bulky cached video metadata lives in IndexedDB (db.js), not here.

const PREFIX = 'kidtube:';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

const DEFAULT_SETTINGS = {
  apiKey: '',
  pinSalt: '',
  pinHash: '',
  feedOrder: 'newest', // 'newest' | 'shuffle'
  cacheTtlHours: 6,
  playbackMode: 'embedded', // 'embedded' (locked-in) | 'youtubeApp' (ad-free via Premium profile)
  onboarded: false,
};

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...read('settings', {}) };
}

export function updateSettings(patch) {
  const next = { ...getSettings(), ...patch };
  write('settings', next);
  return next;
}

// ---- Approved channels ----------------------------------------------------

export function getChannels() {
  return read('channels', []);
}

export function addChannel(channel) {
  const channels = getChannels();
  if (!channels.some((c) => c.id === channel.id)) {
    channels.push({ ...channel, addedAt: Date.now() });
    write('channels', channels);
  }
  // Approving a channel always clears it from the blocklist.
  const blocklist = getBlocklist();
  if (blocklist.channels.some((c) => c.id === channel.id)) {
    blocklist.channels = blocklist.channels.filter((c) => c.id !== channel.id);
    write('blocklist', blocklist);
  }
  return getChannels();
}

export function removeChannel(channelId) {
  write('channels', getChannels().filter((c) => c.id !== channelId));
  return getChannels();
}

// ---- Blocklist ------------------------------------------------------------

export function getBlocklist() {
  return { channels: [], keywords: [], videos: [], ...read('blocklist', {}) };
}

export function blockChannel(id, title) {
  const bl = getBlocklist();
  if (!bl.channels.some((c) => c.id === id)) {
    bl.channels.push({ id, title });
    write('blocklist', bl);
  }
  // The channel stays approved (the blocklist hides its videos), so a
  // mistaken block is fully reversible with Unblock.
  return getBlocklist();
}

export function unblockChannel(id) {
  const bl = getBlocklist();
  bl.channels = bl.channels.filter((c) => c.id !== id);
  write('blocklist', bl);
  return bl;
}

export function addKeyword(word) {
  const keyword = word.trim().toLowerCase();
  const bl = getBlocklist();
  if (keyword && !bl.keywords.includes(keyword)) {
    bl.keywords.push(keyword);
    write('blocklist', bl);
  }
  return getBlocklist();
}

export function removeKeyword(word) {
  const bl = getBlocklist();
  bl.keywords = bl.keywords.filter((k) => k !== word);
  write('blocklist', bl);
  return bl;
}

export function blockVideo(videoId, title = '') {
  const bl = getBlocklist();
  if (!bl.videos.some((v) => v.id === videoId)) {
    bl.videos.push({ id: videoId, title });
    write('blocklist', bl);
  }
  return getBlocklist();
}

export function unblockVideo(videoId) {
  const bl = getBlocklist();
  bl.videos = bl.videos.filter((v) => v.id !== videoId);
  write('blocklist', bl);
  return bl;
}

// ---- Favorites ------------------------------------------------------------
// Full metadata snapshots so favorites survive cache eviction.

export function getFavorites() {
  return read('favorites', []);
}

export function isFavorite(videoId) {
  return getFavorites().some((f) => f.videoId === videoId);
}

export function toggleFavorite(video) {
  let favorites = getFavorites();
  if (favorites.some((f) => f.videoId === video.id)) {
    favorites = favorites.filter((f) => f.videoId !== video.id);
  } else {
    favorites.push({
      videoId: video.id,
      title: video.title,
      thumb: video.thumb,
      channelId: video.channelId,
      channelTitle: video.channelTitle,
      addedAt: Date.now(),
    });
  }
  write('favorites', favorites);
  return favorites;
}

// ---- PIN attempt lockout ----------------------------------------------------

export function getPinAttempts() {
  return { count: 0, lockedUntil: 0, ...read('pinAttempts', {}) };
}

export function setPinAttempts(attempts) {
  write('pinAttempts', attempts);
}

// ---- Backup ------------------------------------------------------------------
// Export/import every kidtube:* key except the rebuildable video cache.

export function exportBackup() {
  const data = {};
  for (const key of ['settings', 'channels', 'blocklist', 'favorites']) {
    data[key] = read(key, null);
  }
  return JSON.stringify({ kidtube: 1, data });
}

export function importBackup(json) {
  const parsed = JSON.parse(json);
  if (parsed?.kidtube !== 1 || typeof parsed.data !== 'object') {
    throw new Error('Not a KidTube backup');
  }
  for (const [key, value] of Object.entries(parsed.data)) {
    if (value !== null) write(key, value);
  }
}
