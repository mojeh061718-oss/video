import { describe, it, expect, beforeEach } from 'vitest';
import {
  getSettings,
  updateSettings,
  getChannels,
  addChannel,
  removeChannel,
  getBlocklist,
  blockChannel,
  addKeyword,
  removeKeyword,
  blockVideo,
  unblockVideo,
  getFavorites,
  toggleFavorite,
  exportBackup,
  importBackup,
} from '../../src/store.js';

beforeEach(() => localStorage.clear());

describe('settings', () => {
  it('returns defaults and persists patches', () => {
    expect(getSettings().playbackMode).toBe('embedded');
    updateSettings({ playbackMode: 'youtubeApp' });
    expect(getSettings().playbackMode).toBe('youtubeApp');
    expect(getSettings().cacheTtlHours).toBe(6);
  });
});

describe('channels & blocklist interplay', () => {
  it('adding a channel is idempotent', () => {
    addChannel({ id: 'UC1', title: 'A' });
    addChannel({ id: 'UC1', title: 'A' });
    expect(getChannels()).toHaveLength(1);
  });

  it('approving a blocked channel unblocks it', () => {
    blockChannel('UC1', 'A');
    expect(getBlocklist().channels).toHaveLength(1);
    addChannel({ id: 'UC1', title: 'A' });
    expect(getBlocklist().channels).toHaveLength(0);
    expect(getChannels()).toHaveLength(1);
  });

  it('blocking a channel keeps it approved so an unblock fully restores it', () => {
    addChannel({ id: 'UC1', title: 'A' });
    blockChannel('UC1', 'A');
    expect(getChannels()).toHaveLength(1);
    expect(getBlocklist().channels).toHaveLength(1);
  });

  it('keywords are stored lowercase and deduped', () => {
    addKeyword('  Elmo ');
    addKeyword('elmo');
    expect(getBlocklist().keywords).toEqual(['elmo']);
    removeKeyword('elmo');
    expect(getBlocklist().keywords).toEqual([]);
  });

  it('blocks and unblocks individual videos', () => {
    blockVideo('v1', 'Some video');
    expect(getBlocklist().videos).toEqual([{ id: 'v1', title: 'Some video' }]);
    unblockVideo('v1');
    expect(getBlocklist().videos).toEqual([]);
  });
});

describe('favorites', () => {
  const video = { id: 'v1', title: 'T', thumb: 'x', channelId: 'UC1', channelTitle: 'A' };

  it('toggles on and off', () => {
    toggleFavorite(video);
    expect(getFavorites()).toHaveLength(1);
    expect(getFavorites()[0].videoId).toBe('v1');
    toggleFavorite(video);
    expect(getFavorites()).toHaveLength(0);
  });
});

describe('backup', () => {
  it('roundtrips settings, channels, blocklist, favorites', () => {
    updateSettings({ apiKey: 'k' });
    addChannel({ id: 'UC1', title: 'A' });
    addKeyword('whining');
    const backup = exportBackup();

    localStorage.clear();
    expect(getChannels()).toHaveLength(0);

    importBackup(backup);
    expect(getSettings().apiKey).toBe('k');
    expect(getChannels()).toHaveLength(1);
    expect(getBlocklist().keywords).toEqual(['whining']);
  });

  it('rejects junk', () => {
    expect(() => importBackup('{"nope":true}')).toThrow();
  });
});
