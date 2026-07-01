import { describe, it, expect } from 'vitest';
import { isBlocked, buildFeed, filterFavorites } from '../../src/filter.js';

const empty = { channels: [], keywords: [], videos: [] };

const video = (over = {}) => ({
  id: 'v1',
  title: 'Learning Colors',
  description: 'Fun colors video',
  channelId: 'UC1',
  channelTitle: 'Ms Rachel',
  publishedAt: '2026-06-01T00:00:00Z',
  ...over,
});

describe('isBlocked', () => {
  it('passes clean videos', () => {
    expect(isBlocked(video(), empty)).toBe(false);
  });

  it('blocks by video id', () => {
    expect(isBlocked(video(), { ...empty, videos: [{ id: 'v1' }] })).toBe(true);
  });

  it('blocks by channel id', () => {
    expect(isBlocked(video(), { ...empty, channels: [{ id: 'UC1' }] })).toBe(true);
  });

  it('blocks keywords in the title case-insensitively', () => {
    const bl = { ...empty, keywords: ['colors'] };
    expect(isBlocked(video({ title: 'LEARNING COLORS!' }), bl)).toBe(true);
  });

  it('blocks keywords appearing only in the description', () => {
    const bl = { ...empty, keywords: ['whining'] };
    expect(isBlocked(video({ description: 'so much Whining here' }), bl)).toBe(true);
  });

  it('blocks keywords in the channel name (e.g. "elmo")', () => {
    const bl = { ...empty, keywords: ['elmo'] };
    expect(isBlocked(video({ channelTitle: 'Elmo World' }), bl)).toBe(true);
  });

  it('matches substrings ("cry" hits "crying")', () => {
    const bl = { ...empty, keywords: ['cry'] };
    expect(isBlocked(video({ title: 'Baby crying compilation' }), bl)).toBe(true);
  });

  it('does not block when no keyword matches', () => {
    const bl = { ...empty, keywords: ['barney'] };
    expect(isBlocked(video(), bl)).toBe(false);
  });

  it('handles missing description/channelTitle', () => {
    const bl = { ...empty, keywords: ['elmo'] };
    expect(isBlocked({ id: 'x', title: 'hi', channelId: 'UC9' }, bl)).toBe(false);
  });
});

describe('buildFeed', () => {
  const uploads = [
    {
      channelId: 'UC1',
      videos: [
        video({ id: 'a', publishedAt: '2026-06-01T00:00:00Z' }),
        video({ id: 'b', title: 'Whining kids', publishedAt: '2026-06-03T00:00:00Z' }),
      ],
    },
    { channelId: 'UC2', videos: [video({ id: 'c', channelId: 'UC2', publishedAt: '2026-06-02T00:00:00Z' })] },
  ];

  it('merges channels and sorts newest first', () => {
    const feed = buildFeed(uploads, empty, 'newest');
    expect(feed.map((v) => v.id)).toEqual(['b', 'c', 'a']);
  });

  it('filters blocked videos out of the merged feed', () => {
    const feed = buildFeed(uploads, { ...empty, keywords: ['whining'] }, 'newest');
    expect(feed.map((v) => v.id)).toEqual(['c', 'a']);
  });

  it('shuffle returns the same set in deterministic order with injected random', () => {
    const feed = buildFeed(uploads, empty, 'shuffle', () => 0);
    expect(feed.map((v) => v.id).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('filterFavorites', () => {
  it('normalizes snapshots, applies blocklist, newest favorite first', () => {
    const favorites = [
      { videoId: 'f1', title: 'Elmo sings', channelId: 'UC3', channelTitle: 'Elmo World', addedAt: 1 },
      { videoId: 'f2', title: 'Counting', channelId: 'UC1', channelTitle: 'Ms Rachel', addedAt: 2 },
    ];
    const result = filterFavorites(favorites, { ...empty, keywords: ['elmo'] });
    expect(result.map((v) => v.id)).toEqual(['f2']);
  });
});
