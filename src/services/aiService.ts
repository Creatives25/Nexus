import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateAIResponse(prompt: string) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction: "You are EduNexus AI, a helpful and encouraging study buddy for students. Provide clear, concise, and accurate explanations. Use markdown for formatting.",
      }
    });
    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("AI Error:", error);
    throw error;
  }
}

export async function generateQuiz(subject: string, topic: string) {
  const prompt = `Generate a 5-question multiple choice quiz about ${topic} in the subject of ${subject}. Return the response in JSON format with the following structure: { "quiz": [ { "question": "...", "options": ["...", "...", "...", "..."], "correctAnswer": "..." } ] }`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      }
    });
    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("AI Quiz Error:", error);
    throw error;
  }
}
