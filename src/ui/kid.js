// Kid mode: the video feed and favorites grid. Big, bright, minimal text.

import { el, videoCard, emptyState, bottomSheet, requestPin, textPrompt, onLongPress, toast } from './components.js';
import { getSettings, getBlocklist, getFavorites, blockChannel, blockVideo, addKeyword } from '../store.js';
import { buildFeed, filterFavorites } from '../filter.js';
import { getCachedUploads, refreshStaleChannels } from '../youtube.js';
import { navigate, rerender } from '../router.js';
import { openInYouTubeApp } from '../player.js';

function playVideo(video) {
  if (getSettings().playbackMode === 'youtubeApp') {
    openInYouTubeApp(video.id);
  } else {
    navigate(`watch/${video.id}`);
  }
}

async function quickBlock(video) {
  const ok = await requestPin('Grown-ups only');
  if (!ok) return;
  bottomSheet(`“${video.title}”`, [
    {
      label: 'Block this video',
      danger: true,
      onSelect: () => {
        blockVideo(video.id, video.title);
        toast('Video blocked');
        rerender();
      },
    },
    {
      label: `Block channel: ${video.channelTitle}`,
      danger: true,
      onSelect: () => {
        blockChannel(video.channelId, video.channelTitle);
        toast('Channel blocked');
        rerender();
      },
    },
    {
      label: 'Block a word…',
      onSelect: async () => {
        const word = await textPrompt('Block a word', 'e.g. whining');
        if (word) {
          addKeyword(word);
          toast(`Videos with “${word}” hidden`);
          rerender();
        }
      },
    },
  ]);
}

function tabBar(active) {
  const tab = (name, emoji, label) =>
    el(
      'button',
      {
        class: 'tab' + (active === name ? ' active' : ''),
        'aria-label': label,
        onclick: () => navigate(name),
      },
      el('span', { class: 'tab-emoji', text: emoji }),
      el('span', { class: 'tab-label', text: label })
    );
  return el('nav', { class: 'tab-bar' }, tab('feed', '📺', 'Videos'), tab('favorites', '❤️', 'Favorites'));
}

function gearButton() {
  const gear = el('button', { class: 'gear', 'aria-label': 'Parent settings (hold)', text: '⚙️' });
  // 3-second hold so a curious kid can't stumble in; PIN still guards it.
  onLongPress(
    gear,
    async () => {
      const ok = await requestPin();
      if (ok) navigate('parent');
    },
    3000
  );
  gear.addEventListener('click', (e) => e.preventDefault());
  return gear;
}

function grid(videos, onFavChange) {
  const wrap = el('div', { class: 'video-grid' });
  for (const video of videos) {
    wrap.appendChild(videoCard(video, { onPlay: playVideo, onQuickBlock: quickBlock, onFavChange }));
  }
  return wrap;
}

export async function renderFeed(app) {
  const settings = getSettings();
  app.appendChild(gearButton());
  const main = el('main', { class: 'kid-main' });
  app.append(main, tabBar('feed'));

  const draw = async () => {
    const uploads = await getCachedUploads();
    const videos = buildFeed(uploads, getBlocklist(), settings.feedOrder);
    main.innerHTML = '';
    if (!settings.apiKey && uploads.length === 0 && !localStorage.getItem('kidtube:mock')) {
      main.appendChild(emptyState('🧸', 'Almost ready!', 'Ask a grown-up to finish setting things up.'));
    } else if (videos.length === 0) {
      main.appendChild(emptyState('🎈', 'Nothing to watch right now', 'Ask a grown-up to add some shows!'));
    } else {
      main.appendChild(grid(videos, null));
    }
  };

  await draw(); // render whatever is cached immediately…
  refreshStaleChannels().then(({ refreshed }) => {
    // …then repaint if the background refresh brought anything new and
    // the kid is still on the feed.
    const onFeed = location.hash === '' || location.hash.startsWith('#/feed');
    if (refreshed > 0 && onFeed && main.isConnected) draw();
  });
}

export function renderFavorites(app) {
  app.appendChild(gearButton());
  const main = el('main', { class: 'kid-main' });
  app.append(main, tabBar('favorites'));

  const draw = () => {
    const videos = filterFavorites(getFavorites(), getBlocklist());
    main.innerHTML = '';
    if (videos.length === 0) {
      main.appendChild(emptyState('💛', 'No favorites yet', 'Tap the heart on videos you love!'));
    } else {
      // Un-hearting removes the card, so redraw on any favorite change.
      main.appendChild(grid(videos, draw));
    }
  };
  draw();
}
