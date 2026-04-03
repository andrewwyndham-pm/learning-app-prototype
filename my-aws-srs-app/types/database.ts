export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      flashcards: {
        Row: {
          back: string;
          created_at: string;
          difficulty: number;
          front: string;
          id: string;
          last_review: string | null;
          lecture_date: string | null;
          next_review: string;
          stability: number;
          subject: string | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          back: string;
          created_at?: string;
          difficulty?: number;
          front: string;
          id?: string;
          last_review?: string | null;
          lecture_date?: string | null;
          next_review?: string;
          stability?: number;
          subject?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          back?: string;
          created_at?: string;
          difficulty?: number;
          front?: string;
          id?: string;
          last_review?: string | null;
          lecture_date?: string | null;
          next_review?: string;
          stability?: number;
          subject?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'flashcards_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      granola_processed_notes: {
        Row: {
          note_id: string;
          processed_at: string;
        };
        Insert: {
          note_id: string;
          processed_at?: string;
        };
        Update: {
          note_id?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
      sync_state: {
        Row: {
          key: string;
          updated_at: string;
          value: string;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: string;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
