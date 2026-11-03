"""
Adaptive Scheduling Engine — SSP-MMC Enhanced for LeetCode.

Core scheduling algorithm that determines optimal review intervals based on:
- Spaced repetition (SSP-MMC core adapted from memory model)
- Difficulty weighting (harder problems reviewed more frequently)
- Prerequisite chains (don't schedule before prerequisites are solid)
- Topic mastery detection (reduce frequency for mastered topics)

All functions are purely deterministic — no random, no LLM calls.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from .models import (
    DependencyEntry,
    NextProblemsResult,
    Problem,
    ScheduleResult,
    UserProblem,
)

# ---------------------------------------------------------------------------
# FastAPI router
# ---------------------------------------------------------------------------

router = APIRouter(tags=["scheduler"])

# ---------------------------------------------------------------------------
# Data loading helpers
# ---------------------------------------------------------------------------

_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"

_problems_cache: Optional[dict[int, Problem]] = None
_dependencies_cache: Optional[dict[int, DependencyEntry]] = None
_topics_cache: Optional[list[str]] = None


def _reset_caches() -> None:
    """Reset all data caches (for testing)."""
    global _problems_cache, _dependencies_cache, _topics_cache
    _problems_cache = None
    _dependencies_cache = None
    _topics_cache = None


def _load_problems() -> dict[int, Problem]:
    """Load problems from data/problems.json, keyed by problem id."""
    global _problems_cache
    if _problems_cache is not None:
        return _problems_cache

    path = _DATA_DIR / "problems.json"
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    _problems_cache = {}
    for item in raw:
        p = Problem(**item)
        _problems_cache[p.id] = p
    return _problems_cache


def _load_dependencies() -> dict[int, DependencyEntry]:
    """Load dependencies from data/dependencies.json, keyed by problem id."""
    global _dependencies_cache
    if _dependencies_cache is not None:
        return _dependencies_cache

    path = _DATA_DIR / "dependencies.json"
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    _dependencies_cache = {}
    for key_str, val in raw.items():
        pid = int(key_str)
        _dependencies_cache[pid] = DependencyEntry(
            problem_id=pid,
            prerequisites=[int(p) for p in val.get("prerequisites", [])],
            dependents=[int(d) for d in val.get("dependents", [])],
        )
    return _dependencies_cache


def _load_topics() -> list[str]:
    """Return ordered list of topics (in order of first appearance in problems.json)."""
    global _topics_cache
    if _topics_cache is not None:
        return _topics_cache

    path = _DATA_DIR / "problems.json"
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)

    seen: set[str] = set()
    _topics_cache = []
    for item in raw:
        topic = item.get("topic", "")
        if topic and topic not in seen:
            seen.add(topic)
            _topics_cache.append(topic)
    return _topics_cache


# ---------------------------------------------------------------------------
# SSP-MMC Core Algorithm
# ---------------------------------------------------------------------------

def _map_difficulty_to_contest_rating(difficulty_score: float) -> float:
    """Map the 1-9 difficulty score to LeetCode contest rating 1200-1800.

    Data scores range 1 (easiest) to 9 (hardest).
    Contest ratings range 1200 to 1800.
    Linear mapping: rating = 1200 + (score - 1) * 75
    """
    return 1200.0 + (difficulty_score - 1.0) * 75.0


def _get_initial_interval(contest_rating: float) -> float:
    """Get initial review interval in days based on problem difficulty.

    1200 → 7 days (easiest — review less often)
    1400 → 5 days
    1600 → 3 days
    1800 → 2 days (hardest — review more often)
    """
    if contest_rating <= 1300:
        return 7.0
    elif contest_rating <= 1500:
        return 5.0
    elif contest_rating <= 1700:
        return 3.0
    else:
        return 2.0


def _get_stability_factor(mastery: float) -> float:
    """Get stability factor based on user mastery level.

    mastery >= 3.0 → 2.5 (high retention — long intervals)
    mastery >= 2.0 → 1.8 (moderate retention)
    mastery  < 2.0 → 1.2 (low retention — short intervals)
    """
    if mastery >= 3.0:
        return 2.5
    elif mastery >= 2.0:
        return 1.8
    else:
        return 1.2


def _ssp_mmc_base_interval(
    mastery: float, nth_review: int, difficulty_score: float
) -> float:
    """SSP-MMC core: compute base review interval in days.

    Formula: initial_interval * stability_factor ^ (nth_review - 1)

    - initial_interval depends on difficulty (harder = shorter)
    - stability_factor depends on mastery (higher mastery = longer intervals)
    - nth_review grows the interval exponentially with each successful review
    """
    rating = _map_difficulty_to_contest_rating(difficulty_score)
    initial = _get_initial_interval(rating)
    stability = _get_stability_factor(mastery)
    return initial * (stability ** max(nth_review - 1, 0))


# ---------------------------------------------------------------------------
# Difficulty Weighting
# ---------------------------------------------------------------------------

def _difficulty_multiplier(difficulty_score: float) -> float:
    """Compute the difficulty multiplier for interval adjustment.

    Uses LeetCode contest rating range: 1200→1.6, 1800→1.9
    Formula: 1.0 + (contest_rating / 2000)
    """
    rating = _map_difficulty_to_contest_rating(difficulty_score)
    return 1.0 + (rating / 2000.0)


# ---------------------------------------------------------------------------
# Prerequisite Check
# ---------------------------------------------------------------------------

def _get_prerequisites(problem_id: int) -> list[int]:
    """Get prerequisite problem IDs for a given problem."""
    deps = _load_dependencies()
    entry = deps.get(problem_id)
    return entry.prerequisites if entry else []


def _are_prerequisites_met(
    problem_id: int, user_mastery_map: dict[int, UserProblem]
) -> bool:
    """Check if all prerequisites of a problem are met (mastery >= 2.0)."""
    prereqs = _get_prerequisites(problem_id)
    if not prereqs:
        return True  # No prerequisites → always met

    for prereq_id in prereqs:
        up = user_mastery_map.get(prereq_id)
        if up is None or up.mastery < 2.0:
            return False
    return True


def _get_blocking_prerequisites(
    problem_id: int, user_mastery_map: dict[int, UserProblem]
) -> list[int]:
    """Return list of prerequisite IDs that are NOT met."""
    prereqs = _get_prerequisites(problem_id)
    blocking: list[int] = []
    for prereq_id in prereqs:
        up = user_mastery_map.get(prereq_id)
        if up is None or up.mastery < 2.0:
            blocking.append(prereq_id)
    return blocking


# ---------------------------------------------------------------------------
# Topic Mastery
# ---------------------------------------------------------------------------

def isTopicMastered(
    topic: str, user_mastery_map: dict[int, UserProblem]
) -> bool:
    """Check if a topic is mastered (average mastery across all its problems >= 2.5).

    Args:
        topic: The topic name (e.g., "Arrays & Hashing")
        user_mastery_map: Map of problem_id → UserProblem with mastery data

    Returns:
        True if the topic's average mastery >= 2.5
    """
    problems = _load_problems()
    topic_problems = [p for p in problems.values() if p.topic == topic]
    if not topic_problems:
        return False

    total_mastery = 0.0
    count = 0
    for p in topic_problems:
        up = user_mastery_map.get(p.id)
        if up is not None:
            total_mastery += up.mastery
            count += 1

    if count == 0:
        return False

    return (total_mastery / count) >= 2.5


# ---------------------------------------------------------------------------
# Core Scheduling Function
# ---------------------------------------------------------------------------

def scheduleNextReview(
    user_id: str,
    problem: Problem,
    user_problem: Optional[UserProblem] = None,
    user_mastery_map: Optional[dict[int, UserProblem]] = None,
    reference_date: Optional[datetime] = None,
) -> ScheduleResult:
    """Schedule the next review date for a problem using SSP-MMC Enhanced.

    Algorithm:
    1. Compute base_interval via SSP-MMC core
    2. Apply difficulty weighting (harder = more frequent)
    3. Check prerequisites — block if any unmet
    4. Check topic mastery — reduce frequency if mastered
    5. Cap at 90 days

    Args:
        user_id: The user to schedule for
        problem: The LeetCode problem
        user_problem: User's current state for this problem (None for new)
        user_mastery_map: Map of all user's problem states (for prereq/topic checks)
        reference_date: Override "today" (for testing)

    Returns:
        ScheduleResult with next review date and diagnostic fields
    """
    if user_mastery_map is None:
        user_mastery_map = {}

    now = reference_date or datetime.now(timezone.utc)

    # Determine mastery and nth_review from user state
    if user_problem is not None:
        mastery = user_problem.mastery
        nth_review = user_problem.nth_review + 1  # This will be the next review number
    else:
        mastery = 1.0
        nth_review = 1

    # ENHANCEMENT 2: Prerequisite check
    blocking = _get_blocking_prerequisites(problem.id, user_mastery_map)
    if blocking:
        return ScheduleResult(
            problem_id=problem.id,
            blocked=True,
            block_reason=f"Prerequisites not met: {blocking}",
            mastery=mastery,
            nth_review=nth_review,
        )

    # ENHANCEMENT 3: Topic mastery check
    topic_mastered = isTopicMastered(problem.topic, user_mastery_map)

    # Core SSP-MMC
    base_interval = _ssp_mmc_base_interval(mastery, nth_review, problem.difficultyScore)

    # ENHANCEMENT 1: Difficulty weighting
    diff_mult = _difficulty_multiplier(problem.difficultyScore)
    adjusted_interval = base_interval / diff_mult

    # ENHANCEMENT 3 (continued): Reduce frequency for mastered topics
    if topic_mastered:
        adjusted_interval *= 2.0

    # Cap at 90 days
    adjusted_interval = min(adjusted_interval, 90.0)

    next_date = now + timedelta(days=adjusted_interval)

    return ScheduleResult(
        problem_id=problem.id,
        blocked=False,
        next_review_date=next_date,
        interval_days=round(adjusted_interval, 2),
        mastery=mastery,
        nth_review=nth_review,
        difficulty_multiplier=round(diff_mult, 4),
        topic_mastered=topic_mastered,
    )


# ---------------------------------------------------------------------------
# Problem Recommendation
# ---------------------------------------------------------------------------

def getNextProblems(
    user_id: str,
    count: int = 10,
    user_mastery_map: Optional[dict[int, UserProblem]] = None,
    current_topic: Optional[str] = None,
    reference_date: Optional[datetime] = None,
) -> NextProblemsResult:
    """Get the next problems a user should review, ordered by priority.

    Priority order:
    1. Overdue reviews (nextReviewDate <= today) — by daysOverdue DESC
    2. New problems from current topic — by difficultyScore ASC
    3. New problems from next topic — by difficultyScore ASC

    Excludes:
    - Problems blocked by unmet prerequisites

    Args:
        user_id: The user to get problems for
        count: Maximum number of problems to return
        user_mastery_map: Map of all user's problem states
        current_topic: The user's current topic (None = all topics eligible)
        reference_date: Override "today" (for testing)

    Returns:
        NextProblemsResult with ordered problem IDs
    """
    if user_mastery_map is None:
        user_mastery_map = {}

    now = reference_date or datetime.now(timezone.utc)
    problems = _load_problems()
    topics = _load_topics()

    # Determine current and next topic
    current_idx = -1
    if current_topic and current_topic in topics:
        current_idx = topics.index(current_topic)
    next_topic = topics[current_idx + 1] if current_idx >= 0 and current_idx + 1 < len(topics) else None

    # --- Category 1: Overdue reviews ---
    overdue: list[tuple[int, float]] = []  # (problem_id, days_overdue)
    for up in user_mastery_map.values():
        if up.next_review_date is not None and up.next_review_date <= now:
            days_overdue = (now - up.next_review_date).total_seconds() / 86400.0
            # Check prerequisites
            if _are_prerequisites_met(up.problem_id, user_mastery_map):
                overdue.append((up.problem_id, days_overdue))

    # Sort overdue by daysOverdue DESC
    overdue.sort(key=lambda x: x[1], reverse=True)
    overdue_ids = [pid for pid, _ in overdue]

    # --- Categories 2 & 3: New problems ---
    # A problem is "new" if user_mastery_map has no entry for it
    all_problem_ids = set(problems.keys())
    known_ids = set(user_mastery_map.keys())
    new_ids = all_problem_ids - known_ids

    # Filter new problems: must have met prerequisites
    eligible_new: list[Problem] = []
    for pid in new_ids:
        if _are_prerequisites_met(pid, user_mastery_map):
            eligible_new.append(problems[pid])

    # Split by topic
    current_topic_new: list[Problem] = []
    next_topic_new: list[Problem] = []
    other_new: list[Problem] = []

    for p in eligible_new:
        if current_topic and p.topic == current_topic:
            current_topic_new.append(p)
        elif next_topic and p.topic == next_topic:
            next_topic_new.append(p)
        else:
            other_new.append(p)

    # Sort each group by difficultyScore ASC, then by id for deterministic tie-breaking
    current_topic_new.sort(key=lambda p: (p.difficultyScore, p.id))
    next_topic_new.sort(key=lambda p: (p.difficultyScore, p.id))
    other_new.sort(key=lambda p: (p.difficultyScore, p.id))

    # Combine in priority order: overdue → current_topic new → next_topic new → other new
    result_ids = list(overdue_ids)
    for p in current_topic_new:
        if p.id not in result_ids:
            result_ids.append(p.id)
    for p in next_topic_new:
        if p.id not in result_ids:
            result_ids.append(p.id)
    for p in other_new:
        if p.id not in result_ids:
            result_ids.append(p.id)

    total_available = len(result_ids)
    result_ids = result_ids[:count]

    return NextProblemsResult(
        user_id=user_id,
        problems=result_ids,
        total_available=total_available,
    )


# ---------------------------------------------------------------------------
# FastAPI Endpoints
# ---------------------------------------------------------------------------

@router.get("/schedule/{problem_id}", response_model=ScheduleResult)
async def api_schedule_next_review(
    problem_id: int,
    user_id: str = Query(..., description="User ID"),
    mastery: float = Query(1.0, ge=1.0, le=3.0, description="Current mastery 1.0-3.0"),
    nth_review: int = Query(0, ge=0, description="Current review count"),
):
    """Schedule next review for a specific problem."""
    problems = _load_problems()
    problem = problems.get(problem_id)
    if problem is None:
        raise HTTPException(status_code=404, detail=f"Problem {problem_id} not found")

    user_problem = UserProblem(
        user_id=user_id,
        problem_id=problem_id,
        mastery=mastery,
        nth_review=nth_review,
    )

    result = scheduleNextReview(
        user_id=user_id,
        problem=problem,
        user_problem=user_problem,
    )
    return result


@router.get("/next", response_model=NextProblemsResult)
async def api_get_next_problems(
    user_id: str = Query(..., description="User ID"),
    count: int = Query(10, ge=1, le=50, description="Max problems to return"),
    current_topic: Optional[str] = Query(None, description="Current topic"),
):
    """Get next problems to review for a user."""
    result = getNextProblems(
        user_id=user_id,
        count=count,
        current_topic=current_topic,
    )
    return result


@router.get("/topic-mastered/{topic}")
async def api_is_topic_mastered(
    topic: str,
    user_id: str = Query(..., description="User ID"),
):
    """Check if a topic is mastered."""
    # For API, we need a user_mastery_map — this would come from DB in production
    # For now, return not mastered as a safe default when no data
    return {"topic": topic, "mastered": False, "user_id": user_id}
