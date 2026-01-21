
export interface MemeTemplate {
  id: string;
  title: string;
  category: string;
  coverImage: string;
  images: string[]; // Support for multiple variants
  movieTitle: string; // Used for default text in the form
  costume: string; // Description of what the character should be wearing
}

export type GenerationStep = 'gallery' | 'customize' | 'processing' | 'result';
export type MemeTone = 'Funny' | 'Action' | 'Horror' | 'Romance';

export interface MemeData {
  userPhoto: string | null;
  userName: string;
  movieTitle: string;
  tagline: string;
  coverText: string;
  tone: MemeTone;
  template: MemeTemplate | null;
  resultUrl: string | null;
  selectedPosterUrl?: string;
}
