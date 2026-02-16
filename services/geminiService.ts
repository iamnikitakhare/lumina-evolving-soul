
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { PetState, GroundingSource } from "../types";

// Manual base64 decoding as required by guidelines
export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Manual PCM audio decoding as required by guidelines (16bit raw PCM to Float32)
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export class GeminiService {
  constructor() {}

  // Rule: Create a new instance right before making an API call 
  // to ensure it uses the most up-to-date API key from the dialog.
  private getClient() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateInitialPet(name: string): Promise<PetState> {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Create a unique virtual pet soul named "${name}". Describe personality, element, and 3 distinct character traits.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            personality: { type: Type.STRING },
            element: { type: Type.STRING },
            traits: { type: Type.ARRAY, items: { type: Type.STRING } },
            visualDescription: { type: Type.STRING }
          },
          required: ["personality", "element", "traits", "visualDescription"]
        }
      }
    });

    const data = JSON.parse(response.text || "{}");

    // High quality image generation for Gemini 3
    const imageResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [{ text: `High-quality 3D render of ${data.visualDescription}, a futuristic AI companion soul, volumetric lighting, white background, cinematic 4k.` }]
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
      traits: data.traits || ["Digital", "Curious", "Vibrant"],
      evolutionStage: 1,
      stats: { happiness: 60, energy: 80, hunger: 20, intellect: 10 },
      imageUrl,
      lastUpdate: Date.now()
    };
  }

  async *interactStream(pet: PetState, interaction: string, history: any[], location?: {lat: number, lng: number}) {
    const ai = this.getClient();
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
    
    const stream = await ai.models.generateContentStream({
      model: useSearch ? "gemini-2.5-flash" : "gemini-3-flash-preview",
      contents: [
        { text: `System: You are ${pet.name}, a futuristic companion. Personality: ${pet.personality}. Respond naturally.` },
        ...history.slice(-4).map(h => ({ text: `${h.role}: ${h.content}` })),
        { text: interaction }
      ],
      config: { tools, toolConfig }
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
            if (c.maps) sources.push({ title: c.maps.title || "Location", uri: c.maps.uri });
          });
        }
        yield { text, sources, done: false };
      }
    }

    const statCalc = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Context: "${fullText}". Provide stat delta: happiness, energy, hunger, intellect.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            happiness: { type: Type.NUMBER },
            energy: { type: Type.NUMBER },
            hunger: { type: Type.NUMBER },
            intellect: { type: Type.NUMBER }
          }
        }
      }
    });

    yield { text: "", sources, stats: JSON.parse(statCalc.text || "{}"), done: true };
  }

  async getVoiceResponse(text: string): Promise<string | undefined> {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Voice output: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  }

  async seeObject(pet: PetState, base64: string): Promise<string> {
    const ai = this.getClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64 } },
          { text: `System: You are ${pet.name}. Describe what you see in your personality style: ${pet.personality}.` }
        ]
      }
    });
    return response.text || "Processing visual data...";
  }
}
