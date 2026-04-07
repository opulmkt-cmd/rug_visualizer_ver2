import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateRugImage = async (prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `A high-quality, professional rug design. Style: ${prompt}. The image should be a top-down view of a rectangular rug on a neutral floor. No people, no furniture, just the rug.`,
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

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        const base64EncodeString: string = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }
    throw new Error("No image generated");
  } catch (error) {
    console.error("Error generating rug image:", error);
    throw error;
  }
};

export const analyzeComplexity = async (prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the complexity of this rug design prompt: "${prompt}". 
      Return a JSON object with:
      - complexity: "Simple", "Medium", or "High"
      - reasoning: A short explanation.
      - rejected: boolean (true if it violates safety or is too vague)
      - rejectionReason: string (if rejected)`,
      config: {
        responseMimeType: "application/json",
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Error analyzing complexity:", error);
    return { complexity: "Medium", reasoning: "Default complexity due to error.", rejected: false };
  }
};
