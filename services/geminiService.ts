

import { GoogleGenAI, Type } from "@google/genai";
import { Chord } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY environment variable not set. Gemini features will be disabled.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

export const generateChordProgression = async (key: string, scale: string): Promise<Chord[]> => {
    if(!API_KEY) {
        // Fallback for when API key is not available
        console.log("Using fallback chord progression.");
        return [
            { name: `${key}maj7`, notes: [] },
            { name: `V of ${key}`, notes: [] },
            { name: `vi in ${key}`, notes: [] },
            { name: `IV in ${key}`, notes: [] },
        ];
    }
  
  const prompt = `Generate a 4-chord progression in the key of ${key} ${scale} suitable for a Synthwave or Retrowave track. The chords should be lush and atmospheric. Use common jazz-influenced voicings like maj7, m9, 7sus4, or altered dominants where appropriate. Just provide the chord names.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            progression: {
              type: Type.ARRAY,
              description: "An array of 4 chord names.",
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "The name of the chord (e.g., Cmaj7, G7, Am7)."
                  }
                },
                required: ["name"]
              }
            }
          },
          required: ["progression"]
        }
      }
    });

    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText);

    if (result.progression && Array.isArray(result.progression)) {
      return result.progression.map((c: any) => ({ name: c.name, notes: [] })); // notes will be populated later
    }
    
    return [];

  } catch (error) {
    console.error("Error generating chord progression with Gemini:", error);
    // Return a default progression on error
    return [
      { name: `${key}maj7`, notes: [] },
      { name: 'G7', notes: [] },
      { name: 'Am7', notes: [] },
      { name: 'Fmaj7', notes: [] },
    ];
  }
};
