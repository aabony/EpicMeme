import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold, PersonGeneration } from "@google/genai";
import { MemeTone, MemeTemplate, PosterBlueprint } from "../types";
import { TONE_PROMPTS } from "../data/tonePrompts";
import { TEMPLATES as FALLBACK_TEMPLATES } from "../data/templates";

const getEnv = (key: string, viteKey: string): string => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[viteKey] || '';
    }
  } catch (e) {}
  
  try {
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || '';
    }
  } catch (e) {}
  
  return '';
};

export type GenerationStrategy = 'cinematic' | 'parody';

export class MemeGeneratorService {
  private ai: GoogleGenAI;
  public apiEndpoint: string;
  public baseUrl: string;
  private localTemplates: MemeTemplate[];

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || getEnv('API_KEY', 'VITE_GEMINI_API_KEY');
    this.ai = new GoogleGenAI({ apiKey });
    this.baseUrl = getEnv('REACT_APP_API_URL', 'VITE_API_URL') || 'http://localhost:8080';
    this.apiEndpoint = `${this.baseUrl}/generate-meme`;
    this.localTemplates = JSON.parse(JSON.stringify(FALLBACK_TEMPLATES));
  }

  // --- HEALTH CHECK ---
  async checkHealth(): Promise<boolean> {
     return true; 
  }

  // --- TEMPLATES ---
  async fetchTemplates(): Promise<MemeTemplate[]> {
    return this.localTemplates;
  }

  async uploadTemplateImage(templateId: string, file: File): Promise<string> {
    const base64Url = await this.blobToBase64(file);
    const template = this.localTemplates.find(t => t.id === templateId);
    if (template) {
        template.coverUrl = base64Url;
    }
    return base64Url;
  }

  async generateTemplateBackground(templateId: string, prompt: string): Promise<string> {
      try {
          // Use Gemini 2.5 Flash Image for high quality background generation
          const response = await this.ai.models.generateContent({
              model: 'gemini-2.5-flash-image', 
              contents: {
                parts: [{ text: `Movie poster background for ${prompt}. Cinematic, high quality, 8k, vertical aspect ratio. No text.` }]
              },
              config: {
                imageConfig: {
                  aspectRatio: '3:4',
                }
              }
          });

          const base64Data = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;

          if (!base64Data) throw new Error("No image generated");

          const dataUrl = `data:image/png;base64,${base64Data}`;

          const template = this.localTemplates.find(t => t.id === templateId);
          if (template) {
                template.coverUrl = dataUrl;
          }
          
          return dataUrl;

      } catch (clientError) {
          console.error("Client-side generation failed:", clientError);
          throw clientError;
      }
  }

  // --- UTILS ---

  async draftPosterPrompt(movieTitle: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Write a text-to-image prompt for a movie poster titled "${movieTitle}". 
        Describe the costume, lighting, and setting in 20 words. 
        Start with: "A cinematic movie poster of..."`,
      });
      return response.text?.trim() || `A cinematic movie poster inspired by ${movieTitle}, high quality, 8k.`;
    } catch (e) {
      return `A cinematic movie poster inspired by ${movieTitle}, high quality, 8k.`;
    }
  }

  private cleanJson(text: string): string {
    if (!text) return "{}";
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return match[0];
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
  }

  private getBase64Details(base64String: string): { data: string, mimeType: string } {
    if (base64String.includes(',')) {
        const parts = base64String.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        return { mimeType: mime, data: parts[1] };
    }
    return { mimeType: 'image/jpeg', data: base64String };
  }

  /**
   * Helper to strip the "data:image/jpeg;base64," prefix if present
   */
  private cleanBase64(base64String: string): string {
    return base64String.includes(',') ? base64String.split(',')[1] : base64String;
  }

  /**
   * STEP 1: The Blueprint
   * Uses Gemini Pro to analyze both images and generate the text and Image prompt.
   */
  async generatePosterBlueprint(
    templateBase64: string, 
    userSelfieBase64: string, 
    userName: string, 
    tone: string
  ): Promise<PosterBlueprint> {
    try {
      console.log("Generating Blueprint with Gemini Pro...");
      
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-pro-preview', // Use the most capable Pro model available
        contents: {
          parts: [
            {
              inlineData: {
                data: this.cleanBase64(templateBase64),
                mimeType: 'image/jpeg'
              }
            },
            {
              inlineData: {
                data: this.cleanBase64(userSelfieBase64),
                mimeType: 'image/jpeg'
              }
            },
            {
              text: `
              Image 1 is a reference movie poster. Image 2 is a user named ${userName}. 
              Write a blueprint for a parody movie poster. Tone: ${tone}. 
              
              Task 1: Write a spoof Title mocking the original movie.
              Task 2: Write a hilarious Tagline.
              Task 3: Write a full "billing block" of production credits. Include fake studios, producers, and directors, but make them funny and related to the user ${userName} or the movie theme. Format it as a single long string, like: "PARAMOUNT PICTURES PRESENTS A HOWARD W. KOCH PRODUCTION... STARRING ${userName.toUpperCase()}..."
              Task 4: Write a highly detailed image generation prompt. The prompt MUST describe a new, original image that perfectly mimics the exact lighting, background, and cinematic style of Image 1, but features a caricature of the person in Image 2 as the main character. The prompt MUST explicitly instruct the image generator to leave a solid color margin at the bottom of the poster to act as a background for the billing block credits. Do NOT include instructions to render text in this prompt. We will add the text later.
              `
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              tagline: { type: Type.STRING },
              credits: { type: Type.STRING },
              visual_prompt: { type: Type.STRING }
            },
            required: ["title", "tagline", "credits", "visual_prompt"]
          }
        }
      });

      const jsonStr = this.cleanJson(response.text || "{}");
      const blueprint = JSON.parse(jsonStr) as PosterBlueprint;
      
      console.log("Blueprint Generated:", blueprint);
      return blueprint;

    } catch (error) {
      console.error("Failed to generate blueprint:", error);
      throw new Error("Blueprint generation failed.");
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private async fetchImageAsBase64(url: string): Promise<string> {
    try {
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        return await this.blobToBase64(blob);
    } catch (e) {
        console.warn(`Direct fetch failed for ${url}, attempting CORS proxy fallback...`, e);
        if (url.startsWith('http')) {
            try {
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl, { mode: 'cors' });
                if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);
                const blob = await response.blob();
                return await this.blobToBase64(blob);
            } catch (proxyError) {
                console.error("Proxy fetch failed:", proxyError);
                throw new Error("Could not download template image (CORS blocked).");
            }
        }
        throw e;
    }
  }

  private async resizeImage(base64Str: string, maxDimension: number = 1024): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
            if (width > maxDimension) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
            }
        } else {
            if (height > maxDimension) {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
            }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(base64Str);
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        resolve(canvas.toDataURL('image/jpeg', 0.85)); 
      };
      
      img.onerror = () => {
          console.warn("Image resize failed, using original");
          resolve(base64Str);
      };
      
      img.setAttribute('crossOrigin', 'anonymous'); 
      img.src = base64Str;
    });
  }

  async generateCreativeText(templateName: string, tone: MemeTone): Promise<{ movieTitle: string; slogan: string; coverText: string }> {
    try {
      const styleGuide = TONE_PROMPTS[tone] || TONE_PROMPTS['Funny'];
      const response = await this.ai.models.generateContent({
        model: 'gemini-3.1-pro-preview', 
        contents: `You are a Hollywood marketing genius.
        TASK: Write movie poster copy for a movie based on the template: "${templateName}".
        TONE: ${tone}
        STYLE GUIDE: ${styleGuide}
        INSTRUCTIONS:
        1. Keep 'coverText' under 15 words. Short and punchy.
        2. Return strictly valid JSON.`,
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
      const json = JSON.parse(this.cleanJson(response.text || "{}"));
      return {
        movieTitle: json.movieTitle || templateName.toUpperCase(),
        slogan: json.slogan || "COMING SOON",
        coverText: json.coverText || "Get ready for the cinematic event of the year."
      };
    } catch (e) {
      return {
        movieTitle: templateName.toUpperCase(),
        slogan: "A CINEMATIC MASTERPIECE",
        coverText: "In a world where anything can happen, one hero rises."
      };
    }
  }

  // --- CORE PIPELINE ---

  async urlToBase64(url: string): Promise<string> {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          resolve(base64data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Failed to convert URL to Base64:", error);
      throw new Error("Could not process template image.");
    }
  }

  async prepareBlueprint(
    userPhotoBase64: string,
    templateUrl: string,
    userName: string,
    tone: MemeTone,
    onProgress?: (step: string) => void
  ): Promise<PosterBlueprint> {
    const log = (msg: string) => {
      console.log(`[Gemini Pipeline] ${msg}`);
      if (onProgress) onProgress(msg);
    };

    // 1. PREPARE INPUTS
    log("Analyzing Face...");
    const optimizedUserPhoto = await this.resizeImage(userPhotoBase64, 1024);
    
    let templateBase64 = templateUrl;
    if (templateUrl.startsWith('http') || templateUrl.startsWith('blob')) {
      try {
        templateBase64 = await this.urlToBase64(templateUrl);
      } catch (e) {
        throw new Error("Could not download template image.");
      }
    }
    const optimizedTemplate = await this.resizeImage(templateBase64, 1024);

    // 2. STEP 1: THE BLUEPRINT
    log("Writing Script...");
    const blueprint = await this.generatePosterBlueprint(
      optimizedTemplate,
      optimizedUserPhoto,
      userName,
      tone
    );

    return blueprint;
  }

  async executePosterBlueprint(
    blueprint: PosterBlueprint,
    onProgress?: (step: string) => void
  ): Promise<string> {
    const log = (msg: string) => {
      console.log(`[Gemini Pipeline] ${msg}`);
      if (onProgress) onProgress(msg);
    };

    log("Painting Poster...");
    
    const finalPrompt = `${blueprint.visual_prompt}\n\nCRITICAL INSTRUCTION: You MUST render the following text on the image in cinematic typography. \nTitle: "${blueprint.title}" (Make this the LARGEST and most prominent text on the poster, centered, taking up significant space).\nTagline: "${blueprint.tagline}" (Place this above or below the title).\nCredits: "${blueprint.credits}" (Create a solid color rectangular margin at the very bottom of the poster. Inside this margin, place the credits as a block of text that spans the entire width from left to right, resembling a classic movie poster billing block. Use a small, condensed, tall font).`;

    const executionResponse = await this.ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: finalPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: '3:4',
        outputMimeType: 'image/jpeg',
        personGeneration: PersonGeneration.ALLOW_ALL
      }
    });

    const finalImageBase64 = executionResponse.generatedImages?.[0]?.image?.imageBytes;
    
    if (!finalImageBase64) {
      throw new Error("Imagen 4 failed to return image bytes.");
    }

    return `data:image/jpeg;base64,${finalImageBase64}`;
  }

  async regenerateText(
    type: 'title' | 'tagline' | 'credits',
    templateTitle: string,
    userName: string,
    tone: MemeTone,
    currentTitle?: string
  ): Promise<string> {
    const prompt = `You are a Hollywood marketing genius.
    TASK: Write a new, hilarious ${type} for a spoof movie poster based on "${templateTitle}" starring ${userName}.
    TONE: ${tone}.
    ${type === 'tagline' && currentTitle ? `The movie title is "${currentTitle}".` : ''}
    ${type === 'credits' ? `Write a full "billing block" of production credits. Include fake studios, producers, and directors, but make them funny and related to the user ${userName} or the movie theme. Format it as a single long string, like: "PARAMOUNT PICTURES PRESENTS A HOWARD W. KOCH PRODUCTION... STARRING ${userName.toUpperCase()}..."` : ''}
    
    Return ONLY the generated text, nothing else. Do not include quotes around the text unless they are part of the tagline.`;

    const response = await this.ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
    });

    let text = response.text?.trim() || '';
    if (text.startsWith('"') && text.endsWith('"')) {
        text = text.substring(1, text.length - 1);
    }
    return text;
  }

  async validatePhoto(photoBase64: string): Promise<{ valid: boolean; message: string }> {
     if (photoBase64.length < 1000) return { valid: false, message: "Invalid photo" };
     return { valid: true, message: "OK" };
  }
}

export const geminiService = new MemeGeneratorService();