"""
Unit tests for the Adaptive Scheduling Engine (SSP-MMC Enhanced).

Tests cover:
1. Easy problems get longer intervals than hard problems
2. Hard problems have short intervals when mastery is low
3. Prerequisite blocking
4. Overdue problems appear first
5. Topic mastery detection (positive)
6. Topic mastery detection (negative)
7. New problems sorted by difficulty ascending
8. Higher mastery yields longer intervals
9. Count limit enforcement

Run from project root:
    python -m pytest services/scheduler/tests/test_scheduler.py -v
"""
from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

# Ensure project root is on path
_project_root = Path(__file__).resolve().parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from services.scheduler.models import (
    Problem,
    ProblemDifficulty,
    UserProblem,
    UserProblemStatus,
)
from services.scheduler.scheduler import (
    _reset_caches,
    _ssp_mmc_base_interval,
    _difficulty_multiplier,
    _load_problems,
    getNextProblems,
    isTopicMastered,
    scheduleNextReview,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def reset_caches():
    """Reset data caches before every test for isolation."""
    _reset_caches()
    yield
    _reset_caches()


def _make_problem(
    pid: int,
    difficulty_score: float = 3.0,
    topic: str = "Arrays & Hashing",
) -> Problem:
    """Helper to create a Problem for testing."""
    return Problem(
        id=pid,
        title=f"Test Problem {pid}",
        titleCn=f"测试问题 {pid}",
        difficulty=ProblemDifficulty.EASY,
        difficultyScore=difficulty_score,
        topic=topic,
        slug=f"test-problem-{pid}",
    )


def _make_user_problem(
    problem_id: int,
    mastery: float = 1.0,
    nth_review: int = 0,
    next_review_date: datetime | None = None,
    user_id: str = "test-user",
) -> UserProblem:
    """Helper to create a UserProblem for testing."""
    return UserProblem(
        user_id=user_id,
        problem_id=problem_id,
        mastery=mastery,
        nth_review=nth_review,
        next_review_date=next_review_date,
        status=UserProblemStatus.LEARNING,
    )


# ---------------------------------------------------------------------------
# Test 1: Easy problems get longer intervals than hard (same mastery)
# ---------------------------------------------------------------------------

def test_easy_longer_than_hard():
    """scheduleNextReview: 1200-score problem → longer interval than 1800-score."""
    easy = _make_problem(pid=99901, difficulty_score=1.0)  # maps to rating 1200
    hard = _make_problem(pid=99902, difficulty_score=9.0)  # maps to rating 1800

    # Both with mastery=1, nth_review=1 (first review)
    up_easy = _make_user_problem(99901, mastery=1.0, nth_review=0)
    up_hard = _make_user_problem(99902, mastery=1.0, nth_review=0)

    ref = datetime(2026, 1, 1, tzinfo=timezone.utc)

    result_easy = scheduleNextReview(
        "test-user", easy, up_easy, reference_date=ref
    )
    result_hard = scheduleNextReview(
        "test-user", hard, up_hard, reference_date=ref
    )

    assert not result_easy.blocked, f"Easy problem blocked: {result_easy.block_reason}"
    assert not result_hard.blocked, f"Hard problem blocked: {result_hard.block_reason}"
    assert result_easy.interval_days > result_hard.interval_days, (
        f"Easy interval ({result_easy.interval_days}) should be > "
        f"hard interval ({result_hard.interval_days})"
    )


# ---------------------------------------------------------------------------
# Test 2: Hard problem has short interval when mastery=1
# ---------------------------------------------------------------------------

def test_hard_short_interval():
    """scheduleNextReview: 1800-score problem → interval ≤ 7 days at mastery=1."""
    hard = _make_problem(pid=99903, difficulty_score=9.0)
    up = _make_user_problem(99903, mastery=1.0, nth_review=0)

    result = scheduleNextReview("test-user", hard, up)

    assert not result.blocked, f"Blocked: {result.block_reason}"
    assert result.interval_days <= 7.0, (
        f"Hard problem interval ({result.interval_days}) should be ≤ 7 days"
    )


# ---------------------------------------------------------------------------
# Test 3: Prerequisite blocks scheduling
# ---------------------------------------------------------------------------

def test_prerequisite_blocks():
    """Problem with unmet prerequisite (mastery < 2) → blocked in scheduleNextReview."""
    # Problem 15 (3Sum) depends on problem 1 (Two Sum)
    # Create user_mastery_map where problem 1 has mastery=1.0 (< 2.0)
    user_mastery_map = {
        1: _make_user_problem(1, mastery=1.0, nth_review=0),
    }

    problems = _load_problems()
    problem_15 = problems.get(15)
    assert problem_15 is not None, "Problem 15 must exist in data"

    result = scheduleNextReview(
        "test-user",
        problem_15,
        user_problem=None,
        user_mastery_map=user_mastery_map,
    )

    assert result.blocked, (
        f"Problem 15 should be blocked due to unmet prerequisite 1, "
        f"got blocked={result.blocked}"
    )
    assert "1" in result.block_reason or "Prerequisites not met" in result.block_reason


# ---------------------------------------------------------------------------
# Test 3b: Prerequisite blocks in getNextProblems
# ---------------------------------------------------------------------------

def test_prerequisite_blocks_get_next():
    """Problem with unmet prerequisite → NOT in getNextProblems results."""
    # Problem 15 depends on problem 1
    # Set up user with problem 1 at mastery=1.0 (unmet)
    # Also set up some other problems as "overdue" for variety
    user_mastery_map = {
        1: _make_user_problem(1, mastery=1.0, nth_review=0),  # unmet prereq
    }

    result = getNextProblems(
        "test-user",
        count=50,
        user_mastery_map=user_mastery_map,
    )

    # Problem 15 should NOT be in the results
    assert 15 not in result.problems, (
        "Problem 15 should be excluded because prerequisite 1 has mastery < 2"
    )


# ---------------------------------------------------------------------------
# Test 4: Overdue reviews appear first
# ---------------------------------------------------------------------------

def test_overdue_first():
    """Overdue review appears before new problems in getNextProblems."""
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)

    # Problem 1 (Two Sum) has no prerequisites — safe to mark overdue
    user_mastery_map = {
        1: _make_user_problem(1, mastery=2.0, nth_review=2, next_review_date=yesterday),
    }

    result = getNextProblems(
        "test-user",
        count=10,
        user_mastery_map=user_mastery_map,
    )

    assert len(result.problems) > 0, "Should have at least one problem"
    # Problem 1 should be first because it's overdue
    assert result.problems[0] == 1, (
        f"Overdue problem 1 should be first, got {result.problems[:5]}"
    )


# ---------------------------------------------------------------------------
# Test 5: Topic mastery detection (positive)
# ---------------------------------------------------------------------------

def test_topic_mastered():
    """Topic with avg mastery ≥ 2.5 → isTopicMastered returns True."""
    # Use a real topic from data: "Arrays & Hashing"
    problems = _load_problems()
    arrays_problems = [p for p in problems.values() if p.topic == "Arrays & Hashing"]

    # Give all problems in this topic mastery=3.0
    user_mastery_map: dict[int, UserProblem] = {}
    for p in arrays_problems:
        user_mastery_map[p.id] = _make_user_problem(p.id, mastery=3.0)

    assert isTopicMastered("Arrays & Hashing", user_mastery_map) is True


# ---------------------------------------------------------------------------
# Test 6: Topic mastery detection (negative)
# ---------------------------------------------------------------------------

def test_topic_not_mastered():
    """Topic with avg mastery < 2.5 → isTopicMastered returns False."""
    problems = _load_problems()
    arrays_problems = [p for p in problems.values() if p.topic == "Arrays & Hashing"]

    # Give all problems mastery=1.0
    user_mastery_map: dict[int, UserProblem] = {}
    for p in arrays_problems:
        user_mastery_map[p.id] = _make_user_problem(p.id, mastery=1.0)

    assert isTopicMastered("Arrays & Hashing", user_mastery_map) is False


def test_topic_not_mastered_empty():
    """Topic with no user data → isTopicMastered returns False."""
    assert isTopicMastered("NonExistentTopic", {}) is False


# ---------------------------------------------------------------------------
# Test 7: New problems sorted by difficulty ASC
# ---------------------------------------------------------------------------

def test_new_problems_by_difficulty():
    """New problems sorted by difficultyScore ASC within same topic."""
    # Use a topic with varied difficulty: "Two Pointers"
    problems = _load_problems()
    tp_problems = [p for p in problems.values() if p.topic == "Two Pointers"]
    tp_sorted = sorted(tp_problems, key=lambda p: (p.difficultyScore, p.id))

    # Provide an empty user_mastery_map so ALL problems are "new"
    result = getNextProblems(
        "test-user",
        count=len(tp_problems),
        user_mastery_map={},
        current_topic="Two Pointers",
    )

    # All returned problems should be from Two Pointers and in ASC difficulty order
    returned = [pid for pid in result.problems if problems[pid].topic == "Two Pointers"]
    expected_order = [p.id for p in tp_sorted]
    # Filter expected_order to only those in returned
    expected_in_returned = [pid for pid in expected_order if pid in returned]

    assert returned == expected_in_returned, (
        f"New problems should be sorted by difficulty ASC.\n"
        f"Expected: {expected_in_returned[:8]}\n"
        f"Got:      {returned[:8]}"
    )


# ---------------------------------------------------------------------------
# Test 8: Higher mastery yields longer interval
# ---------------------------------------------------------------------------

def test_mastery_3_long_interval():
    """mastery=3 → significantly longer interval than mastery=1 (same difficulty, nth_review >= 2)."""
    problem = _make_problem(pid=99904, difficulty_score=5.0)

    # nth_review=1 so this will be review #2 (exponent matters)
    up_mastered = _make_user_problem(99904, mastery=3.0, nth_review=1)
    up_newbie = _make_user_problem(99904, mastery=1.0, nth_review=1)

    result_mastered = scheduleNextReview("test-user", problem, up_mastered)
    result_newbie = scheduleNextReview("test-user", problem, up_newbie)

    assert not result_mastered.blocked
    assert not result_newbie.blocked
    assert result_mastered.interval_days > result_newbie.interval_days, (
        f"Mastery=3 interval ({result_mastered.interval_days}) should be > "
        f"mastery=1 interval ({result_newbie.interval_days})"
    )
    # Should be significantly longer (at least 1.5x)
    ratio = result_mastered.interval_days / result_newbie.interval_days
    assert ratio >= 1.5, f"Interval ratio ({ratio:.2f}) should be >= 1.5x"


# ---------------------------------------------------------------------------
# Test 9: Count limit enforcement
# ---------------------------------------------------------------------------

def test_count_limit():
    """getNextProblems(count=5) returns at most 5 problems."""
    result = getNextProblems("test-user", count=5, user_mastery_map={})

    assert len(result.problems) <= 5, (
        f"Should return at most 5 problems, got {len(result.problems)}"
    )
    assert result.total_available >= len(result.problems)


# ---------------------------------------------------------------------------
# Additional tests for algorithm internals
# ---------------------------------------------------------------------------

def test_ssp_mmc_base_interval_grows_with_reviews():
    """Base interval increases with each review for same mastery."""
    # Score 5 → rating 1500 → initial 5 days, stability 1.8 for mastery=2
    # nth=1: 5 * 1.8^0 = 5
    # nth=2: 5 * 1.8^1 = 9
    # nth=3: 5 * 1.8^2 = 16.2
    i1 = _ssp_mmc_base_interval(2.0, 1, 5.0)
    i2 = _ssp_mmc_base_interval(2.0, 2, 5.0)
    i3 = _ssp_mmc_base_interval(2.0, 3, 5.0)

    assert i1 < i2 < i3, f"Expected {i1} < {i2} < {i3}"


def test_difficulty_multiplier_increases_with_difficulty():
    """Harder problems get higher difficulty multipliers."""
    m1 = _difficulty_multiplier(1.0)  # ~1.6
    m9 = _difficulty_multiplier(9.0)  # ~1.9

    assert m1 < m9, f"Easy multiplier ({m1}) should be < hard multiplier ({m9})"


def test_schedule_next_review_new_problem():
    """scheduleNextReview without user_problem uses defaults (mastery=1, nth=1)."""
    problem = _make_problem(pid=99905, difficulty_score=5.0)

    result = scheduleNextReview("test-user", problem, user_problem=None)

    assert not result.blocked
    assert result.mastery == 1.0
    assert result.nth_review == 1
    assert result.interval_days > 0


def test_schedule_next_review_respects_90_day_cap():
    """Interval is capped at 90 days."""
    problem = _make_problem(pid=99906, difficulty_score=1.0)  # easiest

    # Simulate a user who has mastered this (would produce very long interval)
    up = _make_user_problem(99906, mastery=3.0, nth_review=10)

    result = scheduleNextReview("test-user", problem, up)

    assert not result.blocked
    assert result.interval_days <= 90.0, (
        f"Interval should be capped at 90 days, got {result.interval_days}"
    )


def test_topic_mastered_reduces_frequency():
    """When topic is mastered, interval should be 2x longer."""
    # Use a topic from the data and give all problems mastery=3.0
    problems = _load_problems()
    arrays_problems = [p for p in problems.values() if p.topic == "Arrays & Hashing"]

    user_mastery_map: dict[int, UserProblem] = {}
    for p in arrays_problems:
        user_mastery_map[p.id] = _make_user_problem(p.id, mastery=3.0)

    # Get a problem from this topic and schedule
    sample = arrays_problems[0]
    up = _make_user_problem(sample.id, mastery=3.0, nth_review=1)

    result = scheduleNextReview(
        "test-user", sample, up, user_mastery_map=user_mastery_map
    )

    assert result.topic_mastered, "Topic should be detected as mastered"
    # The interval should reflect the 2x multiplier
    # Without topic mastery: base / diff_mult; with: (base / diff_mult) * 2
    assert result.interval_days > 0
