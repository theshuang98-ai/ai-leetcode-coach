"""
LeetCode CN profile scraper using DrissionPage.

Called as a subprocess by the TypeScript DrissionPageCN adapter.
Anti-detection patterns adapted from ``auto_resume/browser.py``.

Usage:
    python leetcode_cn_scraper.py <username>

Outputs JSON to stdout:
    {
        "solvedCount": 42,
        "topicBreakdown": {"Easy": 20, "Medium": 15, "Hard": 7},
        "recentSubmissions": [...],
        "avatar": "https://...",
        "ranking": 123456
    }
"""

import json
import random
import sys
import time

try:
    from DrissionPage import ChromiumPage, ChromiumOptions
except ImportError:
    print(json.dumps({"error": "DrissionPage not installed — run: pip install DrissionPage"}))
    sys.exit(1)


# ---------------------------------------------------------------------------
#  Anti-detection helpers  (pattern from browser.py)
# ---------------------------------------------------------------------------

_STEALTH_JS = """
// Hide webdriver
Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });

// Fake chrome.runtime
window.chrome = {
    runtime: {
        connect: () => {},
        sendMessage: () => {},
        onMessage: { addListener: () => {} },
        onConnect: { addListener: () => {} },
        onInstalled: { addListener: () => {} },
    },
};

// Non-empty plugins array
Object.defineProperty(navigator, 'plugins', {
    get: () => [
        { 0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
          description: 'Portable Document Format', filename: 'internal-pdf-viewer', length: 1, name: 'Chrome PDF Plugin' },
        { 0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
          description: 'Portable Document Format', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', length: 1, name: 'Chrome PDF Viewer' },
    ],
    configurable: true,
});

// Language & platform fingerprints
Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'], configurable: true });
Object.defineProperty(navigator, 'platform', { get: () => 'Win32', configurable: true });
Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true });
"""


def _create_page() -> ChromiumPage:
    """Create a ChromiumPage with anti-detection options and stealth JS."""
    co = ChromiumOptions()
    co.set_argument("--no-sandbox")
    co.set_argument("--disable-blink-features", "AutomationControlled")

    # Random viewport to avoid viewport fingerprinting
    w = random.choice([1280, 1366, 1440, 1536])
    h = random.choice([720, 768, 800, 900])
    co.set_argument("window-size", f"{w},{h}")

    co.set_argument("--disable-gpu")
    co.set_argument("--disable-dev-shm-usage")
    co.set_argument("--disable-web-security")
    co.set_argument("--lang", "zh-CN")
    co.set_pref("intl.accept_languages", "zh-CN,zh;q=0.9,en;q=0.8")
    co.set_argument("--disable-automation")

    page = ChromiumPage(addr_or_opts=co)
    page.run_js(_STEALTH_JS)
    return page


# ---------------------------------------------------------------------------
#  Scraper
# ---------------------------------------------------------------------------

def scrape(username: str) -> dict:
    """Navigate to the user's LeetCode CN profile and extract stats."""
    page = _create_page()
    try:
        url = f"https://leetcode.cn/u/{username}/"
        page.get(url)

        # Human-like random delay
        time.sleep(random.uniform(2, 4))

        data = page.run_js("""
        (() => {
            const r = {
                solvedCount: 0,
                topicBreakdown: {},
                recentSubmissions: [],
                avatar: '',
                ranking: 0,
            };

            // Avatar
            const av = document.querySelector('img[class*="avatar"], img[alt*="avatar"]');
            if (av) r.avatar = av.src || '';

            // Solved counts by difficulty
            document.querySelectorAll('[class*="difficulty"]').forEach(el => {
                const txt = (el.textContent || '').trim();
                const m = txt.match(/^(Easy|Medium|Hard)\\s*(\\d+)/i);
                if (m) {
                    const key = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
                    r.topicBreakdown[key] = parseInt(m[2], 10);
                }
            });

            // Sum total
            for (const v of Object.values(r.topicBreakdown)) {
                r.solvedCount += v;
            }

            // Ranking
            const rankEl = document.querySelector('[class*="ranking"]');
            if (rankEl) {
                const rm = (rankEl.textContent || '').match(/(\\d+)/);
                if (rm) r.ranking = parseInt(rm[1], 10);
            }

            return r;
        })()
        """)

        return data  # type: ignore[return-value]
    finally:
        try:
            page.quit()
        except Exception:
            pass


# ---------------------------------------------------------------------------
#  Entry point
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Username argument required"}))
        sys.exit(1)

    result = scrape(sys.argv[1])
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
