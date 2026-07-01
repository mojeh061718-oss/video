// Fullscreen watch screen (embedded / Locked-In mode only).

import { el, emptyState, requestPin, bottomSheet, textPrompt, toast } from './components.js';
import { createPlayer } from '../player.js';
import {
  getBlocklist,
  getFavorites,
  isFavorite,
  toggleFavorite,
  blockVideo,
  blockChannel,
  addKeyword,
} from '../store.js';
import { isBlocked } from '../filter.js';
import { getCachedUploads } from '../youtube.js';
import { navigate } from '../router.js';

async function findVideo(videoId) {
  const uploads = await getCachedUploads();
  for (const record of uploads) {
    const video = record.videos.find((v) => v.id === videoId);
    if (video) return video;
  }
  const fav = getFavorites().find((f) => f.videoId === videoId);
  if (fav) {
    return { id: fav.videoId, title: fav.title, thumb: fav.thumb, channelId: fav.channelId, channelTitle: fav.channelTitle };
  }
  return null;
}

export async function renderWatch(app, [videoId]) {
  const video = await findVideo(videoId);

  // Renders can race with blocking — never play a blocked/unknown video.
  if (!video || isBlocked(video, getBlocklist())) {
    app.appendChild(emptyState('🙈', 'That video ran away!', ''));
    app.appendChild(backButton());
    return;
  }

  const playerHost = el('div', { class: 'player-host' });
  const stage = el('div', { class: 'player-stage' }, playerHost);

  const heart = el('button', {
    class: 'watch-heart' + (isFavorite(video.id) ? ' active' : ''),
    'aria-label': 'Favorite',
    text: '♥',
    onclick: () => {
      toggleFavorite(video);
      heart.classList.toggle('active');
    },
  });

  const more = el('button', {
    class: 'watch-more',
    'aria-label': 'Grown-up options',
    text: '⋯',
    onclick: async () => {
      const ok = await requestPin();
      if (!ok) return;
      bottomSheet(`“${video.title}”`, [
        {
          label: 'Block this video',
          danger: true,
          onSelect: () => {
            blockVideo(video.id, video.title);
            toast('Video blocked');
            navigate('feed');
          },
        },
        {
          label: `Block channel: ${video.channelTitle}`,
          danger: true,
          onSelect: () => {
            blockChannel(video.channelId, video.channelTitle);
            toast('Channel blocked');
            navigate('feed');
          },
        },
        {
          label: 'Block a word…',
          onSelect: async () => {
            const word = await textPrompt('Block a word', 'e.g. whining');
            if (word) {
              addKeyword(word);
              toast(`Videos with “${word}” hidden`);
            }
          },
        },
      ]);
    },
  });

  const screen = el(
    'div',
    { class: 'watch-screen' },
    el('header', { class: 'watch-bar' }, backButton(), el('h1', { class: 'watch-title', text: video.title }), heart, more),
    stage
  );
  app.appendChild(screen);

  let player = null;
  try {
    player = await createPlayer(playerHost, video.id, {
      onError: () => {
        // Deleted / private / embed-disabled (codes 100/101/150): the video is
        // unplayable anyway, so silently block it and show a friendly message.
        blockVideo(video.id, video.title);
        stage.innerHTML = '';
        stage.appendChild(emptyState('🙈', 'That video ran away!', 'Pick another one!'));
      },
      onEnded: () => navigate('feed'),
    });
  } catch {
    stage.innerHTML = '';
    stage.appendChild(emptyState('📡', 'No internet right now', 'Videos need the internet to play.'));
  }

  // Clean up the iframe when the route changes.
  const cleanup = () => {
    player?.destroy();
    window.removeEventListener('hashchange', cleanup);
  };
  window.addEventListener('hashchange', cleanup);
}

function backButton() {
  return el('button', {
    class: 'watch-back',
    'aria-label': 'Back',
    text: '←',
    onclick: () => navigate('feed'),
  });
}
