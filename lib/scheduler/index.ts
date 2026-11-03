// Scheduling engine — daily push management
// - SM-2 inspired spaced repetition algorithm
// - Daily problem picking with prerequisite-aware filtering
// - Review scheduling

export {
  computeNextReview,
  arePrerequisitesMet,
  getNextProblemsForUser,
  generateDailyPush,
} from './push-engine';

export type { ProblemWithDetails } from './push-engine';
