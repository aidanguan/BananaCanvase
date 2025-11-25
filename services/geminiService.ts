import { GoogleGenAI } from "@google/genai";
import { MODEL_MAPPING } from "../constants";
import { AppSettings, ModelId, ModelProvider } from "../types";

export const generateImageContent = async (
  prompt: string,
  settings: AppSettings,
  imageInput?: string | string[]
): Promise<string> => {

  // Determine API Key and Base URL based on provider
  let apiKey: string;
  let baseUrl: string | undefined;

  if (settings.provider === ModelProvider.AIHUBMIX) {
    apiKey = (import.meta as any).env.VITE_AIHUBMIX_API_KEY || '';
    baseUrl = (import.meta as any).env.VITE_AIHUBMIX_BASE_URL || 'https://aihubmix.com/gemini';
  } else {
    apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
    baseUrl = (import.meta as any).env.VITE_GEMINI_BASE_URL;
  }

  if (!apiKey) {
    throw new Error(`API Key for ${settings.provider} is missing. Please configure it in .env file.`);
  }

  // Configure the client with httpOptions
  const options: any = {
    apiKey,
    ...(baseUrl && { httpOptions: { baseUrl } })
  };

  const ai = new GoogleGenAI(options);
  const actualModelName = MODEL_MAPPING[settings.modelId];

  try {
    const parts: any[] = [];

    // Handle image input (single string or array of strings)
    if (imageInput) {
      const images = Array.isArray(imageInput) ? imageInput : [imageInput];

      images.forEach(img => {
        // Remove data URL prefix if present for clean base64
        const cleanBase64 = img.split(',')[1] || img;

        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: 'image/png'
          }
        });
      });
    }

    // Add text prompt
    parts.push({
      text: prompt
    });

    // Prepare generation config
    const generationConfig: any = {};

    // AIHubMix specific config for image generation
    if (settings.provider === ModelProvider.AIHUBMIX) {
      generationConfig.responseModalities = ['TEXT', 'IMAGE'];
      generationConfig.imageConfig = {
        aspectRatio: settings.aspectRatio,
        imageSize: settings.imageSize
      };
    }

    // Build contents with role for AIHubMix compatibility
    const contents = settings.provider === ModelProvider.AIHUBMIX 
      ? [{ role: 'user', parts: parts }]
      : { parts: parts };

    const response = await ai.models.generateContent({
      model: actualModelName,
      contents: contents,
      config: Object.keys(generationConfig).length > 0 ? generationConfig : undefined
    });

    // Parse response for image
    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      const contentParts = candidate.content.parts;

      for (const part of contentParts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }

      // Fallback if no inline image found but maybe a text description of failure
      if (contentParts[0].text) {
        // Some models might return text explaining why it failed or refused
        // If the user asked for JSON, we might parse it, but here we expect image.
        throw new Error(`Model returned text instead of image: ${contentParts[0].text}`);
      }
    }

    throw new Error("No image generated.");
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    // Explicitly check for 403 to help UI
    if (error.status === 403 || (error.message && error.message.includes('403'))) {
      throw new Error("Permission Denied (403). Please select a valid API Key in Config.");
    }
    throw new Error(error.message || "Failed to generate image.");
  }
};