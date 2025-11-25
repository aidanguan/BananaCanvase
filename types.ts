
export enum ModelProvider {
  GOOGLE = 'Google',
  AIHUBMIX = 'AIHubMix'
}

export enum ModelId {
  NANO_BANANA = 'nano-banana',
  NANO_BANANA_PRO = 'nano-banana-pro'
}

export interface CanvasImage {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface Point {
  x: number;
  y: number;
  pressure: number;
}

export interface DrawPath {
  id: string;
  points: Point[];
  color: string;
  width: number;
  prompt?: string;
}

export type ImageSize = '1K' | '2K' | '4K';
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface AppSettings {
  provider: ModelProvider;
  modelId: ModelId;
  imageSize: ImageSize;
  aspectRatio: AspectRatio;
}

export interface GeneratedImageResult {
  imageUrl: string;
  prompt: string;
}

declare global {
  interface AIStudio {
    openSelectKey: () => Promise<void>;
    hasSelectedApiKey: () => Promise<boolean>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
