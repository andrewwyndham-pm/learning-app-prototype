import { Rating } from '@/types';

export interface FSRSReviewInput {
  stability: number;
  difficulty: number;
  last_review: Date | string | null;
  rating: Rating;
}

export interface FSRSReviewOutput {
  stability: number;
  difficulty: number;
  next_review: Date;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 10;
const MIN_STABILITY = 0.1;

const INITIAL_STABILITY_BY_RATING: Record<Rating, number> = {
  [Rating.Again]: 0.2,
  [Rating.Hard]: 1,
  [Rating.Good]: 3,
  [Rating.Easy]: 5,
};

const INITIAL_DIFFICULTY_BY_RATING: Record<Rating, number> = {
  [Rating.Again]: 7.5,
  [Rating.Hard]: 6.5,
  [Rating.Good]: 5,
  [Rating.Easy]: 4,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function daysBetween(now: Date, lastReview: Date | string | null) {
  if (!lastReview) {
    return 0;
  }

  const parsed = lastReview instanceof Date ? lastReview : new Date(lastReview);

  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }

  const elapsed = now.getTime() - parsed.getTime();

  return Math.max(0, elapsed / MS_PER_DAY);
}

function intervalFromStability(stability: number) {
  return Math.max(1, Math.round(stability));
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

function calculateInitialReview(rating: Rating, now: Date): FSRSReviewOutput {
  const stability = INITIAL_STABILITY_BY_RATING[rating];
  const difficulty = INITIAL_DIFFICULTY_BY_RATING[rating];
  const intervalDays = intervalFromStability(stability);

  return {
    stability,
    difficulty,
    next_review: addDays(now, intervalDays),
  };
}

export function calculateNextReview(input: FSRSReviewInput): FSRSReviewOutput {
  const now = new Date();
  const hasHistory = Boolean(input.last_review) && input.stability > 0;

  if (!hasHistory) {
    return calculateInitialReview(input.rating, now);
  }

  const elapsedDays = daysBetween(now, input.last_review);
  const currentStability = Math.max(input.stability, MIN_STABILITY);
  const currentDifficulty = clamp(input.difficulty || 5, MIN_DIFFICULTY, MAX_DIFFICULTY);
  const retrievability = Math.exp(-elapsedDays / currentStability);

  let nextDifficulty = currentDifficulty;
  let nextStability = currentStability;

  switch (input.rating) {
    case Rating.Again:
      nextDifficulty = clamp(currentDifficulty + 1.2, MIN_DIFFICULTY, MAX_DIFFICULTY);
      nextStability = Math.max(MIN_STABILITY, currentStability * 0.45);
      break;
    case Rating.Hard:
      nextDifficulty = clamp(currentDifficulty + 0.35, MIN_DIFFICULTY, MAX_DIFFICULTY);
      nextStability = currentStability * (1.05 + (1 - retrievability) * 0.35);
      break;
    case Rating.Good:
      nextDifficulty = clamp(currentDifficulty - 0.2, MIN_DIFFICULTY, MAX_DIFFICULTY);
      nextStability = currentStability * (1.3 + (1 - retrievability) * 0.9);
      break;
    case Rating.Easy:
      nextDifficulty = clamp(currentDifficulty - 0.5, MIN_DIFFICULTY, MAX_DIFFICULTY);
      nextStability = currentStability * (1.7 + (1 - retrievability) * 1.2);
      break;
    default:
      nextDifficulty = currentDifficulty;
      nextStability = currentStability;
  }

  const intervalModifier = clamp(1.4 - nextDifficulty / 20, 0.9, 1.35);
  const intervalDays = input.rating === Rating.Again
    ? 1
    : Math.max(1, Math.round(nextStability * intervalModifier));

  return {
    stability: Number(nextStability.toFixed(2)),
    difficulty: Number(nextDifficulty.toFixed(2)),
    next_review: addDays(now, intervalDays),
  };
}
