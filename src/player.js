// YouTube IFrame Player API wrapper (embedded / "Locked-In" mode).
// Uses youtube-nocookie.com so playback never links to any signed-in account.

let apiPromise = null;

function loadIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

/**
 * Create a player inside `el`.
 * @param {HTMLElement} el
 * @param {string} videoId
 * @param {{onError?: (code: number) => void, onEnded?: () => void}} handlers
 * @returns {Promise<{destroy: () => void}>}
 */
export async function createPlayer(el, videoId, { onError, onEnded } = {}) {
  const YT = await loadIframeApi();
  const player = new YT.Player(el, {
    videoId,
    host: 'https://www.youtube-nocookie.com',
    playerVars: {
      playsinline: 1, // mandatory for inline playback on iOS
      rel: 0, // end-screen suggestions limited to the same channel
      modestbranding: 1,
      autoplay: 1,
    },
    events: {
      onError: (e) => onError?.(e.data),
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.ENDED) onEnded?.();
      },
    },
  });
  return { destroy: () => player.destroy?.() };
}

/**
 * "Ad-Free" mode: hand the video to the native YouTube app, which plays it
 * ad-free on the child's Premium family profile. Tries the app URL scheme
 * first (reliable from a home-screen PWA), falls back to the universal link.
 */
export function openInYouTubeApp(videoId) {
  const fallback = setTimeout(() => {
    window.location.href = `https://www.youtube.com/watch?v=${videoId}`;
  }, 1500);
  // If the app opens, the page is backgrounded and the timer never fires
  // before the user returns; clear it on visibility change to be safe.
  const onHide = () => {
    clearTimeout(fallback);
    document.removeEventListener('visibilitychange', onHide);
  };
  document.addEventListener('visibilitychange', onHide);
  window.location.href = `youtube://watch?v=${videoId}`;
}
