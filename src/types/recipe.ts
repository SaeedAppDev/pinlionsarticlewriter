export interface Headline {
  text: string;
  angle: 'quick' | 'healthy' | 'family' | 'budget' | 'viral';
}

export interface SEOContent {
  title: string;
  description: string;
  hashtags: string[];
}

export interface ViralityBreakdown {
  visualClarity: number;
  textOverlayStrength: number;
  keywordRelevance: number;
  scrollStopPotential: number;
}

export interface ViralityScore {
  overall: number;
  breakdown: ViralityBreakdown;
}

export interface ImagePrompt {
  prompt: string;
  angle: 'quick' | 'healthy' | 'family' | 'budget' | 'viral';
  overlayText: string;
}

export interface RecipeAnalysis {
  dishName: string;
  ingredients: string[];
  cookingTime: string;
  tags: string[];
  headlines: Headline[];
  seo: SEOContent;
  viralityScore: ViralityScore;
  imagePrompts: ImagePrompt[];
}

export interface GeneratedPin {
  id: string;
  imageUrl: string;
  overlayText: string;
  angle: string;
  headline: Headline;
}

export type FocusAngle = 'balanced' | 'quick' | 'healthy' | 'family' | 'budget' | 'viral';
