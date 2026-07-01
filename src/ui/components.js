// Shared UI building blocks. Everything renders real DOM nodes (no innerHTML
// with user data — titles from YouTube are untrusted text).

import { verifyPin, lockedForMs } from '../pin.js';
import { isFavorite, toggleFavorite } from '../store.js';

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

export function formatDuration(sec) {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m >= 60
    ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Attach a long-press handler (default 600ms) without triggering iOS's own
 * touch callout. Returns nothing; suppresses the click that follows a hold.
 */
export function onLongPress(node, handler, holdMs = 600) {
  let timer = null;
  let fired = false;
  const start = (e) => {
    fired = false;
    timer = setTimeout(() => {
      fired = true;
      handler(e);
    }, holdMs);
  };
  const cancel = () => clearTimeout(timer);
  node.addEventListener('pointerdown', start);
  node.addEventListener('pointerup', cancel);
  node.addEventListener('pointerleave', cancel);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('contextmenu', (e) => e.preventDefault());
  node.addEventListener(
    'click',
    (e) => {
      if (fired) {
        e.preventDefault();
        e.stopPropagation();
      }
    },
    true
  );
}

/**
 * Big touch-friendly video card used by feed and favorites.
 * @param {object} video normalized {id,title,thumb,channelTitle,durationSec?}
 * @param {{onPlay: (video) => void, onQuickBlock?: (video) => void, onFavChange?: () => void}} handlers
 */
export function videoCard(video, { onPlay, onQuickBlock, onFavChange }) {
  const heart = el('button', {
    class: 'card-heart' + (isFavorite(video.id) ? ' active' : ''),
    'aria-label': 'Favorite',
    onclick: (e) => {
      e.stopPropagation();
      toggleFavorite(video);
      heart.classList.toggle('active');
      onFavChange?.();
    },
    text: '♥',
  });

  const badge = video.durationSec
    ? el('span', { class: 'card-duration', text: formatDuration(video.durationSec) })
    : null;

  const card = el(
    'article',
    { class: 'video-card', 'data-video-id': video.id, tabindex: '0' },
    el(
      'div',
      { class: 'card-thumb-wrap' },
      el('img', { class: 'card-thumb', src: video.thumb, alt: '', loading: 'lazy' }),
      ...(badge ? [badge] : []),
      heart
    ),
    el(
      'div',
      { class: 'card-meta' },
      el('h3', { class: 'card-title', text: video.title }),
      el('p', { class: 'card-channel', text: video.channelTitle || '' })
    )
  );

  card.addEventListener('click', () => onPlay(video));
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') onPlay(video);
  });

  if (onQuickBlock) {
    const dots = el('button', {
      class: 'card-more',
      'aria-label': 'Grown-up options',
      onclick: (e) => {
        e.stopPropagation();
        onQuickBlock(video);
      },
      text: '⋯',
    });
    card.querySelector('.card-thumb-wrap').appendChild(dots);
    onLongPress(card, () => onQuickBlock(video));
  }

  return card;
}

// ---- Overlays ---------------------------------------------------------------

function overlayRoot() {
  return document.getElementById('overlay-root');
}

export function closeOverlays() {
  overlayRoot().innerHTML = '';
}

/**
 * PIN pad overlay. Resolves true when the correct PIN is entered,
 * false when dismissed.
 */
export function requestPin(title = 'Grown-ups only') {
  return new Promise((resolve) => {
    let entered = '';

    const dots = el('div', { class: 'pin-dots' });
    const message = el('p', { class: 'pin-message', text: 'Enter the 4-digit PIN' });

    const renderDots = () => {
      dots.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        dots.appendChild(el('span', { class: 'pin-dot' + (i < entered.length ? ' filled' : '') }));
      }
    };
    renderDots();

    const finish = (result) => {
      closeOverlays();
      resolve(result);
    };

    const pad = el('div', { class: 'pin-grid' });
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    for (const key of keys) {
      if (key === '') {
        pad.appendChild(el('span'));
        continue;
      }
      pad.appendChild(
        el('button', {
          class: 'pin-key',
          text: key,
          onclick: async () => {
            const locked = lockedForMs();
            if (locked > 0) {
              message.textContent = `Locked — try again in ${Math.ceil(locked / 1000)}s`;
              return;
            }
            if (key === '⌫') {
              entered = entered.slice(0, -1);
              renderDots();
              return;
            }
            if (entered.length >= 4) return;
            entered += key;
            renderDots();
            if (entered.length === 4) {
              const result = await verifyPin(entered);
              if (result.ok) return finish(true);
              entered = '';
              renderDots();
              panel.classList.remove('shake');
              void panel.offsetWidth; // restart animation
              panel.classList.add('shake');
              message.textContent = result.lockedForMs
                ? `Too many tries — locked for ${Math.ceil(result.lockedForMs / 1000)}s`
                : 'Oops, wrong PIN';
            }
          },
        })
      );
    }

    const panel = el(
      'div',
      { class: 'overlay-panel pin-panel' },
      el('h2', { text: title }),
      message,
      dots,
      pad,
      el('button', { class: 'btn-plain', text: 'Cancel', onclick: () => finish(false) })
    );

    const backdrop = el('div', { class: 'overlay-backdrop' }, panel);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) finish(false);
    });
    overlayRoot().appendChild(backdrop);
  });
}

/**
 * Bottom action sheet. actions: [{label, danger?, onSelect}]
 */
export function bottomSheet(title, actions) {
  closeOverlays();
  const sheet = el('div', { class: 'sheet' }, el('h3', { class: 'sheet-title', text: title }));
  for (const action of actions) {
    sheet.appendChild(
      el('button', {
        class: 'sheet-action' + (action.danger ? ' danger' : ''),
        text: action.label,
        onclick: () => {
          closeOverlays();
          action.onSelect();
        },
      })
    );
  }
  sheet.appendChild(el('button', { class: 'sheet-action cancel', text: 'Cancel', onclick: closeOverlays }));
  const backdrop = el('div', { class: 'overlay-backdrop sheet-backdrop' }, sheet);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeOverlays();
  });
  overlayRoot().appendChild(backdrop);
}

/** Simple modal text prompt (keyword entry). Resolves the string or null. */
export function textPrompt(title, placeholder) {
  return new Promise((resolve) => {
    const input = el('input', { class: 'text-input', type: 'text', placeholder });
    const finish = (value) => {
      closeOverlays();
      resolve(value);
    };
    const panel = el(
      'div',
      { class: 'overlay-panel' },
      el('h2', { text: title }),
      input,
      el(
        'div',
        { class: 'row gap' },
        el('button', { class: 'btn-plain', text: 'Cancel', onclick: () => finish(null) }),
        el('button', { class: 'btn-primary', text: 'Add', onclick: () => finish(input.value.trim() || null) })
      )
    );
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(input.value.trim() || null);
    });
    const backdrop = el('div', { class: 'overlay-backdrop' }, panel);
    overlayRoot().appendChild(backdrop);
    input.focus();
  });
}

export function emptyState(emoji, message, detail = '') {
  return el(
    'div',
    { class: 'empty-state' },
    el('div', { class: 'empty-emoji', text: emoji }),
    el('h2', { text: message }),
    ...(detail ? [el('p', { text: detail })] : [])
  );
}

export function toast(message) {
  const node = el('div', { class: 'toast', text: message });
  document.body.appendChild(node);
  setTimeout(() => node.classList.add('show'), 10);
  setTimeout(() => {
    node.classList.remove('show');
    setTimeout(() => node.remove(), 300);
  }, 2200);
}
