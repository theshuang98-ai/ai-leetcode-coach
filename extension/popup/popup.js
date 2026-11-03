// AI LeetCode 私教 — Popup Script
const statusEl = document.getElementById('status');
const apiKeyInput = document.getElementById('apiKey');
const saveBtn = document.getElementById('saveBtn');
const disconnectBtn = document.getElementById('disconnectBtn');

// ── Task section elements ──
const tasksSection = document.getElementById('tasks-section');
const tasksTitle = document.getElementById('tasks-title');
const refreshBtn = document.getElementById('refreshBtn');
const streakBadge = document.getElementById('streakBadge');
const progressFill = document.getElementById('progressFill');
const taskList = document.getElementById('taskList');
const nextBtn = document.getElementById('nextBtn');
const celebration = document.getElementById('celebration');
const emptyState = document.getElementById('emptyState');
const taskError = document.getElementById('taskError');

// ── State ──
var tasks = [];
var isConnected = false;

// ---------------------------------------------------------------------------
// API / data fetching
// ---------------------------------------------------------------------------

/** Fetch today's tasks from the background worker via callApi */
function fetchTasks() {
  return new Promise(function(resolve) {
    chrome.runtime.sendMessage(
      { action: 'callApi', endpoint: '/api/daily-push' },
      function(response) {
        if (chrome.runtime.lastError) {
          console.warn('[Popup] Runtime error:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        if (!response || response.error) {
          console.warn('[Popup] API error:', response ? response.error : 'No response');
          resolve(null);
          return;
        }
        if (response.status !== 200) {
          console.warn('[Popup] API returned status:', response.status);
          resolve(null);
          return;
        }
        resolve(response.data);
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Hide all task sub-sections (list, empty, celebration, error) */
function hideAllTaskViews() {
  taskList.innerHTML = '';
  taskList.style.display = 'none';
  celebration.classList.remove('visible');
  emptyState.classList.remove('visible');
  taskError.style.display = 'none';
  nextBtn.style.display = 'none';
}

/** Show the error message */
function showError(msg) {
  hideAllTaskViews();
  taskError.textContent = msg;
  taskError.style.display = 'block';
}

/** Show empty state */
function showEmpty() {
  hideAllTaskViews();
  emptyState.classList.add('visible');
}

/** Render the task list and all sub-views */
function renderTasks(data) {
  hideAllTaskViews();

  if (!data) {
    showError('无法获取任务数据，请检查网络连接');
    return;
  }

  var problems = data.problems;
  var streak = data.streak;
  var progress = data.progress;

  // ── No tasks ──
  if (!problems || problems.length === 0) {
    showEmpty();
    tasksTitle.textContent = '今日任务';
    streakBadge.style.display = 'none';
    progressFill.style.width = '0%';
    return;
  }

  tasks = problems;

  // ── Title with counts ──
  var completed = progress ? progress.completed : 0;
  var total = progress ? progress.total : problems.length;
  tasksTitle.textContent = '今日任务 (' + completed + '/' + total + ')';

  // ── Streak ──
  if (streak && streak > 0) {
    streakBadge.textContent = '🔥 连续打卡 ' + streak + ' 天';
    streakBadge.style.display = 'block';
  } else {
    streakBadge.style.display = 'none';
  }

  // ── Progress bar ──
  var pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  progressFill.style.width = pct + '%';

  // ── Check if all completed ──
  var allDone = completed >= total;

  if (allDone) {
    // Celebration
    celebration.classList.add('visible');
    taskList.style.display = 'none';
    nextBtn.style.display = 'none';
  } else {
    // Task list
    taskList.style.display = 'block';
    var html = '';
    for (var i = 0; i < problems.length; i++) {
      var task = problems[i];
      var isSolved = task.status === 'solved';
      var icon = isSolved ? '✅' : '⬜';
      var rowClass = isSolved ? ' task-row--solved' : '';
      var safeSlug = escapeAttr(task.slug);
      html +=
        '<div class="task-row' + rowClass + '" data-slug="' + safeSlug + '">' +
          '<span class="task-icon">' + icon + '</span>' +
          '<span class="task-title">' + escapeHtml(task.title || task.slug) + '</span>' +
        '</div>';
    }
    taskList.innerHTML = html;

    // Bind click events on task rows
    var rows = taskList.querySelectorAll('.task-row');
    for (var j = 0; j < rows.length; j++) {
      rows[j].addEventListener('click', function() {
        var slug = this.getAttribute('data-slug');
        if (slug) {
          chrome.tabs.create({ url: 'https://leetcode.com/problems/' + slug + '/' });
        }
      });
    }

    // Next button
    nextBtn.style.display = 'block';
    var hasPending = false;
    for (var k = 0; k < problems.length; k++) {
      if (problems[k].status !== 'solved') {
        hasPending = true;
        break;
      }
    }
    nextBtn.disabled = !hasPending;
  }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Load and render tasks, handling all states */
function loadAndRenderTasks() {
  if (!isConnected) return;

  // Show the section
  tasksSection.classList.add('visible');

  // Reset to loading state
  tasksTitle.textContent = '今日任务';
  streakBadge.style.display = 'none';
  progressFill.style.width = '0%';
  hideAllTaskViews();

  fetchTasks().then(function(data) {
    renderTasks(data);
  });
}

/** Hide the task section (on disconnect) */
function hideTasks() {
  tasksSection.classList.remove('visible');
  tasks = [];
}

/** Open the first pending task in a new tab */
function openNextTask() {
  for (var i = 0; i < tasks.length; i++) {
    if (tasks[i].status !== 'solved') {
      chrome.tabs.create({ url: 'https://leetcode.com/problems/' + tasks[i].slug + '/' });
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape HTML entities */
function escapeHtml(str) {
  if (!str) return '';
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Escape a string for use in an HTML attribute */
function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Sync (LeetCode CN data)
// ---------------------------------------------------------------------------

const syncSection = document.getElementById('sync-section');
const syncBtn = document.getElementById('syncBtn');
const syncBtnCn = document.getElementById('syncBtnCn');
const syncStatus = document.getElementById('syncStatus');

/** Check the active tab and show/hide sync buttons accordingly */
function checkActiveTabForSync() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs[0];
    if (!tab || !tab.url) {
      syncSection.style.display = 'none';
      return;
    }

    var url = tab.url.toLowerCase();
    var isLeetcodeCom = url.indexOf('leetcode.com') !== -1;
    var isLeetcodeCn = url.indexOf('leetcode.cn') !== -1;

    if (isLeetcodeCn || isLeetcodeCom) {
      syncSection.style.display = 'block';
      syncBtnCn.style.display = isLeetcodeCn ? 'block' : 'none';
      syncBtn.style.display = isLeetcodeCom ? 'block' : 'none';
      syncStatus.style.display = 'none';
    } else {
      syncSection.style.display = 'none';
    }
  });
}

/**
 * Trigger LeetCode CN data sync via chrome.scripting.executeScript.
 * Injects a function into the active tab (any leetcode.cn page) to fetch
 * AC problem IDs from the LeetCode CN API, then sends them to the background
 * worker. Works on ANY leetcode.cn page, not just /problems/*.
 */
function triggerSync() {
  syncBtn.disabled = true;
  syncBtnCn.disabled = true;
  syncStatus.textContent = '同步中...';
  syncStatus.className = '';
  syncStatus.style.display = 'block';

  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    var tab = tabs[0];
    if (!tab || !tab.id) {
      syncStatus.textContent = '错误：无法找到当前标签页';
      syncStatus.style.color = '#ef4444';
      resetSyncButtons();
      return;
    }

    // Inject a function into the page that fetches AC problem IDs from LeetCode CN
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: function() {
        return fetch('https://leetcode.cn/api/problems/all/', {
          credentials: 'include'
        }).then(function(response) {
          if (!response.ok) {
            throw new Error('HTTP ' + response.status);
          }
          return response.json();
        }).then(function(data) {
          var pairs = data.stat_status_pairs || [];
          var acIds = [];
          for (var i = 0; i < pairs.length; i++) {
            if (pairs[i].status === 'ac') {
              acIds.push(pairs[i].stat.question_id);
            }
          }
          return acIds;
        });
      }
    }, function(injectionResults) {
      // Handle injection failure
      if (chrome.runtime.lastError) {
        syncStatus.textContent = '同步失败：无法注入同步脚本，请刷新页面后重试';
        syncStatus.style.color = '#ef4444';
        resetSyncButtons();
        return;
      }

      // Handle fetch / parse failure inside the injected script
      var injected = injectionResults && injectionResults[0];
      if (!injected || injected.error) {
        syncStatus.textContent = '获取 LeetCode 数据失败，请确认已登录 leetcode.cn';
        syncStatus.style.color = '#ef4444';
        resetSyncButtons();
        return;
      }

      var acIds = injected.result;
      if (!acIds || !Array.isArray(acIds) || acIds.length === 0) {
        syncStatus.textContent = '未找到已通过的题目';
        syncStatus.style.color = '#ef4444';
        resetSyncButtons();
        return;
      }

      // Send AC problem IDs to background worker for syncing to backend
      chrome.runtime.sendMessage({
        type: 'SYNC_LEETCODE_DATA',
        payload: { leetcodeProblemIds: acIds }
      }, function(response) {
        if (chrome.runtime.lastError) {
          syncStatus.textContent = '同步到服务器失败';
          syncStatus.style.color = '#ef4444';
          resetSyncButtons();
          return;
        }

        if (response && response.success) {
          var data = response.data || {};
          var synced = data.syncedCount || 0;
          var skipped = data.skippedCount || 0;
          syncStatus.textContent = '同步完成！已同步 ' + synced + ' 道题' + (skipped > 0 ? '，跳过 ' + skipped + ' 道' : '');
          syncStatus.style.color = '#166534';
        } else {
          var errMsg = (response && response.error) ? response.error : '同步到服务器失败';
          syncStatus.textContent = errMsg;
          syncStatus.style.color = '#ef4444';
        }
        resetSyncButtons();
      });
    });
  });
}

function resetSyncButtons() {
  syncBtn.disabled = false;
  syncBtnCn.disabled = false;
}

// Sync button click handlers
syncBtn.addEventListener('click', triggerSync);
syncBtnCn.addEventListener('click', triggerSync);

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

// Refresh button
refreshBtn.addEventListener('click', function() {
  loadAndRenderTasks();
});

// Next task button
nextBtn.addEventListener('click', function() {
  openNextTask();
});

// ---------------------------------------------------------------------------
// Initialize: check existing key
// ---------------------------------------------------------------------------

function initializePopup() {
  chrome.storage.sync.get(['apiKey'], function(result) {
    if (result.apiKey) {
      isConnected = true;
      statusEl.textContent = '已连接 ✓';
      statusEl.className = 'status connected';
      apiKeyInput.value = result.apiKey;
      apiKeyInput.disabled = true;
      saveBtn.style.display = 'none';
      disconnectBtn.style.display = 'block';
      // Fetch and render tasks
      loadAndRenderTasks();
      // Check for sync availability
      checkActiveTabForSync();
    }
  });
}

initializePopup();

// Save API Key
saveBtn.addEventListener('click', function() {
  var key = apiKeyInput.value.trim();
  if (!key || !/^[0-9a-fA-F]{32}$/.test(key)) {
    statusEl.textContent = '错误：请输入 32 位十六进制 API Key';
    statusEl.className = 'status disconnected';
    return;
  }
  chrome.storage.sync.set({ apiKey: key }, function() {
    isConnected = true;
    statusEl.textContent = '已连接 ✓';
    statusEl.className = 'status connected';
    apiKeyInput.disabled = true;
    saveBtn.style.display = 'none';
    disconnectBtn.style.display = 'block';
    chrome.runtime.sendMessage({ action: 'apiKeyUpdated', key: key });
    // Fetch and render tasks
    loadAndRenderTasks();
  });
});

// Disconnect
disconnectBtn.addEventListener('click', function() {
  chrome.storage.sync.remove('apiKey', function() {
    isConnected = false;
    statusEl.textContent = '未连接 — 请输入 API Key';
    statusEl.className = 'status disconnected';
    apiKeyInput.value = '';
    apiKeyInput.disabled = false;
    saveBtn.style.display = 'block';
    disconnectBtn.style.display = 'none';
    hideTasks();
  });
});
