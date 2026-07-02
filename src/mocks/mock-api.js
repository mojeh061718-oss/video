// Fetch-shaped fake for the YouTube Data API. Enable with ?mock=1 (persists to
// localStorage for the session's subsequent reloads) or ?mock=quota to
// exercise the quota-exhausted path. ?mock=0 turns it off.

import { searchResponse, playlistItemsResponse, videosResponse } from './fixtures.js';

const KEY = 'kidtube:mock';

// Reading the URL param once at boot lets e2e tests flip modes per-navigation.
const param = new URLSearchParams(location.search).get('mock');
if (param !== null) {
  if (param === '0') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, param);
}

export function mockEnabled() {
  return localStorage.getItem(KEY) !== null;
}

function mockMode() {
  return localStorage.getItem(KEY);
}

function ok(body) {
  return { ok: true, status: 200, json: async () => body };
}

function error(status, reason, message) {
  return {
    ok: false,
    status,
    json: async () => ({ error: { code: status, message, errors: [{ reason }] } }),
  };
}

export async function mockFetch(endpoint, params) {
  if (mockMode() === 'quota') {
    return error(403, 'quotaExceeded', 'The request cannot be completed because you have exceeded your quota.');
  }
  if (mockMode() === 'badkey') {
    return error(400, 'keyInvalid', 'API key not valid. Please pass a valid API key.');
  }
  switch (endpoint) {
    case 'channels':
      return ok({ items: [{ id: params.id }] });
    case 'search':
      return ok(searchResponse(params.q));
    case 'playlistItems':
      return ok(playlistItemsResponse(params.playlistId));
    case 'videos':
      return ok(videosResponse(params.id));
    default:
      return error(404, 'notFound', `Unknown mock endpoint: ${endpoint}`);
  }
}
