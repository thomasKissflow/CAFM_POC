// The one tool the Live voice agent calls. Declared by the browser when it connects (see server/ai/voice.ts for why).
import { Type, type FunctionDeclaration } from "@google/genai";

export const CATEGORIES = ["ac_not_cooling", "ac_noise_leak", "water_leak", "electrical", "lift", "plumbing", "fire_life_safety", "civil_finishes", "doors_hardware", "structural_crack"] as const;

/** The agent calls this after every answer; the app fills the job card from it and logs the work order on confirmed=true. */
export const RECORD_REQUEST: FunctionDeclaration = {
  name: "record_request",
  description: "Record everything known so far about the caller's maintenance request. Call after each answer. Set confirmed=true only after the caller agrees to the read-back.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: { type: Type.STRING, enum: [...CATEGORIES], description: "Problem type" },
      symptom: { type: Type.STRING, description: "Short symptom in English, e.g. 'blowing warm air'" },
      room: { type: Type.STRING, description: "Room in English, e.g. 'living room'" },
      since: { type: Type.STRING, description: "When it started, in English" },
      vulnerable_occupant: { type: Type.BOOLEAN, description: "Someone at home struggles with heat (baby, elderly, pregnant, unwell)" },
      safety_hazard: { type: Type.BOOLEAN, description: "Water near electrics, sparks, smoke" },
      access: { type: Type.STRING, description: "When the technician can come in, in English" },
      summary: { type: Type.STRING, description: "One-sentence English summary for the work order" },
      confirmed: { type: Type.BOOLEAN, description: "True only after the caller confirmed the read-back" },
      language: { type: Type.STRING, enum: ["en", "ar"], description: "Language the caller is speaking" }
    },
    required: ["language"]
  }
};

