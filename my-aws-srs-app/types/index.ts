export interface Flashcard {
  id: string;
  front: string;
  back: string;
  subject: string | null;
  lecture_date: string | null;
  stability: number;
  difficulty: number;
  last_review: string | null;
  next_review: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
}

export enum Rating {
  Again = 1,
  Hard = 2,
  Good = 3,
  Easy = 4,
}
