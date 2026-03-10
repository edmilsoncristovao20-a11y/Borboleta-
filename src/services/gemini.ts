import { GoogleGenAI } from "@google/genai";

export async function generateButterflyImage(prompt: string = "A majestic butterfly where the wings are made of realistic white fluffy clouds against a soft blue sky. The body of the butterfly is sleek and metallic. The cloud patterns are intricately part of the wing structure, with some areas showing clear sky and others dense cumulus clouds. High resolution, cinematic lighting, ethereal and premium feel, 8k.") {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY || "" });
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
}

export async function generateAppIcon() {
  const prompt = "High-resolution app icon for 'Borboleta VPN' using a realistic blue Morpho butterfly with glowing neon cyan edges, centered and symmetrical, on a dark, futuristic background with subtle deep blue circuit patterns. Ensure it has high contrast, cinematic lighting, and a premium feel.";
  return generateButterflyImage(prompt);
}
