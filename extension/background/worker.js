// AI LeetCode 私教 — Background Service Worker
const API_BASE = 'http://localhost:3000';

chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.sync.get(['apiKey'], function(result) {
    if (!result.apiKey) {
      console.log('[AI LeetCode Coach] Waiting for API Key setup');
    }
  });
});

// ---------------------------------------------------------------------------
// API Helpers
// ---------------------------------------------------------------------------

/** Generic fetch wrapper with API key injection */
async function callApi(endpoint, options) {
  return new Promise(function(resolve) {
    chrome.storage.sync.get(['apiKey'], async function(result) {
      if (!result.apiKey) {
        resolve({ error: 'No API Key configured' });
        return;
      }
      try {
        var fetchOpts = options || {};
        fetchOpts.headers = fetchOpts.headers || {};
        fetchOpts.headers['Authorization'] = 'Bearer ' + result.apiKey;
        var response = await fetch(API_BASE + endpoint, fetchOpts);
        var data;
        var contentType = response.headers.get('content-type') || '';
        if (contentType.indexOf('application/json') !== -1) {
          data = await response.json();
        } else {
          data = await response.text();
        }
        resolve({ status: response.status, data: data });
      } catch (err) {
        resolve({ error: err.message });
      }
    });
  });
}

/** Resolve a LeetCode problem slug to an internal problemId via the API */
async function getProblemId(slug) {
  var result = await callApi('/api/leetcode/' + slug);
  if (result.error) throw new Error(result.error);
  if (result.status !== 200) throw new Error('Failed to resolve problem: HTTP ' + result.status);
  // API returns { id: number, ... }
  if (result.data && typeof result.data.id === 'number') {
    return result.data.id;
  }
  throw new Error('Problem ID not found in response');
}

/** Submit mastery feedback to the API */
async function submitFeedback(problemId, mastery) {
  var result = await callApi('/api/feedback', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ problemId: problemId, mastery: mastery })
  });
  if (result.error) throw new Error(result.error);
  if (result.status !== 200 && result.status !== 201) {
    throw new Error('API returned HTTP ' + result.status);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Message Handlers
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  // --- Existing: API Key updated notification ---
  if (message.action === 'apiKeyUpdated') {
    console.log('[AI LeetCode Coach] API Key updated');
    sendResponse({ ok: true });
    return false;
  }

  // --- Existing: Generic API call ---
  if (message.action === 'callApi') {
    callApi(message.endpoint).then(sendResponse);
    return true; // Keep channel open for async response
  }

  // --- Sync LeetCode CN data to backend ---
  if (message.type === 'SYNC_LEETCODE_DATA') {
    (async function() {
      try {
        var leetcodeProblemIds = message.payload.leetcodeProblemIds;
        if (!leetcodeProblemIds || !Array.isArray(leetcodeProblemIds) || leetcodeProblemIds.length === 0) {
          sendResponse({ success: false, error: 'No problem IDs provided' });
          return;
        }

        var result = await callApi('/api/user/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leetcodeProblemIds: leetcodeProblemIds })
        });

        if (result.error) {
          sendResponse({ success: false, error: result.error });
          return;
        }
        if (result.status !== 200) {
          sendResponse({ success: false, error: 'API returned HTTP ' + result.status, data: result.data });
          return;
        }

        sendResponse({ success: true, data: result.data });
      } catch (err) {
        console.error('[AI LeetCode Coach] Sync error:', err.message);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open for async response
  }

  // --- Get daily tasks for the extension popup ---
  if (message.type === 'GET_DAILY_TASKS') {
    (async function() {
      try {
        var result = await callApi('/api/daily-push');
        if (result.error) {
          sendResponse({ error: result.error });
          return;
        }
        if (result.status === 401) {
          sendResponse({ error: 'Not authenticated' });
          return;
        }
        if (result.status !== 200) {
          sendResponse({ error: 'Failed to fetch daily tasks: HTTP ' + result.status });
          return;
        }
        sendResponse(result.data);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // Keep channel open for async response
  }

  // --- New: Submit feedback after Accepted submission ---
  if (message.type === 'SUBMIT_FEEDBACK') {
    (async function() {
      try {
        var slug = message.slug;
        var mastery = message.mastery;

        if (!slug || ![1, 2, 3].includes(mastery)) {
          sendResponse({ success: false, error: 'Invalid slug or mastery' });
          return;
        }

        // Step 1: Resolve slug → problemId
        var problemId = await getProblemId(slug);

        // Step 2: Submit feedback
        await submitFeedback(problemId, mastery);

        // Step 3: Mark as complete in today's daily push (fire and forget)
        callApi('/api/daily-push/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ problemId: problemId, mastery: mastery })
        }).then(function(result) {
          if (result.error || result.status !== 200) {
            console.warn('[AI LeetCode Coach] Daily push complete failed:', result.error || result.status);
          } else {
            console.log('[AI LeetCode Coach] Daily push marked complete for problemId=' + problemId);
          }
        }).catch(function(err) {
          console.warn('[AI LeetCode Coach] Daily push complete error:', err.message);
        });

        sendResponse({ success: true });
      } catch (err) {
        console.error('[AI LeetCode Coach] Feedback error:', err.message);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // Keep channel open for async response
  }
});
