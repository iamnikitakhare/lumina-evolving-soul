
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { PetState, PetStats } from "../types";

const API_KEY = process.env.API_KEY || "";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async generateInitialPet(name: string): Promise<PetState> {
    const prompt = `Create a unique virtual pet soul named "${name}". 
    Describe its personality, core element (e.g., star-dust, digital-nature, neon-echo), 
    and its visual appearance for an image generator. 
    Format as JSON.`;

    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            personality: { type: Type.STRING },
            element: { type: Type.STRING },
            visualDescription: { type: Type.STRING }
          },
          required: ["personality", "element", "visualDescription"]
        }
      }
    });

    const data = JSON.parse(response.text);

    // Generate initial image
    const imageResponse = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `A high-quality 3D render of a cute virtual pet: ${data.visualDescription}. Vibrant colors, cinematic lighting, futuristic 2026 aesthetic, simple background.` }]
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }
      }
    });

    let imageUrl = "https://picsum.photos/512/512";
    for (const part of imageResponse.candidates[0].content.parts) {
      if (part.inlineData) {
        imageUrl = `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    return {
      name,
      personality: data.personality,
      evolutionStage: 1,
      stats: {
        happiness: 60,
        energy: 80,
        hunger: 20,
        intellect: 10
      },
      imageUrl,
      lastUpdate: Date.now()
    };
  }

  async processInteraction(pet: PetState, interaction: string, history: any[]): Promise<{ response: string; updatedStats: PetStats }> {
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: `System Instruction: You are "${pet.name}", a virtual companion with personality: "${pet.personality}". Current stats: Happiness:${pet.stats.happiness}, Energy:${pet.stats.energy}, Hunger:${pet.stats.hunger}, Intellect:${pet.stats.intellect}. Respond to the user's interaction and determine how the stats change (-20 to +20).` },
        ...history.map(h => ({ text: `${h.role}: ${h.content}` })),
        { text: `User: ${interaction}` }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            statChanges: {
              type: Type.OBJECT,
              properties: {
                happiness: { type: Type.NUMBER },
                energy: { type: Type.NUMBER },
                hunger: { type: Type.NUMBER },
                intellect: { type: Type.NUMBER }
              }
            }
          },
          required: ["reply", "statChanges"]
        }
      }
    });

    const data = JSON.parse(response.text);
    const newStats = {
      happiness: Math.min(100, Math.max(0, pet.stats.happiness + data.statChanges.happiness)),
      energy: Math.min(100, Math.max(0, pet.stats.energy + data.statChanges.energy)),
      hunger: Math.min(100, Math.max(0, pet.stats.hunger + data.statChanges.hunger)),
      intellect: Math.min(100, Math.max(0, pet.stats.intellect + data.statChanges.intellect)),
    };

    return { response: data.reply, updatedStats: newStats };
  }

  async seeObject(pet: PetState, imageData: string): Promise<string> {
    const response: GenerateContentResponse = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageData } },
          { text: `You are "${pet.name}". Describe what you see in the camera feed and how it makes you feel according to your personality: ${pet.personality}. Keep it under 2 sentences.` }
        ]
      }
    });
    return response.text || "I see something interesting!";
  }
}
