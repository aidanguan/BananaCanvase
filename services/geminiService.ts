import { GoogleGenAI } from "@google/genai";
import { MODEL_MAPPING } from "../constants";
import { AppSettings, ModelId, ModelProvider } from "../types";

// 优化用户描述的函数
export const enhancePrompt = async (
  userPrompt: string,
  settings: AppSettings
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

  // Configure the client
  const options: any = {
    apiKey,
    ...(baseUrl && { httpOptions: { baseUrl } })
  };

  const ai = new GoogleGenAI(options);
  
  // 使用文本模型 gemini-3-pro-preview (通过AIHubMix) 或 gemini-2.5-flash
  let modelName: string;
  if (settings.provider === ModelProvider.AIHUBMIX) {
    modelName = 'gemini-3-pro-preview'; // AIHubMix的文本模型
  } else {
    modelName = 'gemini-2.5-flash'; // Google的文本模型
  }

  try {
    const systemPrompt = `你是一个专业的AI图像生成提示词优化助手。用户会给你一段描述,你需要将其优化成更适合AI图像生成的提示词。

优化规则:
1. 保持用户原意,但让描述更加具体、生动、详细
2. 添加合适的视觉细节(如光影、色彩、材质、构图等)
3. 使用专业的摄影和艺术术语
4. 保持简洁,避免冗长
5. 使用与用户输入相同的语言输出(如果用户用中文描述就用中文优化,用英文描述就用英文优化)

直接输出优化后的提示词,不要添加任何解释或额外内容。`;

    const userMessage = `请优化这段描述:
${userPrompt}`;

    const contents = settings.provider === ModelProvider.AIHUBMIX
      ? [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMessage }] }]
      : { parts: [{ text: systemPrompt + '\n\n' + userMessage }] };

    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents
    });

    if (response.candidates && response.candidates.length > 0) {
      const candidate = response.candidates[0];
      const contentParts = candidate.content.parts;

      if (contentParts && contentParts[0] && contentParts[0].text) {
        return contentParts[0].text.trim();
      }
    }

    throw new Error("No text response generated.");
  } catch (error: any) {
    console.error("Prompt Enhancement Error:", error);
    if (error.status === 403 || (error.message && error.message.includes('403'))) {
      throw new Error("Permission Denied (403). Please select a valid API Key in Config.");
    }
    throw new Error(error.message || "Failed to enhance prompt.");
  }
};

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