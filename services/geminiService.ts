import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const generateLevelNarrative = async (levelName: string, isVictory: boolean): Promise<string> => {
  try {
    // Fallback if no key is provided to prevent crash
    if (!process.env.API_KEY) {
      return isVictory 
        ? "And thus, light found light, and the world bloomed." 
        : "The darkness is deep, but your light persists.";
    }

    const prompt = isVictory
      ? `Write a very short, poetic, one-sentence phrase about two souls finally meeting and nature blooming from darkness. Tone: Euphoric, magical.`
      : `Write a very short, poetic, one-sentence mysterious phrase about a glowing spirit traversing a dark, dangerous level named "${levelName}". Tone: Melancholic but hopeful.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text?.trim() || "The journey continues...";
  } catch (error) {
    console.error("Gemini generation error:", error);
    return isVictory ? "Together at last." : "Go forth, little light.";
  }
};