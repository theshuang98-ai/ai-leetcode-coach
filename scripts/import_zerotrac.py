#!/usr/bin/env python3
"""
Import ZeroTrac LeetCode contest difficulty ratings into data/problems.json.

Downloads the ZeroTrac rating dataset, matches problems by LeetCode ID, and
adds the actual contestRating field. Also updates difficultyScore using a
mapping from ZeroTrac Rating (800-3500) to our 1-10 scale.

Usage:
    python scripts/import_zerotrac.py

Requires:
    - Python 3.8+ (stdlib only: urllib, json, os, sys, shutil)
    - Network access to download zerotrac data
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# ZeroTrac data URLs (primary + mirrors for China/blocked scenarios)
ZEROTRAC_URLS = [
    "https://zerotrac.github.io/leetcode_problem_rating/data.json",
    "https://raw.gitmirror.com/zerotrac/leetcode_problem_rating/main/data.json",
    "https://raw.githubusercontent.com/zerotrac/leetcode_problem_rating/main/data.json",
]

# Project root (two levels up from scripts/)
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DATA_PATH = PROJECT_ROOT / "data" / "problems.json"
VALIDATE_SCRIPT = SCRIPT_DIR / "validate_problems.py"

# ZeroTrac Rating → difficultyScore mapping (bijective with scheduler)
# Scheduler: rating = 1200 + (score - 1) * 75  (for scores 1-9)
# This mapping ensures approximate reversibility:
#
#   Rating range     | Score | Scheduler reverse
#   -----------------|-------|-------------------
#   < 1100           | 1     | 1200
#   1100 – <1300     | 2     | 1275
#   1300 – <1500     | 3     | 1350
#   1500 – <1700     | 4     | 1425
#   1700 – <1900     | 5     | 1500
#   1900 – <2100     | 6     | 1575
#   2100 – <2400     | 7     | 1650
#   2400 – <2700     | 8     | 1725
#   2700 – <3100     | 9     | 1800
#   >= 3100          | 10    | 1875
#
RATING_THRESHOLDS = [
    (1100, 1),
    (1300, 2),
    (1500, 3),
    (1700, 4),
    (1900, 5),
    (2100, 6),
    (2400, 7),
    (2700, 8),
    (3100, 9),
]  # (upper_bound_exclusive, score)
MAX_SCORE = 10


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def zerotrac_rating_to_score(rating: float) -> int:
    """Map a ZeroTrac Rating (800-3500) to our difficultyScore (1-10)."""
    for threshold, score in RATING_THRESHOLDS:
        if rating < threshold:
            return score
    return MAX_SCORE


def download_zerotrac_data() -> list[dict]:
    """Try each URL in order, return parsed JSON list or exit on failure."""
    last_error: Exception | None = None
    for url in ZEROTRAC_URLS:
        try:
            print(f"  Trying {url} ...", end=" ", flush=True)
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read().decode("utf-8")
            data = json.loads(raw)
            if not isinstance(data, list):
                print(f"unexpected type {type(data).__name__}, skipping")
                continue
            print(f"OK ({len(data)} entries)")
            return data
        except (urllib.error.URLError, urllib.error.HTTPError, OSError, json.JSONDecodeError) as e:
            print(f"FAILED: {e}")
            last_error = e
            continue

    print("\nError: Could not download ZeroTrac data from any URL.")
    if last_error:
        print(f"Last error: {last_error}")
    sys.exit(1)


def run_validation() -> bool:
    """Run validate_problems.py and return whether it passed."""
    if not VALIDATE_SCRIPT.exists():
        print(f"Warning: Validation script not found at {VALIDATE_SCRIPT}")
        return True  # can't validate = not a failure

    print("\n  Running validate_problems.py ...")
    result = subprocess.run(
        [sys.executable, str(VALIDATE_SCRIPT)],
        capture_output=True,
        text=True,
        cwd=str(PROJECT_ROOT),
    )
    # Print output (indented for readability)
    for line in result.stdout.splitlines():
        print(f"    {line}")
    if result.stderr:
        for line in result.stderr.splitlines():
            print(f"    [stderr] {line}")
    return result.returncode == 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("=" * 60)
    print("ZeroTrac Difficulty Importer")
    print("=" * 60)

    # -----------------------------------------------------------------------
    # Step 1: Download ZeroTrac data
    # -----------------------------------------------------------------------
    print("\n[1/4] Downloading ZeroTrac rating data ...")
    zerotrac_list = download_zerotrac_data()

    # Build ID -> entry lookup (match by LeetCode problem ID)
    zerotrac_by_id: dict[int, dict] = {}
    for entry in zerotrac_list:
        eid = entry.get("ID")
        if eid is not None:
            zerotrac_by_id[int(eid)] = entry

    print(f"    Zerotrac entries: {len(zerotrac_list)}")
    print(f"    Unique IDs:       {len(zerotrac_by_id)}")

    # -----------------------------------------------------------------------
    # Step 2: Load problems.json
    # -----------------------------------------------------------------------
    print("\n[2/4] Loading problems.json ...")
    if not DATA_PATH.exists():
        print(f"Error: {DATA_PATH} not found")
        sys.exit(1)

    with open(DATA_PATH, encoding="utf-8") as f:
        problems: list[dict] = json.load(f)

    print(f"    Problems loaded: {len(problems)}")

    # -----------------------------------------------------------------------
    # Step 3: Match and update difficultyScore + contestRating
    # -----------------------------------------------------------------------
    print("\n[3/4] Matching and updating difficulty scores ...")

    matched = 0
    updated_score = 0
    updated_rating = 0
    skipped_same = 0
    not_found_ids: list[int] = []

    for problem in problems:
        pid = problem.get("id")
        if pid is None:
            continue

        zerotrac_entry = zerotrac_by_id.get(pid)
        if zerotrac_entry is None:
            not_found_ids.append(pid)
            continue

        matched += 1
        rating = zerotrac_entry["Rating"]

        # Add contestRating (actual zerotrac rating)
        old_rating_val = problem.get("contestRating")
        problem["contestRating"] = round(float(rating), 2)
        if old_rating_val is None or abs(old_rating_val - rating) > 0.01:
            updated_rating += 1

        # Update difficultyScore (mapped from rating)
        new_score = zerotrac_rating_to_score(rating)
        old_score = problem.get("difficultyScore")

        if old_score != new_score:
            problem["difficultyScore"] = new_score
            updated_score += 1
        else:
            skipped_same += 1

    # -----------------------------------------------------------------------
    # Step 4: Save updated problems.json
    # -----------------------------------------------------------------------
    print("\n[4/4] Saving updated problems.json ...")

    # Backup original
    backup_path = DATA_PATH.with_suffix(".json.bak")
    shutil.copy2(DATA_PATH, backup_path)
    print(f"    Backup saved to: {backup_path}")

    # Write updated data
    with open(DATA_PATH, "w", encoding="utf-8", newline="\n") as f:
        json.dump(problems, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"    Written {len(problems)} problems to {DATA_PATH}")

    # -----------------------------------------------------------------------
    # Stats
    # -----------------------------------------------------------------------
    print("\n" + "=" * 60)
    print("Import Summary")
    print("=" * 60)
    print(f"  Total problems in problems.json:    {len(problems)}")
    print(f"  Matched in ZeroTrac data:           {matched}")
    print(f"  Updated (difficultyScore changed):  {updated_score}")
    print(f"  Updated (contestRating added):      {updated_rating}")
    print(f"  Skipped (already matching):         {skipped_same}")
    print(f"  Not found in ZeroTrac:              {len(not_found_ids)}")

    if not_found_ids:
        sample = not_found_ids[:10]
        print(f"  Sample unmatched IDs:               {', '.join(str(i) for i in sample)}")
        if len(not_found_ids) > 10:
            print(f"  ... and {len(not_found_ids) - 10} more")

    # Show rating distribution
    score_counts: dict[int, int] = {}
    for problem in problems:
        ds = problem.get("difficultyScore", 0)
        score_counts[ds] = score_counts.get(ds, 0) + 1
    print("\n  difficultyScore distribution after import:")
    for score in sorted(score_counts):
        print(f"    {score}: {score_counts[score]} problems")

    # -----------------------------------------------------------------------
    # Validation
    # -----------------------------------------------------------------------
    print("\n" + "-" * 60)
    print("Post-import validation")
    print("-" * 60)
    validation_ok = run_validation()

    if validation_ok:
        print("\nImport complete. All validations passed.")
    else:
        print("\nImport complete but validation FAILED. Check output above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
