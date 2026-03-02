
export interface MemeTemplate {
  id: string;
  title: string;
  coverUrl: string;
  theme: string;
  costume: string;
}

export type GenerationStep = 'hero' | 'generator' | 'processing' | 'intercept' | 'result' | 'admin';
export type MemeTone = 'Funny' | 'Funnier' | 'Dumb Funny';

export interface PosterBlueprint {
  title: string;
  tagline: string;
  credits: string;
  visual_prompt: string;
}

export interface MemeData {
  userPhoto: string | null;
  userName: string;
  tone: MemeTone;
  template: MemeTemplate | null;
  resultUrl: string | null;
}
