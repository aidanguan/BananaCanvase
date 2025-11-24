import { ModelId, ModelProvider } from './types';

export const PROVIDERS = [
  { id: ModelProvider.GOOGLE, name: 'Google' },
  { id: ModelProvider.AIHUBMIX, name: 'AIHubMix' }
];

export const MODELS = [
  { id: ModelId.NANO_BANANA, name: 'Nano Banana (Flash Image)' },
  { id: ModelId.NANO_BANANA_PRO, name: 'Nano Banana Pro (Pro Image)' }
];

// Mapping purely for the GenAI SDK
export const MODEL_MAPPING: Record<ModelId, string> = {
  [ModelId.NANO_BANANA]: 'gemini-2.5-flash-image',
  [ModelId.NANO_BANANA_PRO]: 'gemini-3-pro-image-preview',
};
