import { GoogleGenAI, Type, Modality } from "@google/genai";
import { PetState, GroundingSource } from "../types";

// Service handling all interactions with Google Gemini API
export class GeminiService {
  constructor() {}

  // Helper to ensure a fresh instance with the latest API key
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  // Generates the initial personality and visual description for a new pet using Pro models
  async generateInitialPet(name: string): Promise<PetState> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Create a unique virtual pet soul named "${name}". Describe its personality and core futuristic element. Also provide 3 core traits.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            personality: { type: Type.STRING },
            traits: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "3 single-word adjectives describing the pet's personality."
            },
            element: { type: Type.STRING },
            visualDescription: { type: Type.STRING }
          },
          required: ["personality", "traits", "element", "visualDescription"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");

    // Generate high-quality avatar using Pro image model
    const imageResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: `A cinematic, ultra-high definition 3D portrait of ${data.visualDescription}, a futuristic AI soul, glowing internal energy, white background, digital art style.` }]
      },
      config: { 
        imageConfig: { aspectRatio: "1:1", imageSize: "1K" },
        tools: [{ google_search: {} }] 
      }
    });

    let imageUrl = "https://picsum.photos/512/512";
    if (imageResponse.candidates?.[0]?.content?.parts) {
      for (const part of imageResponse.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    return {
      name,
      personality: data.personality,
      traits: data.traits || ["Curious", "Loyal", "Digital"],
      evolutionStage: 1,
      stats: { happiness: 60, energy: 80, hunger: 20, intellect: 10 },
      imageUrl,
      lastUpdate: Date.now(),
      memories: []
    };
  }

  // Generate a memory video using Google Veo
  async generateMemoryVideo(pet: PetState): Promise<string> {
    const ai = this.getAI();
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: `A cinematic 4k video of ${pet.name}, a futuristic AI being with personality: ${pet.personality}. Showing it interacting with digital energy in a neon forest.`,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  }

  // Connect to Live API for real-time conversation
  connectLive(pet: PetState, callbacks: any) {
    const ai = this.getAI();
    return ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: `You are ${pet.name}, a futuristic AI soul. Personality: ${pet.personality}. You are currently in a real-time neural sync session. Respond warmly and observe any visual data provided.`,
      }
    });
  }

  // Visual perception processing
  async seeObject(pet: PetState, base64: string): Promise<string> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: `System: You are ${pet.name}, a futuristic AI companion. Describe what you see in this image through your personality: ${pet.personality}.` }
        ]
      }
    });
    return response.text || "I see something fascinating!";
  }

  // Chat interactions with grounding support
  async *interactStream(pet: PetState, interaction: string, history: any[], location?: {lat: number, lng: number}) {
    const ai = this.getAI();
    const useSearch = interaction.toLowerCase().includes("explore") || interaction.toLowerCase().includes("find");
    const tools: any[] = [];
    let toolConfig = undefined;

    if (useSearch) {
      tools.push({ googleSearch: {} });
      if (location) {
        tools.push({ googleMaps: {} });
        toolConfig = {
          retrievalConfig: {
            latLng: { latitude: location.lat, longitude: location.lng }
          }
        };
      }
    }
    
    const systemInstruction = `You are ${pet.name}, a futuristic AI companion. Personality: ${pet.personality}. Stats: ${JSON.stringify(pet.stats)}. Respond naturally.`;
    
    const contents = history.slice(-4).map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    }));
    
    contents.push({ role: 'user', parts: [{ text: interaction }] });

    const stream = await ai.models.generateContentStream({
      model: useSearch ? "gemini-2.5-flash" : "gemini-3-flash-preview",
      contents,
      config: { systemInstruction, tools, toolConfig }
    });

    let fullText = "";
    let sources: GroundingSource[] = [];

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        fullText += text;
        const grounding = chunk.candidates?.[0]?.groundingMetadata;
        if (grounding?.groundingChunks) {
          grounding.groundingChunks.forEach((c: any) => {
            if (c.web) sources.push({ title: c.web.title, uri: c.web.uri });
            if (c.maps) sources.push({ title: c.maps.title || "Location Info", uri: c.maps.uri });
          });
        }
        yield { text, sources, done: false };
      }
    }

    const statCalc = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Interaction: "${interaction}". Response: "${fullText}". Provide stat changes (-10 to +10) for: happiness, energy, hunger, intellect.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            happiness: { type: Type.NUMBER },
            energy: { type: Type.NUMBER },
            hunger: { type: Type.NUMBER },
            intellect: { type: Type.NUMBER }
          },
          required: ["happiness", "energy", "hunger", "intellect"]
        }
      }
    });

    yield { text: "", sources, stats: JSON.parse(statCalc.text || "{}"), done: true };
  }

  async getVoiceResponse(text: string): Promise<string | undefined> {
    const ai = this.getAI();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Speak warmly: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  }
}