// Deterministic fixture data shaped like real YouTube Data API v3 responses.
// Used by mock-api.js in dev/e2e (?mock=1) so no API key or network is needed.

function thumb(seed) {
  // 1x1 gif data URI keeps e2e offline; a colored placeholder via svg data URI.
  const colors = ['#f94144', '#f3722c', '#f8961e', '#90be6d', '#43aa8b', '#577590'];
  const c = colors[seed % colors.length].replace('#', '%23');
  return (
    'data:image/svg+xml,' +
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="${c}"/></svg>`
  );
}

export const CHANNELS = [
  { id: 'UCmockrachel00000000000', title: 'Ms Rachel Mock', description: 'Toddler learning videos' },
  { id: 'UCmockblippi00000000000', title: 'Blippi Mock', description: 'Educational fun for kids' },
  { id: 'UCmockelmo0000000000000', title: 'Elmo World Mock', description: 'Elmo songs and stories' },
];

const VIDEO_TITLES = {
  UCmockrachel00000000000: [
    'Learning Colors with Ms Rachel',
    'ABC Phonics Song for Toddlers',
    'Baby Signs and First Words',
    'Wheels on the Bus Sing Along',
    'Counting to Ten with Animals',
  ],
  UCmockblippi00000000000: [
    'Exploring the Fire Station',
    'Learning Shapes at the Playground',
    'Blippi Visits the Aquarium',
    'Whining Kids Compilation', // matches the "whining" keyword in blocking tests
    'Tractors and Trucks for Kids',
  ],
  UCmockelmo0000000000000: [
    'Elmo Sings the Alphabet',
    'Elmo and Friends Share Toys',
    'Bedtime Stories with Elmo',
  ],
};

export function searchResponse(query) {
  const q = (query || '').toLowerCase();
  const items = CHANNELS.filter((c) => c.title.toLowerCase().includes(q) || q === '').map(
    (c, i) => ({
      id: { kind: 'youtube#channel', channelId: c.id },
      snippet: {
        channelId: c.id,
        channelTitle: c.title,
        title: c.title,
        description: c.description,
        thumbnails: { default: { url: thumb(i) }, medium: { url: thumb(i) } },
      },
    })
  );
  return { items };
}

export function playlistItemsResponse(playlistId) {
  const channelId = 'UC' + playlistId.slice(2);
  const titles = VIDEO_TITLES[channelId] || [];
  const channel = CHANNELS.find((c) => c.id === channelId);
  const items = titles.map((title, i) => ({
    snippet: {
      title,
      description: `${title} — a fun video for kids.`,
      publishedAt: new Date(Date.UTC(2026, 5, 20 - i, 12)).toISOString(),
      thumbnails: { default: { url: thumb(i + 1) }, medium: { url: thumb(i + 1) } },
      resourceId: { videoId: `vid-${channelId.slice(6, 12)}-${i}` },
    },
  }));
  // The real API includes placeholders for removed videos: no thumbnails.
  items.push({
    snippet: {
      title: 'Private video',
      description: 'This video is private.',
      publishedAt: new Date(Date.UTC(2026, 5, 1, 12)).toISOString(),
      thumbnails: {},
      resourceId: { videoId: `vid-${channelId.slice(6, 12)}-private` },
    },
  });
  return { items };
}

export function videosResponse(ids) {
  const items = ids.split(',').map((id, i) => ({
    id,
    contentDetails: { duration: `PT${3 + (i % 5)}M${10 * (i % 6)}S` },
  }));
  return { items };
}
