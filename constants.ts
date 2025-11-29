import { ModelId, ModelProvider, ImageSize, AspectRatio } from './types';

export const PROVIDERS = [
  { id: ModelProvider.GOOGLE, name: 'Google' },
  { id: ModelProvider.AIHUBMIX, name: 'AIHubMix' }
];

export const MODELS = [
  { id: ModelId.NANO_BANANA, name: 'Nano Banana (Flash Image)' },
  { id: ModelId.NANO_BANANA_PRO, name: 'Nano Banana Pro (Pro Image)' }
];

// 分辨率选项
export const IMAGE_SIZES: { id: ImageSize; name: string }[] = [
  { id: '1K', name: '1K (1024×1024)' },
  { id: '2K', name: '2K (2048×2048)' },
  { id: '4K', name: '4K (4096×4096)' }
];

// 根据模型过滤分辨率选项
export const getAvailableImageSizes = (modelId: ModelId): { id: ImageSize; name: string }[] => {
  if (modelId === ModelId.NANO_BANANA) {
    // Nano Banana 只支持 1K
    return IMAGE_SIZES.filter(size => size.id === '1K');
  }
  // Nano Banana Pro 支持 1K, 2K, 4K
  return IMAGE_SIZES;
};

// 宽高比选项
export const ASPECT_RATIOS: { id: AspectRatio; name: string }[] = [
  { id: '1:1', name: '1:1 (正方形)' },
  { id: '3:4', name: '3:4 (竖版)' },
  { id: '4:3', name: '4:3 (横版)' },
  { id: '9:16', name: '9:16 (手机竖屏)' },
  { id: '16:9', name: '16:9 (宽屏)' }
];

// Mapping purely for the GenAI SDK
export const MODEL_MAPPING: Record<ModelId, string> = {
  [ModelId.NANO_BANANA]: 'gemini-2.5-flash-image',
  [ModelId.NANO_BANANA_PRO]: 'gemini-3-pro-image-preview',
};

// 每个模型支持的最大参考图片数
export const MODEL_IMAGE_LIMITS: Record<ModelId, number> = {
  [ModelId.NANO_BANANA]: 5,
  [ModelId.NANO_BANANA_PRO]: 10,
};

// 根据模型获取最大图片数量
export const getMaxImageCount = (modelId: ModelId): number => {
  return MODEL_IMAGE_LIMITS[modelId] || 5;
};
