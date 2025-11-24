import { GoogleGenAI } from "@google/genai";
import { MODEL_MAPPING } from "../constants";
import { AppSettings, ModelId } from "../types";

export const generateImageContent = async (
  prompt: string,
  settings: AppSettings,
  imageBase64?: string
): Promise<string> => {
  
  const apiKey = settings.apiKey || process.env.API_KEY;

  if (!apiKey) {
    throw new Error("API Key is missing. Please configure it in settings.");
  }

  // Configure the client. 
  // Note: We cast to any to support baseUrl injection if the specific SDK version supports it 
  // or if we are using a compatible proxy pattern.
  const clientConfig: any = { apiKey };
  if (settings.baseUrl) {
    // Some SDK versions look for rootUrl, baseUrl, or transport options. 
    // We attempt to set commonly used properties for proxying.
    clientConfig.baseUrl = settings.baseUrl; 
    clientConfig.rootUrl = settings.baseUrl;
  }

  const ai = new GoogleGenAI(clientConfig);
  const actualModelName = MODEL_MAPPING[settings.modelId];

  try {
    const parts: any[] = [];
    
    // Add image first if it exists
    if (imageBase64) {
      // Remove data URL prefix if present for clean base64
      const cleanBase64 = imageBase64.split(',')[1] || imageBase64;
      
      parts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: 'image/png' // Assuming PNG for canvas exports/uploads
        }
      });
    }

    // Add text prompt
    parts.push({
      text: prompt
    });

    const response = await ai.models.generateContent({
      model: actualModelName,
      contents: {
        parts: parts
      }
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