// YouTube Data API v3 access. Quota notes (10,000 units/day):
//   search.list = 100 units  -> only on explicit parent search submit
//   channels.list / playlistItems.list / videos.list = 1 unit each
// Feed refreshes are cached in IndexedDB and only re-fetched after a TTL.

import { getSettings, updateSettings, getChannels } from './store.js';
import { getAllUploads, getUploads, putUploads, deleteUploads } from './db.js';
import { mockFetch, mockEnabled } from './mocks/mock-api.js';

const API = 'https://www.googleapis.com/youtube/v3/';

export class YtError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind; // 'noKey' | 'badKey' | 'quota' | 'network' | 'api'
  }
}

async function ytFetch(endpoint, params) {
  const { apiKey } = getSettings();
  if (!apiKey && !mockEnabled()) throw new YtError('noKey', 'No API key configured');

  const url = new URL(API + endpoint);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', apiKey);

  let resp;
  try {
    resp = mockEnabled() ? await mockFetch(endpoint, params) : await fetch(url);
  } catch {
    throw new YtError('network', 'Network request failed');
  }

  let body;
  try {
    body = await resp.json();
  } catch {
    throw new YtError('api', `Unexpected response (${resp.status})`);
  }

  if (!resp.ok || body.error) {
    const reason = body.error?.errors?.[0]?.reason || '';
    const message = body.error?.message || `HTTP ${resp.status}`;
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      updateSettings({ quotaExhaustedUntil: nextMidnightPacific() });
      throw new YtError('quota', 'Daily YouTube API quota reached');
    }
    if (resp.status === 400 || reason === 'keyInvalid' || reason === 'forbidden') {
      throw new YtError('badKey', message);
    }
    throw new YtError('api', message);
  }
  return body;
}

function nextMidnightPacific() {
  // Quota resets at midnight Pacific; approximate without a TZ library.
  const now = new Date();
  const pacific = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
  const msIntoDay =
    ((pacific.getHours() * 60 + pacific.getMinutes()) * 60 + pacific.getSeconds()) * 1000;
  return now.getTime() + (24 * 3600 * 1000 - msIntoDay);
}

export function quotaExhausted() {
  const { quotaExhaustedUntil = 0 } = getSettings();
  return quotaExhaustedUntil > Date.now();
}

/** 1-unit call used to validate a pasted API key (before it's saved to settings). */
export async function validateApiKey(apiKey) {
  const params = { part: 'id', id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' };
  const url = new URL(API + 'channels');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', apiKey);
  let resp;
  try {
    resp = mockEnabled() ? await mockFetch('channels', params) : await fetch(url);
  } catch {
    throw new YtError('network', 'Network request failed');
  }
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok || body.error) {
    throw new YtError('badKey', body.error?.message || `HTTP ${resp.status}`);
  }
  return true;
}

/** Parent-only channel search. 100 quota units — call on submit, never per keystroke. */
export async function searchChannels(query) {
  const body = await ytFetch('search', {
    part: 'snippet',
    type: 'channel',
    q: query,
    maxResults: '10',
    safeSearch: 'strict',
  });
  return (body.items || []).map((item) => ({
    id: item.snippet.channelId,
    title: item.snippet.channelTitle || item.snippet.title,
    description: item.snippet.description,
    thumb: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '',
  }));
}

// A channel's uploads playlist ID is its channel ID with the UC prefix swapped to UU.
export function uploadsPlaylistId(channelId) {
  return 'UU' + channelId.slice(2);
}

function parseDuration(iso) {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
}

/** Fetch a channel's 50 most recent uploads (2 quota units) and cache them. */
export async function refreshChannel(channel) {
  const playlist = await ytFetch('playlistItems', {
    part: 'snippet',
    playlistId: channel.uploadsPlaylistId || uploadsPlaylistId(channel.id),
    maxResults: '50',
  });
  const videos = (playlist.items || [])
    .map((item) => item.snippet)
    // Uploads playlists include "Private video"/"Deleted video" placeholders;
    // they have no thumbnails (a locale-independent signal), so drop them.
    .filter((s) => s?.resourceId?.videoId && (s.thumbnails?.medium?.url || s.thumbnails?.default?.url))
    .map((s) => ({
      id: s.resourceId.videoId,
      title: s.title,
      description: (s.description || '').slice(0, 500),
      thumb: s.thumbnails?.medium?.url || s.thumbnails?.default?.url || '',
      channelId: channel.id,
      channelTitle: channel.title,
      publishedAt: s.publishedAt,
      durationSec: 0,
    }));

  // Batch durations (1 unit) — lets the UI show length badges.
  if (videos.length) {
    try {
      const details = await ytFetch('videos', {
        part: 'contentDetails',
        id: videos.map((v) => v.id).join(','),
        maxResults: '50',
      });
      const byId = new Map((details.items || []).map((i) => [i.id, i.contentDetails?.duration]));
      for (const v of videos) v.durationSec = parseDuration(byId.get(v.id));
    } catch {
      // Durations are cosmetic; keep going without them.
    }
  }

  const record = { channelId: channel.id, fetchedAt: Date.now(), videos };
  await putUploads(record);
  return record;
}

/**
 * Refresh every approved channel whose cache is older than the TTL.
 * Never throws for the kid feed: stale cache is always an acceptable answer.
 * @returns {{refreshed: number, failed: number}}
 */
export async function refreshStaleChannels({ force = false } = {}) {
  const { cacheTtlHours, apiKey } = getSettings();
  if (!apiKey && !mockEnabled()) return { refreshed: 0, failed: 0 };
  if (quotaExhausted() && !force) return { refreshed: 0, failed: 0 };

  const ttlMs = cacheTtlHours * 3600 * 1000;
  const now = Date.now();
  let refreshed = 0;
  let failed = 0;

  for (const channel of getChannels()) {
    const cached = await getUploads(channel.id).catch(() => null);
    // Treat a future fetchedAt (clock skew) as stale.
    const fresh = cached && cached.fetchedAt <= now && now - cached.fetchedAt < ttlMs;
    if (fresh && !force) continue;
    try {
      await refreshChannel(channel);
      refreshed++;
    } catch (err) {
      failed++;
      if (err instanceof YtError && err.kind === 'quota') break;
    }
  }
  return { refreshed, failed };
}

/** All cached uploads for currently-approved channels only. */
export async function getCachedUploads() {
  const approvedIds = new Set(getChannels().map((c) => c.id));
  const all = await getAllUploads().catch(() => []);
  return all.filter((record) => approvedIds.has(record.channelId));
}

export async function dropChannelCache(channelId) {
  await deleteUploads(channelId).catch(() => {});
}
