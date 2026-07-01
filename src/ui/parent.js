// Parent dashboard: Channels / Blocklist / Settings tabs.
// Deliberately plain and dense — the opposite of kid mode.

import { el, toast } from './components.js';
import {
  getSettings,
  updateSettings,
  getChannels,
  addChannel,
  removeChannel,
  getBlocklist,
  unblockChannel,
  addKeyword,
  removeKeyword,
  unblockVideo,
  exportBackup,
  importBackup,
} from '../store.js';
import { setPin } from '../pin.js';
import {
  searchChannels,
  uploadsPlaylistId,
  refreshChannel,
  refreshStaleChannels,
  validateApiKey,
  quotaExhausted,
  dropChannelCache,
  getCachedUploads,
  YtError,
} from '../youtube.js';
import { buildFeed } from '../filter.js';
import { navigate } from '../router.js';

export function renderParent(app, [tab = 'channels']) {
  const header = el(
    'header',
    { class: 'parent-header' },
    el('button', { class: 'btn-plain', text: '← Kid mode', onclick: () => navigate('feed') }),
    el('h1', { text: 'Parent dashboard' })
  );

  const tabs = el(
    'nav',
    { class: 'parent-tabs' },
    ...['channels', 'blocklist', 'settings'].map((name) =>
      el('button', {
        class: 'parent-tab' + (name === tab ? ' active' : ''),
        text: name[0].toUpperCase() + name.slice(1),
        onclick: () => navigate(`parent/${name}`),
      })
    )
  );

  const body = el('main', { class: 'parent-body' });
  app.append(header, banner(), tabs, body);

  if (tab === 'blocklist') renderBlocklistTab(body);
  else if (tab === 'settings') renderSettingsTab(body);
  else renderChannelsTab(body);
}

function banner() {
  if (quotaExhausted()) {
    return el('div', {
      class: 'banner warn',
      text: 'Daily YouTube limit reached — the feed will update again tomorrow. Cached videos still play.',
    });
  }
  if (!getSettings().apiKey && !localStorage.getItem('kidtube:mock')) {
    return el('div', {
      class: 'banner info',
      text: 'No API key yet — add one in Settings to load videos.',
    });
  }
  return el('span');
}

// ---- Channels tab -----------------------------------------------------------

function renderChannelsTab(body) {
  const results = el('div', { class: 'list' });
  const input = el('input', {
    class: 'text-input',
    type: 'search',
    placeholder: 'Search YouTube channels…',
  });

  const doSearch = async () => {
    const query = input.value.trim();
    if (!query) return;
    results.innerHTML = '';
    results.appendChild(el('p', { class: 'muted', text: 'Searching…' }));
    try {
      const found = await searchChannels(query);
      results.innerHTML = '';
      if (!found.length) results.appendChild(el('p', { class: 'muted', text: 'No channels found.' }));
      for (const channel of found) {
        const approved = getChannels().some((c) => c.id === channel.id);
        const btn = el('button', {
          class: 'btn-primary',
          text: approved ? 'Approved ✓' : 'Approve',
          onclick: async () => {
            addChannel({ ...channel, uploadsPlaylistId: uploadsPlaylistId(channel.id) });
            btn.textContent = 'Approved ✓';
            btn.disabled = true;
            toast(`${channel.title} approved`);
            refreshChannel({ ...channel, uploadsPlaylistId: uploadsPlaylistId(channel.id) })
              .then(() => renderApproved())
              .catch(() => {});
            renderApproved();
          },
        });
        if (approved) btn.disabled = true;
        results.appendChild(
          el(
            'div',
            { class: 'list-row' },
            el('img', { class: 'avatar', src: channel.thumb, alt: '' }),
            el(
              'div',
              { class: 'grow' },
              el('strong', { text: channel.title }),
              el('p', { class: 'muted small', text: channel.description || '' })
            ),
            btn
          )
        );
      }
    } catch (err) {
      results.innerHTML = '';
      results.appendChild(el('p', { class: 'error', text: friendlyError(err) }));
    }
  };

  // Search costs 100 quota units — submit only, never per keystroke.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  const approvedList = el('div', { class: 'list' });
  const renderApproved = async () => {
    const channels = getChannels();
    const uploads = await getCachedUploads();
    const fetchedAtById = new Map(uploads.map((u) => [u.channelId, u.fetchedAt]));
    approvedList.innerHTML = '';
    if (!channels.length) {
      approvedList.appendChild(el('p', { class: 'muted', text: 'No approved channels yet. Search above to add some.' }));
    }
    for (const channel of channels) {
      const fetchedAt = fetchedAtById.get(channel.id);
      approvedList.appendChild(
        el(
          'div',
          { class: 'list-row' },
          el('img', { class: 'avatar', src: channel.thumb || '', alt: '' }),
          el(
            'div',
            { class: 'grow' },
            el('strong', { text: channel.title }),
            el('p', {
              class: 'muted small',
              text: fetchedAt ? `Updated ${new Date(fetchedAt).toLocaleString()}` : 'Not loaded yet',
            })
          ),
          el('button', {
            class: 'btn-danger',
            text: 'Remove',
            onclick: async () => {
              removeChannel(channel.id);
              await dropChannelCache(channel.id);
              toast(`${channel.title} removed`);
              renderApproved();
            },
          })
        )
      );
    }
  };

  const refreshAll = el('button', {
    class: 'btn-plain',
    text: 'Refresh all now',
    onclick: async () => {
      refreshAll.disabled = true;
      refreshAll.textContent = 'Refreshing…';
      const { refreshed, failed } = await refreshStaleChannels({ force: true });
      refreshAll.disabled = false;
      refreshAll.textContent = 'Refresh all now';
      toast(failed ? `Refreshed ${refreshed}, ${failed} failed` : `Refreshed ${refreshed} channels`);
      renderApproved();
    },
  });

  body.append(
    el('section', {}, el('h2', { text: 'Add channels' }),
      el('div', { class: 'row gap' }, input, el('button', { class: 'btn-primary', text: 'Search', onclick: doSearch })),
      el('p', { class: 'muted small', text: 'Her feed only ever shows videos from channels you approve.' }),
      results),
    el('section', {}, el('div', { class: 'row spread' }, el('h2', { text: 'Approved channels' }), refreshAll), approvedList)
  );
  renderApproved();
}

// ---- Blocklist tab ----------------------------------------------------------

function renderBlocklistTab(body) {
  const section = el('div');

  const draw = async () => {
    const blocklist = getBlocklist();
    section.innerHTML = '';

    // Diagnosability: show how much the blocklist is hiding right now.
    const uploads = await getCachedUploads();
    const total = uploads.reduce((n, u) => n + u.videos.length, 0);
    const visible = buildFeed(uploads, blocklist, 'newest').length;
    section.appendChild(
      el('p', { class: 'muted', text: `${total} videos from approved channels, ${total - visible} hidden by your blocklist.` })
    );

    // Keywords
    const chipRow = el('div', { class: 'chips' });
    for (const keyword of blocklist.keywords) {
      chipRow.appendChild(
        el('span', { class: 'chip' }, el('span', { text: keyword }),
          el('button', { class: 'chip-x', 'aria-label': `Remove ${keyword}`, text: '×', onclick: () => { removeKeyword(keyword); draw(); } }))
      );
    }
    const wordInput = el('input', { class: 'text-input', type: 'text', placeholder: 'e.g. whining, crying, Barney…' });
    const addWord = () => {
      if (wordInput.value.trim()) {
        addKeyword(wordInput.value);
        wordInput.value = '';
        draw();
      }
    };
    wordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addWord();
    });

    section.appendChild(
      el('section', {}, el('h2', { text: 'Blocked words' }),
        el('p', { class: 'muted small', text: 'Any video whose title, description, or channel name contains one of these words is hidden — including favorites.' }),
        el('div', { class: 'row gap' }, wordInput, el('button', { class: 'btn-primary', text: 'Add', onclick: addWord })),
        chipRow)
    );

    // Blocked channels
    const channelList = el('div', { class: 'list' });
    if (!blocklist.channels.length) channelList.appendChild(el('p', { class: 'muted', text: 'No blocked channels.' }));
    for (const channel of blocklist.channels) {
      channelList.appendChild(
        el('div', { class: 'list-row' },
          el('div', { class: 'grow' }, el('strong', { text: channel.title || channel.id })),
          el('button', { class: 'btn-plain', text: 'Unblock', onclick: () => { unblockChannel(channel.id); draw(); } }))
      );
    }
    section.appendChild(el('section', {}, el('h2', { text: 'Blocked channels' }), channelList));

    // Blocked videos
    const videoList = el('div', { class: 'list' });
    if (!blocklist.videos.length) videoList.appendChild(el('p', { class: 'muted', text: 'No individually blocked videos.' }));
    for (const video of blocklist.videos) {
      videoList.appendChild(
        el('div', { class: 'list-row' },
          el('div', { class: 'grow' }, el('strong', { text: video.title || video.id })),
          el('button', { class: 'btn-plain', text: 'Unblock', onclick: () => { unblockVideo(video.id); draw(); } }))
      );
    }
    section.appendChild(el('section', {}, el('h2', { text: 'Blocked videos' }), videoList));
  };

  body.appendChild(section);
  draw();
}

// ---- Settings tab -------------------------------------------------------------

function renderSettingsTab(body) {
  const settings = getSettings();

  // API key
  const keyInput = el('input', {
    class: 'text-input',
    type: 'text',
    placeholder: 'Paste your YouTube API key',
    value: settings.apiKey,
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
  });
  const keyStatus = el('p', { class: 'muted small' });
  const saveKey = el('button', {
    class: 'btn-primary',
    text: 'Validate & save',
    onclick: async () => {
      const key = keyInput.value.trim();
      keyStatus.className = 'muted small';
      keyStatus.textContent = 'Checking…';
      try {
        await validateApiKey(key);
        updateSettings({ apiKey: key, quotaExhaustedUntil: 0 });
        keyStatus.textContent = 'Key is valid and saved ✓';
        refreshStaleChannels({ force: true });
      } catch (err) {
        keyStatus.className = 'error small';
        keyStatus.textContent = friendlyError(err);
      }
    },
  });

  const keyHelp = el(
    'details',
    { class: 'help' },
    el('summary', { text: 'How do I get a free API key?' }),
    helpList([
      'Go to console.cloud.google.com and sign in with any Google account.',
      'Create a project (name it anything, e.g. “KidTube”).',
      'In “APIs & Services → Library”, search for “YouTube Data API v3” and click Enable.',
      'In “APIs & Services → Credentials”, click “Create credentials → API key” and copy it here.',
      'Recommended: edit the key, and under “Website restrictions” add the web address where this app lives.',
      'The free quota is generous — this app uses roughly a tenth of it even on heavy days.',
    ])
  );

  // Playback mode
  const modeSelect = el('select', { class: 'text-input' },
    el('option', { value: 'embedded', text: 'Locked-In — plays inside this app (may show limited kids ads)' }),
    el('option', { value: 'youtubeApp', text: 'Ad-Free — opens videos in the YouTube app (needs her Premium profile)' })
  );
  modeSelect.value = settings.playbackMode;
  modeSelect.addEventListener('change', () => {
    updateSettings({ playbackMode: modeSelect.value });
    toast('Playback mode saved');
  });

  const modeHelp = el(
    'details',
    { class: 'help' },
    el('summary', { text: 'How does Ad-Free mode work with my Premium?' }),
    helpList([
      'Add your daughter to your YouTube Premium family plan (families.google.com → add family member; create her child account with Family Link if she doesn’t have one).',
      'Install the YouTube app on her iPad and sign it in as HER profile — never yours.',
      'In her YouTube settings, turn autoplay off and set her supervised content level.',
      'Now when she taps a video here, it opens in the YouTube app and plays completely ad-free on her Premium profile.',
      'Her watching goes to HER history — your recommendations are never affected.',
      'Trade-off: during playback she is in the real YouTube app, so she can tap around there. Locked-In mode keeps her inside this app instead.',
    ])
  );

  // Feed order
  const orderSelect = el('select', { class: 'text-input' },
    el('option', { value: 'newest', text: 'Newest first' }),
    el('option', { value: 'shuffle', text: 'Shuffled' })
  );
  orderSelect.value = settings.feedOrder;
  orderSelect.addEventListener('change', () => {
    updateSettings({ feedOrder: orderSelect.value });
    toast('Feed order saved');
  });

  // PIN change
  const pinInput = el('input', { class: 'text-input', type: 'password', inputmode: 'numeric', maxlength: '4', placeholder: 'New 4-digit PIN' });
  const savePin = el('button', {
    class: 'btn-plain',
    text: 'Change PIN',
    onclick: async () => {
      const pin = pinInput.value.trim();
      if (!/^\d{4}$/.test(pin)) return toast('PIN must be exactly 4 digits');
      await setPin(pin);
      pinInput.value = '';
      toast('PIN changed');
    },
  });

  // Backup
  const backupButtons = el('div', { class: 'row gap' },
    el('button', {
      class: 'btn-plain',
      text: 'Copy backup',
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(exportBackup());
          toast('Backup copied — paste it somewhere safe');
        } catch {
          toast('Could not copy — try again');
        }
      },
    }),
    el('button', {
      class: 'btn-plain',
      text: 'Restore backup',
      onclick: async () => {
        try {
          const text = prompt('Paste your backup here:');
          if (!text) return;
          importBackup(text);
          toast('Backup restored');
          navigate('parent/settings');
        } catch {
          toast('That doesn’t look like a KidTube backup');
        }
      },
    })
  );

  const installHelp = el(
    'details',
    { class: 'help' },
    el('summary', { text: 'How do I install this on the iPad?' }),
    helpList([
      'Open this app in Safari on the iPad.',
      'Tap the Share button (square with an arrow).',
      'Tap “Add to Home Screen”, then “Add”.',
      'It now opens fullscreen like a real app — hand it over!',
    ])
  );

  body.append(
    el('section', {}, el('h2', { text: 'YouTube API key' }),
      el('div', { class: 'row gap' }, keyInput, saveKey), keyStatus, keyHelp),
    el('section', {}, el('h2', { text: 'Playback' }), modeSelect, modeHelp),
    el('section', {}, el('h2', { text: 'Feed order' }), orderSelect),
    el('section', {}, el('h2', { text: 'Parent PIN' }), el('div', { class: 'row gap' }, pinInput, savePin)),
    el('section', {}, el('h2', { text: 'Backup' }),
      el('p', { class: 'muted small', text: 'Copies your channels, blocklists, favorites, and settings as text. Paste it back to restore on a new device.' }),
      backupButtons),
    el('section', {}, el('h2', { text: 'Install on iPad' }), installHelp)
  );
}

function helpList(steps) {
  return el('ol', { class: 'help-steps' }, ...steps.map((step) => el('li', { text: step })));
}

function friendlyError(err) {
  if (err instanceof YtError) {
    if (err.kind === 'noKey') return 'Add your API key in Settings first.';
    if (err.kind === 'quota') return 'Daily YouTube limit reached — try again tomorrow.';
    if (err.kind === 'badKey') return `YouTube rejected the key: ${err.message}`;
    if (err.kind === 'network') return 'No internet connection.';
  }
  return `Something went wrong: ${err.message}`;
}
