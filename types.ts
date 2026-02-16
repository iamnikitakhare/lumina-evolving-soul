export interface PetStats {
  happiness: number;
  energy: number;
  hunger: number;
  intellect: number;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface PetState {
  name: string;
  personality: string;
  traits: string[];
  evolutionStage: number;
  stats: PetStats;
  imageUrl: string;
  lastUpdate: number;
  memories?: string[]; // URLs of generated videos
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sources?: GroundingSource[];
}

export enum GameView {
  WELCOME,
  HATCHING,
  MAIN,
  LIVING // Live API mode
}