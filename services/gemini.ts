
import { GoogleGenAI, Type } from "@google/genai";
import { MemeTone } from "../types";
import { TONE_PROMPTS } from "../data/tonePrompts";
import { TEMPLATES } from "../data/templates";

export class MemeGeneratorService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  /**
   * Helper to clean JSON string from Markdown code blocks and extra text
   */
  private cleanJson(text: string): string {
    if (!text) return "{}";
    // 1. Remove markdown wrapping
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '');
    
    // 2. Extract the JSON object boundaries
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    
    if (firstBrace !== -1 && lastBrace !== -1) {
      cleaned = cleaned.substring(firstBrace, lastBrace + 1);
    }
    
    return cleaned.trim();
  }

  /**
   * Helper to fetch an image URL and convert to Base64 string (without data: prefix)
   */
  private async urlToBase64(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch image: ${url}`);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      // Convert ArrayBuffer to Base64
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    } catch (e) {
      console.warn(`Could not load template image (${url}). Using fallback placeholder.`, e);
      // Return a Placeholder image (black background with text) so the AI still has a 'poster' base
      // This prevents the AI from using the user photo as the base canvas.
      // Base64 for a simple placeholder image
      return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="; // 1x1 fallback is too risky, but keeping simple for code size.
      // Ideally, in a real app, we fetch a real placeholder URL here if the local asset fails.
    }
  }

  /**
   * Generates creative text (Title, Slogan, Plot) based on the template and selected tone.
   */
  async generateCreativeText(templateName: string, tone: MemeTone): Promise<{ movieTitle: string; slogan: string; coverText: string }> {
    try {
      const styleGuide = TONE_PROMPTS[tone] || TONE_PROMPTS['Funny'];

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `You are a Hollywood marketing genius.
        
        TASK: Write movie poster copy for a movie based on the template: "${templateName}".
        TONE: ${tone}
        
        STYLE GUIDE:
        ${styleGuide}

        Return strictly valid JSON.
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

      const jsonStr = this.cleanJson(response.text || "{}");
      const json = JSON.parse(jsonStr);

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
      // 1. Find the template
      const template = TEMPLATES.find(t => t.id === templateId);
      if (!template) throw new Error("Template not found");

      // 2. Load the template image
      let templateBase64 = await this.urlToBase64(template.coverImage);
      
      // If the template load failed (1x1 pixel), try to fetch a placeholder from placehold.co to ensure we have a CANVAS
      if (templateBase64.length < 100) {
         templateBase64 = await this.urlToBase64(`https://placehold.co/600x900/000000/FFF?text=${encodeURIComponent(template.title)}`);
      }

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            // IMAGE 1: THE CANVAS (Template)
            {
              inlineData: {
                data: templateBase64,
                mimeType: 'image/jpeg'
              }
            },
            // IMAGE 2: THE ASSET (User Face)
            {
              inlineData: {
                data: userPhotoBase64.split(',')[1],
                mimeType: 'image/jpeg'
              }
            },
            // PROMPT
            {
              text: `ROLE: Expert Movie Poster Compositor.

              INPUTS:
              - IMAGE 1 (First Image): The "MASTER CANVAS". This is the movie poster. You MUST preserve its background, layout, and body.
              - IMAGE 2 (Second Image): The "SOURCE FACE". This is the user.

              TASK:
              Perform a seamless Face Swap.
              1. Extract ONLY the face/head from IMAGE 2.
              2. Paste the face from IMAGE 2 onto the main character's body in IMAGE 1.
              3. Match the skin tone, lighting, and film grain of the face to IMAGE 1.
              4. The character should appear to be wearing: ${costume}.

              CRITICAL RULES (DO NOT IGNORE):
              - **NEVER** use the background from IMAGE 2 (the user's room, walls, lights). 
              - The final background **MUST** be the background from IMAGE 1 (the movie poster).
              - If the output looks like a selfie in a room, you have FAILED.
              
              TEXT OVERLAYS:
              Add this text in cinematic fonts matching the poster style:
              - TOP: "${userName.toUpperCase()}" (Credits style)
              - BOTTOM TITLE: "${movieTitle.toUpperCase()}" (Huge, impactful)
              - TAGLINE: "${tagline}" (Small, above title)
              - PLOT: "${coverText}" (Small text block)
              - CREDITS: "Directed by AI • Music by GEMINI • A ${tone.toUpperCase()} Production" (Bottom edge)`
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

      throw new Error("No image generated.");
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
              text: "Is there a clearly visible single face in this photo? Reply 'VALID' if yes. If not, reply with a short reason why not."
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
