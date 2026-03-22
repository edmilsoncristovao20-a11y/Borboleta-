import { GoogleGenAI } from "@google/genai";

export async function generateButterflyImage(prompt: string = "Ultra-high resolution, 8k, cinematic masterpiece. A majestic Morpho butterfly with translucent wings that shimmer with iridescent cyan and deep indigo. The wing veins are glowing with soft neon light. The butterfly is perched on a futuristic, dark crystalline structure. Soft bokeh background with floating light particles. Ethereal, premium, and futuristic aesthetic.") {
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
    throw new Error("No image data found in response");
  } catch (error: any) {
    console.error("Error generating image:", error);
    throw error;
  }
}

export async function generateAppIcon() {
  const prompt = "High-resolution app icon for 'Borboleta VPN' using a realistic blue Morpho butterfly with glowing neon cyan edges, centered and symmetrical, on a dark, futuristic background with subtle deep blue circuit patterns. Ensure it has high contrast, cinematic lighting, and a premium feel.";
  return generateButterflyImage(prompt);
}
