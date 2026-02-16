
export interface PetStats {
  happiness: number;
  energy: number;
  hunger: number;
  intellect: number;
}

export interface PetState {
  name: string;
  personality: string;
  evolutionStage: number;
  stats: PetStats;
  imageUrl: string;
  lastUpdate: number;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export enum GameView {
  WELCOME,
  HATCHING,
  MAIN
}
