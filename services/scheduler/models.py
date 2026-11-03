"""
Pydantic models for the Adaptive Scheduling Engine (SSP-MMC Enhanced).

Models align with the project's JSON data format and Prisma schema.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ProblemDifficulty(str, Enum):
    """LeetCode problem difficulty levels."""
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"


class UserProblemStatus(str, Enum):
    """Status of a problem in the user's learning pipeline."""
    NEW = "new"
    LEARNING = "learning"
    REVIEW = "review"
    MASTERED = "mastered"


class Problem(BaseModel):
    """A LeetCode problem matching the actual data/problems.json structure."""
    id: int
    title: str
    titleCn: str = Field(default="")
    difficulty: ProblemDifficulty = ProblemDifficulty.EASY
    difficultyScore: float
    topic: str
    slug: str


class DependencyEntry(BaseModel):
    """Dependency relationships between problems."""
    problem_id: int
    prerequisites: list[int] = Field(default_factory=list)
    dependents: list[int] = Field(default_factory=list)


class UserProblem(BaseModel):
    """User's interaction state with a specific problem (mirrors Prisma UserProblem)."""
    user_id: str = Field(default="")
    problem_id: int = Field(default=0)
    mastery: float = 1.0
    nth_review: int = Field(default=0)
    next_review_date: Optional[datetime] = None
    status: UserProblemStatus = UserProblemStatus.NEW


class ScheduleResult(BaseModel):
    """Result of a scheduling decision for a single problem."""
    problem_id: int
    blocked: bool = False
    block_reason: str = ""
    next_review_date: Optional[datetime] = None
    interval_days: float = 0.0
    mastery: float = 1.0
    nth_review: int = 0
    difficulty_multiplier: float = 1.0
    topic_mastered: bool = False


class NextProblemsResult(BaseModel):
    """Result of getNextProblems: ordered list of problem IDs to review."""
    user_id: str
    problems: list[int]
    total_available: int
