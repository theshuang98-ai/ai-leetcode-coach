// AI LeetCode 私教 — Content Script
// Runs on *://leetcode.com/problems/* and *://leetcode.cn/problems/*
// Detects submission results and injects a rating popup on "Accepted"
(function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  var prevResultText = '';       // Last detected result text (for dedup)
  var ratingPopupActive = false; // True while popup is visible
  var observer = null;           // MutationObserver instance

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Extract problem slug from URL path, e.g. "/problems/two-sum/" → "two-sum" */
  function getProblemSlug() {
    var match = window.location.pathname.match(/^\/problems\/([^/]+)/);
    return match ? match[1] : null;
  }

  /** Check if current site is LeetCode.cn */
  function isCnSite() {
    return window.location.hostname.indexOf('leetcode.cn') !== -1;
  }

  // ---------------------------------------------------------------------------
  // Submission Detection
  // ---------------------------------------------------------------------------

  /**
   * Scan the DOM for a submission result element.
   * Returns { text: string|null, el: Element|null }
   */
  function findResultInDOM() {
    var text = '';
    var el = null;

    if (isCnSite()) {
      // --- LeetCode.cn selectors ---
      // Recent LC.cn uses inline result text with specific styling
      var cnSelectors = [
        '[class*="result"]',
        '.text-green-600',
        '.text-red-600',
        '.text-orange-600',
        '.text-green-500',
        '.text-red-500',
        '[data-e2e-locator="submission-result"]',
        // Broad fallback: any element containing key text near a result area
        'span:not(:empty)',
        'div:not(:empty)'
      ];
      for (var ci = 0; ci < cnSelectors.length; ci++) {
        var nodes = document.querySelectorAll(cnSelectors[ci]);
        for (var cj = 0; cj < nodes.length; cj++) {
          var t = nodes[cj].textContent.trim();
          if (
            t.indexOf('通过') !== -1 ||
            t.indexOf('解答') !== -1 ||
            t.indexOf('未通过') !== -1 ||
            t.indexOf('超出时间') !== -1 ||
            t.indexOf('运行错误') !== -1 ||
            t.indexOf('编译错误') !== -1
          ) {
            el = nodes[cj];
            text = t;
            break;
          }
        }
        if (el) break;
      }
    } else {
      // --- LeetCode.com selectors ---
      // Primary: data-e2e-locator attribute
      var e2eResult = document.querySelector('[data-e2e-locator="submission-result"]');
      if (e2eResult) {
        el = e2eResult;
        text = e2eResult.textContent.trim();
      } else {
        // Fallback: scan common containers
        var comSelectors = [
          '[class*="result"]',
          '[class*="Result"]',
          'span:not(:empty)',
          'div:not(:empty)'
        ];
        for (var si = 0; si < comSelectors.length; si++) {
          var items = document.querySelectorAll(comSelectors[si]);
          for (var sj = 0; sj < items.length; sj++) {
            var st = items[sj].textContent.trim();
            if (
              st.indexOf('Accepted') !== -1 ||
              st.indexOf('Wrong Answer') !== -1 ||
              st.indexOf('Time Limit') !== -1 ||
              st.indexOf('Runtime Error') !== -1 ||
              st.indexOf('Compile Error') !== -1 ||
              st.indexOf('Memory Limit') !== -1 ||
              st.indexOf('Output Limit') !== -1
            ) {
              el = items[sj];
              text = st;
              break;
            }
          }
          if (el) break;
        }
      }
    }

    return { text: text, el: el };
  }

  /** Check if result text means "Accepted" */
  function isAccepted(text) {
    if (isCnSite()) {
      // Chinese: "通过" = Accepted (but not "未通过" = Failed)
      return text.indexOf('通过') !== -1 && text.indexOf('未通过') === -1;
    }
    // English: must start with "Accepted" (not just contain the word)
    return /^Accepted/.test(text);
  }

  /** Check if result text is an intermediate state (running / pending) */
  function isIntermediate(text) {
    var lower = text.toLowerCase();
    return (
      lower.indexOf('running') !== -1 ||
      lower.indexOf('submitting') !== -1 ||
      lower.indexOf('pending') !== -1 ||
      lower.indexOf(' judging') !== -1 ||
      lower.indexOf('judging') !== -1
    );
  }

  /**
   * Called on every DOM mutation tick (debounced).
   * Detects new submission results and triggers the rating popup on Accepted.
   */
  function checkSubmissionResult() {
    var slug = getProblemSlug();
    if (!slug) return;
    if (!document.body) return;

    var result = findResultInDOM();
    if (!result.el || !result.text) return;

    var resultText = result.text;

    // Ignore intermediate states (running, submitting, pending)
    if (isIntermediate(resultText)) {
      prevResultText = resultText;
      return;
    }

    // Ignore if text hasn't changed since last detection
    if (resultText === prevResultText) return;

    var accepted = isAccepted(resultText);

    if (accepted && !ratingPopupActive) {
      // Mark as shown so we don't re-trigger
      prevResultText = resultText;
      ratingPopupActive = true;

      // Small delay to let the DOM settle, then show popup
      setTimeout(function() {
        showRatingPopupForSubmission(slug);
      }, 800);
    } else {
      // Non-Accepted result or popup active — still update prev text
      prevResultText = resultText;
    }
  }

  // ---------------------------------------------------------------------------
  // Rating Popup
  // ---------------------------------------------------------------------------

  /**
   * Show the rating popup (defined in rating-popup.js) and handle the response.
   */
  function showRatingPopupForSubmission(slug) {
    if (typeof window.showRatingPopup !== 'function') {
      console.warn('[AI LeetCode] rating-popup.js not loaded — cannot show popup');
      ratingPopupActive = false;
      return;
    }

    window.showRatingPopup(slug, function(mastery) {
      // Send feedback to background service worker
      chrome.runtime.sendMessage(
        {
          type: 'SUBMIT_FEEDBACK',
          slug: slug,
          mastery: mastery
        },
        function(response) {
          if (chrome.runtime.lastError) {
            console.warn(
              '[AI LeetCode] Failed to send feedback:',
              chrome.runtime.lastError.message
            );
            return;
          }
          if (response && response.success) {
            console.log('[AI LeetCode] Feedback submitted successfully');
          } else {
            console.warn(
              '[AI LeetCode] Feedback submission failed:',
              response ? response.error : 'Unknown error'
            );
          }
        }
      );

      // Refresh the task sidebar to reflect completed status
      if (typeof window.refreshTaskSidebar === 'function') {
        window.refreshTaskSidebar();
      }

      // Allow new popup after cooldown
      setTimeout(function() {
        ratingPopupActive = false;
        // Reset prev text so next submission can trigger
        prevResultText = '';
      }, 3000);
    });
  }

  // ---------------------------------------------------------------------------
  // MutationObserver Setup
  // ---------------------------------------------------------------------------

  function startWatching() {
    // Initial check (in case the result already exists)
    checkSubmissionResult();

    // Debounce state
    var debounceTimer = null;

    observer = new MutationObserver(function() {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(function() {
        checkSubmissionResult();
      }, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  // ---------------------------------------------------------------------------
  // LeetCode CN Data Sync
  // ---------------------------------------------------------------------------

  /**
   * Fetch the user's AC problem list from LeetCode CN API and sync to backend.
   * Called from the popup via chrome.runtime.sendMessage with type 'TRIGGER_SYNC'.
   */
  function syncLeetCodeData() {
    return new Promise(function(resolve, reject) {
      console.log('[AI LeetCode] Fetching AC problems from LeetCode CN...');

      fetch('https://leetcode.cn/api/problems/all/', {
        credentials: 'include'
      })
        .then(function(response) {
          if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
          }
          return response.json();
        })
        .then(function(data) {
          // Filter for AC (Accepted) problems and extract question_id (= our leetcodeId)
          var pairs = data.stat_status_pairs || [];
          var acIds = [];
          for (var i = 0; i < pairs.length; i++) {
            if (pairs[i].status === 'ac') {
              acIds.push(pairs[i].stat.question_id);
            }
          }

          console.log('[AI LeetCode] Found ' + acIds.length + ' AC problems on LeetCode CN');
          resolve(acIds);
        })
        .catch(function(err) {
          console.error('[AI LeetCode] Failed to fetch problems from LeetCode CN:', err.message);
          reject(err);
        });
    }).then(function(acIds) {
      if (acIds.length === 0) {
        return { syncedCount: 0, skippedCount: 0, totalMatched: 0, message: 'No AC problems found on LeetCode CN' };
      }

      // Send to background worker which will forward to backend
      return new Promise(function(resolve, reject) {
        chrome.runtime.sendMessage(
          {
            type: 'SYNC_LEETCODE_DATA',
            payload: { leetcodeProblemIds: acIds }
          },
          function(response) {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
              return;
            }
            resolve(response);
          }
        );
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Message Listener (from popup)
  // ---------------------------------------------------------------------------

  chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    if (message.type === 'TRIGGER_SYNC') {
      syncLeetCodeData()
        .then(function(result) {
          sendResponse({ success: true, data: result.data || result });
        })
        .catch(function(err) {
          sendResponse({ success: false, error: err.message });
        });
      return true; // Keep channel open for async response
    }
  });

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function init() {
    var slug = getProblemSlug();
    if (!slug) {
      console.log('[AI LeetCode] Not a problem page, skipping');
      return;
    }

    console.log('[AI LeetCode] Content script loaded for problem:', slug);

    // Initialize task sidebar (if task-sidebar.js is loaded)
    if (typeof window.initTaskSidebar === 'function') {
      window.initTaskSidebar();
    }

    // Wait a moment for the page to fully render, then start observing
    setTimeout(startWatching, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
