// AI LeetCode 私教 — Rating Popup (Shadow DOM)
// Exposes window.showRatingPopup() for use by content.js
(function() {
  'use strict';

  const CSS_URL = chrome.runtime.getURL('content/styles.css');

  /**
   * Show rating popup in Shadow DOM at bottom-right of viewport.
   * @param {string} slug - Problem slug from URL
   * @param {function} onRate - Callback(mastery) where mastery is 1|2|3
   */
  window.showRatingPopup = async function(slug, onRate) {
    // Remove any existing popup host
    const existing = document.getElementById('aitoearn-rating-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'aitoearn-rating-host';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // Load CSS file via runtime URL
    let cssText = '';
    try {
      const res = await fetch(CSS_URL);
      cssText = await res.text();
    } catch (e) {
      console.warn('[AI LeetCode] Failed to load styles.css:', e);
    }

    // Build shadow DOM with card + buttons
    shadow.innerHTML =
      '<style>' + cssText + '</style>' +
      '<div class="rating-container" id="rating-container">' +
        '<div class="rating-card">' +
          '<div class="rating-title">🎯 这道题掌握得怎么样？</div>' +
          '<div class="rating-buttons">' +
            '<button class="rating-btn mastery-1" data-mastery="1">' +
              '<span class="emoji">🟢</span>' +
              '<span class="label">熟练</span>' +
            '</button>' +
            '<button class="rating-btn mastery-2" data-mastery="2">' +
              '<span class="emoji">🟡</span>' +
              '<span class="label">需提示</span>' +
            '</button>' +
            '<button class="rating-btn mastery-3" data-mastery="3">' +
              '<span class="emoji">🔴</span>' +
              '<span class="label">忘了</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    const container = shadow.getElementById('rating-container');

    // Attach click handlers to each button
    shadow.querySelectorAll('.rating-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var mastery = parseInt(btn.getAttribute('data-mastery'), 10);

        // Play dismiss animation
        if (container) {
          container.classList.add('dismiss');
        }

        // Wait for animation then remove from DOM
        setTimeout(function() {
          host.remove();
        }, 300);

        // Fire callback
        if (typeof onRate === 'function') {
          onRate(mastery);
        }
      });
    });
  };
})();
