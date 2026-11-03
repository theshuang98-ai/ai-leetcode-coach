// AI LeetCode 私教 — Task Sidebar (Shadow DOM)
// Shows today's task list as a left-side floating overlay.
// Exposes window.initTaskSidebar() and window.refreshTaskSidebar().
(function() {
  'use strict';

  var CSS_URL = chrome.runtime.getURL('content/styles.css');

  // ---------------------------------------------------------------------------
  // Module state
  // ---------------------------------------------------------------------------
  var host = null;
  var shadow = null;
  var isExpanded = false;
  var currentSlug = null;
  var tasks = [];
  var cssText = '';

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

  /** Build a LeetCode problem URL for the given slug */
  function getProblemUrl(slug) {
    var base = isCnSite() ? 'https://leetcode.cn' : 'https://leetcode.com';
    return base + '/problems/' + slug + '/';
  }

  /** Simple HTML escape (no DOM needed for attribute context) */
  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /** Escape a slug for use in a data-slug attribute */
  function escapeAttr(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  /**
   * Fetch today's task list from the background service worker.
   * @returns {Promise<Array>} Array of task objects: { slug, title, status }
   */
  function fetchTasks() {
    return new Promise(function(resolve) {
      chrome.runtime.sendMessage(
        { action: 'callApi', endpoint: '/api/daily-push' },
        function(response) {
          if (chrome.runtime.lastError) {
            console.warn(
              '[AI LeetCode Sidebar] Runtime error:',
              chrome.runtime.lastError.message
            );
            resolve([]);
            return;
          }
          if (!response || response.error) {
            console.warn(
              '[AI LeetCode Sidebar] API error:',
              response ? response.error : 'No response'
            );
            resolve([]);
            return;
          }

          // response = { status: number, data: { problems: [...] } }
          var data = response.data;
          if (data && Array.isArray(data.problems)) {
            resolve(data.problems);
          } else if (Array.isArray(data)) {
            resolve(data);
          } else {
            console.warn('[AI LeetCode Sidebar] Unexpected API response shape:', data);
            resolve([]);
          }
        }
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Task status logic
  // ---------------------------------------------------------------------------

  /**
   * Determine how a task should be displayed relative to the current page.
   * @returns {'completed'|'current'|'pending'}
   */
  function getTaskStatus(task) {
    if (task.status === 'solved') return 'completed';
    if (task.slug === currentSlug) return 'current';
    return 'pending';
  }

  // ---------------------------------------------------------------------------
  // HTML builders
  // ---------------------------------------------------------------------------

  /** Build the inner HTML for the task list */
  function buildTaskListHTML(taskList) {
    if (!taskList || taskList.length === 0) {
      return (
        '<div class="tl-sidebar-empty">' +
          '<div class="tl-empty-icon">📭</div>' +
          '<div class="tl-empty-text">暂无今日任务</div>' +
          '<div class="tl-empty-hint">先在 Web 端选择计划并触发每日推送</div>' +
        '</div>'
      );
    }

    var items = '';
    for (var i = 0; i < taskList.length; i++) {
      var task = taskList[i];
      var status = getTaskStatus(task);
      var icon = '';
      var rowClass = '';

      if (status === 'completed') {
        icon = '✅';
        rowClass = ' tl-task--completed';
      } else if (status === 'current') {
        icon = '📌';
        rowClass = ' tl-task--current';
      } else {
        icon = '⬜';
        rowClass = '';
      }

      items +=
        '<div class="tl-task' + rowClass + '" data-slug="' + escapeAttr(task.slug) + '">' +
          '<span class="tl-task-icon">' + icon + '</span>' +
          '<span class="tl-task-title">' + escapeHtml(task.title || task.slug) + '</span>' +
        '</div>';
    }

    return '<div class="tl-task-list">' + items + '</div>';
  }

  /** Build the entire Shadow DOM inner HTML */
  function buildInnerHTML(taskList) {
    var panelHidden = isExpanded ? '' : ' tl-panel--hidden';
    var toggleArrow = isExpanded ? '◀' : '▶';

    return (
      // Toggle tab (always visible on left edge)
      '<div class="tl-toggle" id="tl-toggle">' + toggleArrow + '</div>' +

      // Sidebar panel (slides in/out)
      '<div class="tl-panel' + panelHidden + '" id="tl-panel">' +

        // Header
        '<div class="tl-header">' +
          '<span class="tl-header-title">📋 今日任务</span>' +
          '<button class="tl-close-btn" id="tl-close" title="收起侧栏">✕</button>' +
        '</div>' +

        // Progress bar (if tasks exist)
        (taskList && taskList.length > 0
          ? '<div class="tl-progress-bar">' +
              '<div class="tl-progress-fill" style="width:' + getProgressPercent(taskList) + '%"></div>' +
            '</div>'
          : '') +

        // Task list
        buildTaskListHTML(taskList) +

      '</div>'
    );
  }

  /** Calculate completion percentage for the progress bar */
  function getProgressPercent(taskList) {
    if (!taskList || taskList.length === 0) return 0;
    var completed = 0;
    for (var i = 0; i < taskList.length; i++) {
      if (taskList[i].status === 'solved') completed++;
    }
    return Math.round((completed / taskList.length) * 100);
  }

  // ---------------------------------------------------------------------------
  // Render + bind events
  // ---------------------------------------------------------------------------

  function render() {
    if (!shadow) return;

    // Build and inject HTML
    shadow.innerHTML =
      '<style>' + cssText + '</style>' +
      buildInnerHTML(tasks);

    // --- Bind toggle button ---
    var toggleBtn = shadow.getElementById('tl-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', toggleSidebar);
    }

    // --- Bind close button ---
    var closeBtn = shadow.getElementById('tl-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        collapseSidebar();
      });
    }

    // --- Bind task row clicks (navigate to problem) ---
    var taskRows = shadow.querySelectorAll('.tl-task');
    for (var i = 0; i < taskRows.length; i++) {
      taskRows[i].addEventListener('click', function(e) {
        var slug = this.getAttribute('data-slug');
        if (slug && slug !== currentSlug) {
          window.location.href = getProblemUrl(slug);
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Toggle / collapse
  // ---------------------------------------------------------------------------

  function toggleSidebar() {
    isExpanded = !isExpanded;
    applyPanelState();
    updateToggleArrow();
  }

  function collapseSidebar() {
    isExpanded = false;
    applyPanelState();
    updateToggleArrow();
  }

  function expandSidebar() {
    isExpanded = true;
    applyPanelState();
    updateToggleArrow();
  }

  function applyPanelState() {
    if (!shadow) return;
    var panel = shadow.getElementById('tl-panel');
    if (!panel) return;

    if (isExpanded) {
      panel.classList.remove('tl-panel--hidden');
    } else {
      panel.classList.add('tl-panel--hidden');
    }
  }

  function updateToggleArrow() {
    if (!shadow) return;
    var toggleBtn = shadow.getElementById('tl-toggle');
    if (!toggleBtn) return;
    toggleBtn.textContent = isExpanded ? '◀' : '▶';
  }

  // ---------------------------------------------------------------------------
  // CSS loading
  // ---------------------------------------------------------------------------

  function loadCSS() {
    return fetch(CSS_URL)
      .then(function(res) { return res.text(); })
      .then(function(text) { cssText = text; })
      .catch(function(e) {
        console.warn('[AI LeetCode Sidebar] Failed to load styles.css:', e);
      });
  }

  // ---------------------------------------------------------------------------
  // Public API — called by content.js
  // ---------------------------------------------------------------------------

  /**
   * Initialize the task sidebar.
   * Should be called once when content script loads on a problem page.
   */
  window.initTaskSidebar = function() {
    currentSlug = getProblemSlug();
    if (!currentSlug) {
      console.log('[AI LeetCode Sidebar] Not a problem page, skipping init');
      return;
    }

    // Remove any existing sidebar (defensive)
    var existing = document.getElementById('aitoearn-sidebar-host');
    if (existing) existing.remove();

    // Create host and attach Shadow DOM
    host = document.createElement('div');
    host.id = 'aitoearn-sidebar-host';
    document.body.appendChild(host);
    shadow = host.attachShadow({ mode: 'open' });

    // Load CSS, fetch tasks, render
    loadCSS().then(function() {
      return fetchTasks();
    }).then(function(fetchedTasks) {
      tasks = fetchedTasks;
      render();
    }).catch(function(err) {
      console.warn('[AI LeetCode Sidebar] Init error:', err);
    });

    console.log('[AI LeetCode Sidebar] Initialized for problem:', currentSlug);
  };

  /**
   * Refresh the task list (e.g. after a rating submission marks a problem done).
   */
  window.refreshTaskSidebar = function() {
    currentSlug = getProblemSlug();

    fetchTasks().then(function(fetchedTasks) {
      tasks = fetchedTasks;
      render();

      // Auto-expand if we just completed a task (defensive check)
      if (tasks.length > 0) {
        var allDone = tasks.every(function(t) { return t.status === 'solved'; });
        if (!allDone && !isExpanded) {
          // Don't auto-expand - stay collapsed per spec
        }
      }
    }).catch(function(err) {
      console.warn('[AI LeetCode Sidebar] Refresh error:', err);
    });
  };

  console.log('[AI LeetCode Sidebar] Module loaded');
})();
