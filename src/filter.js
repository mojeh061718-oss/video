// The core safety logic: pure functions, no storage access, fully unit-tested.
// Applied at RENDER time so a newly added keyword instantly hides cached and
// favorited videos.

/**
 * @param {{id: string, title?: string, description?: string, channelId?: string, channelTitle?: string}} video
 * @param {{channels: {id: string}[], keywords: string[], videos: {id: string}[]}} blocklist
 */
export function isBlocked(video, blocklist) {
  if (blocklist.videos.some((v) => v.id === video.id)) return true;
  if (blocklist.channels.some((c) => c.id === video.channelId)) return true;
  const haystack = [video.title, video.description, video.channelTitle]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return blocklist.keywords.some((keyword) => haystack.includes(keyword));
}

/**
 * Merge cached uploads from all approved channels into one feed,
 * filter through the blocklist, and order it.
 *
 * @param {{channelId: string, videos: object[]}[]} allUploads records from db.getAllUploads()
 * @param {object} blocklist
 * @param {'newest'|'shuffle'} order
 * @param {() => number} [random] injectable for deterministic tests
 */
export function buildFeed(allUploads, blocklist, order = 'newest', random = Math.random) {
  const videos = allUploads.flatMap((record) => record.videos).filter((v) => !isBlocked(v, blocklist));
  if (order === 'shuffle') {
    for (let i = videos.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [videos[i], videos[j]] = [videos[j], videos[i]];
    }
  } else {
    videos.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }
  return videos;
}

/** Favorites are stored as snapshots keyed by videoId; normalize then filter. */
export function filterFavorites(favorites, blocklist) {
  return favorites
    .map((f) => ({
      id: f.videoId,
      title: f.title,
      thumb: f.thumb,
      channelId: f.channelId,
      channelTitle: f.channelTitle,
      addedAt: f.addedAt,
    }))
    .filter((v) => !isBlocked(v, blocklist))
    .sort((a, b) => b.addedAt - a.addedAt);
}
