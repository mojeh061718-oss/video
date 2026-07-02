// First-run wizard: welcome → PIN → API key → first channels → done.

import { el, toast } from './components.js';
import { updateSettings, addChannel, getChannels } from '../store.js';
import { setPin } from '../pin.js';
import { validateApiKey, searchChannels, uploadsPlaylistId, refreshChannel } from '../youtube.js';
import { navigate } from '../router.js';

export function renderOnboarding(app) {
  const stage = el('main', { class: 'onboarding' });
  app.appendChild(stage);
  showWelcome(stage);
}

function screen(stage, ...children) {
  stage.innerHTML = '';
  stage.append(el('div', { class: 'onboarding-card' }, ...children));
}

function showWelcome(stage) {
  screen(
    stage,
    el('div', { class: 'empty-emoji', text: '📺' }),
    el('h1', { text: 'Welcome to KidTube' }),
    el('p', { text: 'A safe video app for your little one. You choose the channels, block anything you don’t like, and she gets a big friendly feed all her own.' }),
    el('p', { class: 'muted', text: 'Setup takes about five minutes.' }),
    el('button', { class: 'btn-primary big', text: 'Get started', onclick: () => showPin(stage) })
  );
}

function showPin(stage) {
  const first = el('input', { class: 'text-input big-input', type: 'password', inputmode: 'numeric', maxlength: '4', placeholder: 'Choose a 4-digit PIN' });
  const second = el('input', { class: 'text-input big-input', type: 'password', inputmode: 'numeric', maxlength: '4', placeholder: 'Type it again' });
  const error = el('p', { class: 'error small' });
  screen(
    stage,
    el('h1', { text: 'Create your parent PIN' }),
    el('p', { class: 'muted', text: 'This locks the grown-up area: channel choices, blocklists, and settings.' }),
    first,
    second,
    error,
    el('button', {
      class: 'btn-primary big',
      text: 'Set PIN',
      onclick: async () => {
        if (!/^\d{4}$/.test(first.value)) {
          error.textContent = 'The PIN must be exactly 4 digits.';
          return;
        }
        if (first.value !== second.value) {
          error.textContent = 'Those don’t match — try again.';
          return;
        }
        await setPin(first.value);
        showApiKey(stage);
      },
    })
  );
  first.focus();
}

function showApiKey(stage) {
  const input = el('input', {
    class: 'text-input big-input',
    type: 'text',
    placeholder: 'Paste your API key here',
    autocapitalize: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
  });
  const status = el('p', { class: 'muted small' });
  screen(
    stage,
    el('h1', { text: 'Connect to YouTube' }),
    el('p', { class: 'muted', text: 'The app needs a free YouTube API key to load videos. Why? The YouTube app fills your feed using your account — this app deliberately never uses your account, so Google asks it to bring its own “library card” instead.' }),
    el('p', { class: 'muted', text: 'The key is free (no card, no cost), has nothing to do with your Premium membership, and nothing here ever touches your own feed or history.' }),
    el(
      'details',
      { class: 'help' },
      el('summary', { text: 'Show me how (2 minutes)' }),
      el('ol', { class: 'help-steps' },
        el('li', { text: 'On a computer or this iPad, go to console.cloud.google.com and sign in.' }),
        el('li', { text: 'Create a project — call it “KidTube”.' }),
        el('li', { text: 'Menu → “APIs & Services” → “Library” → search “YouTube Data API v3” → Enable.' }),
        el('li', { text: '“APIs & Services” → “Credentials” → “Create credentials” → “API key”.' }),
        el('li', { text: 'Copy the key and paste it below.' }))
    ),
    input,
    status,
    el('button', {
      class: 'btn-primary big',
      text: 'Validate & continue',
      onclick: async () => {
        status.className = 'muted small';
        status.textContent = 'Checking…';
        try {
          await validateApiKey(input.value.trim());
          updateSettings({ apiKey: input.value.trim() });
          showChannels(stage);
        } catch {
          status.className = 'error small';
          status.textContent = 'YouTube didn’t accept that key — double-check and try again.';
        }
      },
    }),
    el('button', { class: 'btn-plain', text: 'Skip for now', onclick: () => showDone(stage) })
  );
}

function showChannels(stage) {
  const input = el('input', { class: 'text-input big-input', type: 'search', placeholder: 'Try “Ms Rachel” or “Sesame Street”…' });
  const results = el('div', { class: 'list' });
  const count = el('p', { class: 'muted small', text: '' });

  const updateCount = () => {
    const n = getChannels().length;
    count.textContent = n ? `${n} channel${n > 1 ? 's' : ''} approved` : '';
  };

  const doSearch = async () => {
    if (!input.value.trim()) return;
    results.innerHTML = '';
    results.appendChild(el('p', { class: 'muted', text: 'Searching…' }));
    try {
      const found = await searchChannels(input.value.trim());
      results.innerHTML = '';
      for (const channel of found) {
        const btn = el('button', {
          class: 'btn-primary',
          text: 'Approve',
          onclick: () => {
            const full = { ...channel, uploadsPlaylistId: uploadsPlaylistId(channel.id) };
            addChannel(full);
            refreshChannel(full).catch(() => {});
            btn.textContent = 'Approved ✓';
            btn.disabled = true;
            updateCount();
          },
        });
        results.appendChild(
          el('div', { class: 'list-row' },
            el('img', { class: 'avatar', src: channel.thumb, alt: '' }),
            el('div', { class: 'grow' }, el('strong', { text: channel.title })),
            btn)
        );
      }
    } catch (err) {
      results.innerHTML = '';
      results.appendChild(el('p', { class: 'error', text: 'Search failed — you can add channels later from the parent dashboard.' }));
    }
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
  });

  screen(
    stage,
    el('h1', { text: 'Pick her first channels' }),
    el('p', { class: 'muted', text: 'Her feed will only ever show videos from channels you approve. You can add or remove them anytime.' }),
    el('div', { class: 'row gap' }, input, el('button', { class: 'btn-primary', text: 'Search', onclick: doSearch })),
    results,
    count,
    el('button', { class: 'btn-primary big', text: 'Finish setup', onclick: () => showDone(stage) })
  );
}

function showDone(stage) {
  updateSettings({ onboarded: true });
  screen(
    stage,
    el('div', { class: 'empty-emoji', text: '🎉' }),
    el('h1', { text: 'All set!' }),
    el('p', { class: 'muted', text: 'To open the grown-up area later: press and hold the little gear in the corner for 3 seconds, then enter your PIN.' }),
    el('p', { class: 'muted', text: 'Tip: install the app first — in Safari tap Share → “Add to Home Screen” — then hand it over.' }),
    el('button', { class: 'btn-primary big', text: 'Go to her feed', onclick: () => navigate('feed') })
  );
}
