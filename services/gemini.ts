
import { GoogleGenAI, Type } from "@google/genai";
import { MemeTone } from "../types";

export class MemeGeneratorService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  /**
   * Generates creative text (Title, Slogan, Plot) based on the template and selected tone.
   */
  async generateCreativeText(templateName: string, tone: MemeTone): Promise<{ movieTitle: string; slogan: string; coverText: string }> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-preview',
        contents: `Generate creative movie poster text for a "${tone}" version of the movie template "${templateName}".
        Return JSON with:
        - movieTitle: A ${tone} twist on the original title.
        - slogan: A short, punchy, 1-sentence tagline.
        - coverText: A 2-sentence dramatic plot summary (like the text block on a Die Hard poster).
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              movieTitle: { type: Type.STRING },
              slogan: { type: Type.STRING },
              coverText: { type: Type.STRING }
            }
          }
        }
      });

      const json = JSON.parse(response.text || "{}");
      return {
        movieTitle: json.movieTitle || "EPIC MOVIE",
        slogan: json.slogan || "This time, it is personal.",
        coverText: json.coverText || "In a world where everything went wrong, one hero must stand tall."
      };
    } catch (e) {
      console.error("Text gen failed", e);
      return {
        movieTitle: "EPIC FAIL",
        slogan: "Something went wrong.",
        coverText: "The AI writer is on strike."
      };
    }
  }

  /**
   * Performs the generation logic using template_id and user data.
   */
  async generateMeme(
    userPhotoBase64: string, 
    templateId: string, 
    userName: string, 
    movieTitle: string, 
    costume: string, 
    tagline: string,
    coverText: string,
    tone: string
  ): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: userPhotoBase64.split(',')[1],
                mimeType: 'image/jpeg'
              }
            },
            {
              text: `Professional movie poster editor.
              1. I am providing a template with a specific hole and a user photo.
              2. Insert the user's face onto the character in the poster.
              3. STRICTLY PRESERVE the background (buildings, explosions, texture). Do not regenerate the background.
              4. The character must be wearing ${costume}.
              5. Match the lighting (shadows, contrast, color grade) of the poster exactly.
              6. Overlay "${userName.toUpperCase()}" at the top in white credits font.
              7. Overlay "${movieTitle.toUpperCase()}" at the bottom in yellow cinematic font.
              8. Overlay the slogan "${tagline}" just above the movie title in small, spaced-out white text.
              9. On the LEFT side or TOP-LEFT, overlay this plot text in a small paragraph block: "${coverText}".
              10. Add a "billing block" (credits) at the bottom. Use fake names suitable for a "${tone}" movie.`
            }
          ]
        }
      });

      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }

      throw new Error("The AI model did not return an image. It might have triggered a safety filter.");
    } catch (error) {
      console.error("Meme Generation failed:", error);
      throw error;
    }
  }

  async validatePhoto(photoBase64: string): Promise<{ valid: boolean; message: string }> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            {
              inlineData: {
                data: photoBase64.split(',')[1],
                mimeType: 'image/jpeg'
              }
            },
            {
              text: "Analyze this image to see if it contains a primary subject suitable for a face swap. Ignore people in the background. Is there a clearly visible main face? Answer ONLY 'VALID' if yes. If not, give a 5-word reason."
            }
          ]
        }
      });

      const text = response.text || "";
      if (text.toUpperCase().includes('VALID')) {
        return { valid: true, message: 'Great photo!' };
      }
      return { valid: false, message: text };
    } catch (error) {
      return { valid: true, message: 'Validation skipped' };
    }
  }
}

export const geminiService = new MemeGeneratorService();
