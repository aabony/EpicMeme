import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { MemeTone, MemeTemplate } from "../types";
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
    const apiKey = getEnv('API_KEY', 'VITE_GEMINI_API_KEY');
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
    const objectUrl = URL.createObjectURL(file);
    const template = this.localTemplates.find(t => t.id === templateId);
    if (template) {
        if (!template.images) template.images = [];
        template.images.unshift(objectUrl);
        template.coverImage = objectUrl;
    }
    return objectUrl;
  }

  async generateTemplateBackground(templateId: string, prompt: string): Promise<string> {
      try {
          const response = await this.ai.models.generateContent({
              model: 'gemini-3-pro-image-preview', // Higher quality for admin gen
              contents: {
                  parts: [
                      { text: `Movie poster background for ${prompt}. Cinematic, high quality, 8k, vertical aspect ratio. No text.` }
                  ]
              },
              config: {
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
                ]
              }
          });

          let base64Data = '';
          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                base64Data = part.inlineData.data;
                break;
            }
          }

          if (!base64Data) throw new Error("No image generated");

          const res = await fetch(`data:image/png;base64,${base64Data}`);
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);

          const template = this.localTemplates.find(t => t.id === templateId);
          if (template) {
                if (!template.images) template.images = [];
                template.images.unshift(objectUrl);
                template.coverImage = objectUrl;
          }
          
          return objectUrl;

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
    // Robust parsing: split by comma instead of complex regex
    if (base64String.includes(',')) {
        const parts = base64String.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        return { mimeType: mime, data: parts[1] };
    }
    // Assume it's pure data if no comma
    return { mimeType: 'image/jpeg', data: base64String };
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
        // 1. Try direct fetch (works for blob: URLs and CORS-enabled servers)
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        return await this.blobToBase64(blob);
    } catch (e) {
        console.warn(`Direct fetch failed for ${url}, attempting CORS proxy fallback...`, e);
        
        // 2. Fallback: Use a public CORS proxy for demo purposes (fixes "Could not download template")
        // Only works for http/https URLs, not blob:
        if (url.startsWith('http')) {
            try {
                // Using corsproxy.io as a reliable public proxy for demos
                const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
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
        model: 'gemini-3-flash-preview', 
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

  async generateAIImageOnly(
      userPhotoBase64: string,
      templateUrl: string,
      costume: string,
      strategy: GenerationStrategy = 'cinematic',
      logger?: (msg: string) => void
  ): Promise<string> {
      const log = (msg: string) => {
          console.log(`[Gemini] ${msg}`);
          if (logger) logger(msg);
      };

      log(`Strategy: ${strategy}`);
      
      // 1. Optimize Inputs
      log("Preparing inputs...");
      const optimizedUserPhoto = await this.resizeImage(userPhotoBase64, 1024);
      
      let templateBase64 = templateUrl;
      if (templateUrl.startsWith('http') || templateUrl.startsWith('blob')) {
            try {
                templateBase64 = await this.fetchImageAsBase64(templateUrl);
            } catch (e) {
                log(`Failed download: ${(e as Error).message}`);
                throw new Error("Could not download template image.");
            }
      }
      // Low res for analysis is fine and faster
      const optimizedTemplate = await this.resizeImage(templateBase64, 512);

      const userParts = this.getBase64Details(optimizedUserPhoto);
      const templateParts = this.getBase64Details(optimizedTemplate);

      // 2. ANALYZE USER FACE (Identity Lock)
      // We explicitly ask the model to describe the user first, so it has "tokens" for their face in context.
      log("Analyzing ID...");
      let userDescription = "";
      try {
        const userAnalysis = await this.ai.models.generateContent({
             model: 'gemini-2.5-flash',
             contents: { parts: [
                 { inlineData: { data: userParts.data, mimeType: userParts.mimeType }},
                 { text: "Describe this person's face in detail (eye color, hair style/color, facial hair, skin tone, facial structure). Start with 'A person with...'" }
             ]}
          });
        userDescription = userAnalysis.text || "a person";
        // log(`ID: ${userDescription}`);
      } catch (e) {
          userDescription = "the person in the reference image";
      }

      // 3. ANALYZE TEMPLATE (Style Extraction)
      // Strictly forbidden to name actors to prevent hallucination.
      log("Extracting style...");
      let templateDescription = "";
      try {
        const analysisResp = await this.ai.models.generateContent({
             model: 'gemini-2.5-flash',
             contents: { parts: [
                 { inlineData: { data: templateParts.data, mimeType: templateParts.mimeType }},
                 { text: `Describe the VISUAL STYLE and BACKGROUND of this poster.
                   Focus on: Lighting, Color Palette, Camera Angle, Background Elements.
                   
                   CRITICAL: 
                   - DO NOT mention the main character's face.
                   - DO NOT mention the movie title.` 
                 }
             ]}
          });
        templateDescription = analysisResp.text || `A cinematic poster with ${costume}`;
      } catch (e) {
          templateDescription = `A high quality cinematic movie poster. Dramatic lighting.`;
      }

      // 4. GENERATE NEW IMAGE (Double-Blind Synthesis with Fallback)
      // We do NOT pass the template image to the generator. Only the user image and the generic description.
      log("Synthesizing...");
      
      const isParody = strategy === 'parody';

      const prompt = `
        TASK: Create a movie poster featuring the person from the Reference Image.

        1. THE SUBJECT (Reference Image 1):
           - You MUST use the face and likeness of the person in Reference Image 1.
           - User Description: ${userDescription}
           - They are cosplaying as a character wearing: ${costume}
           ${isParody ? '- CRITICAL: DO NOT hide the face. REMOVE sunglasses, masks, visors, or helmets. The face must be clearly visible and expressive.' : ''}
           
        2. THE STYLE:
           - Background/Vibe: ${templateDescription}
        
        INSTRUCTIONS:
        - GENERATE A NEW IMAGE of the person in the Reference Image.
        - Ensure the FACE matches the Reference Image exactly.
        - The lighting should be cinematic and dramatic.
        - ${isParody 
            ? 'STYLE: PARODY / COMEDY. The character should look like they are in a "knock-off" or "bootleg" version of the movie. Make it funny. Use a slightly exaggerated expression if it fits the face.' 
            : 'Style: Epic, serious, and photorealistic (8k resolution).'}
        
        NEGATIVE PROMPT:
        - Do not use the original movie actor's face.
        - Do not generate text/titles.
        ${isParody ? '- No sunglasses. No masks. No face covering. No hiding face.' : ''}
      `;
      
      const parts = [
          { inlineData: { data: userParts.data, mimeType: userParts.mimeType } },
          { text: prompt }
      ];

      // Config for loose safety to allow "Action" content
      const config = {
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
          ]
      };

      // Try High-Quality Model First
      try {
        log("Attempting High-Res Gen...");
        const response = await this.ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: { parts },
            config: config
        });
        
        const img = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (img) return `data:image/png;base64,${img}`;
        
        throw new Error("Empty response from Pro model");
      } catch (e: any) {
          log(`Pro Model Failed (${e.message}). Falling back to Flash...`);
          
          // Fallback to Flash-Image (More permissive, less strict on billing)
          try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: { parts },
                config: config
            });
            const img = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (img) return `data:image/png;base64,${img}`;
          } catch (e2: any) {
             throw new Error(`Generation Failed completely: ${e2.message}`);
          }
          throw new Error("No image returned from backup model");
      }
  }

  // STEP 2: The Fast Text Overlay (Runs on demand)
  async applyTextOverlay(
      baseImageBase64: string,
      userName: string,
      movieTitle: string,
      slogan: string,
      credits: string
  ): Promise<string> {
      return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = 1200;
              canvas.height = 1800;
              const ctx = canvas.getContext('2d');
              if (!ctx) return resolve(baseImageBase64);

              // 1. Draw Background
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

              // 2. Draw Gradient Overlay
              const gradient = ctx.createLinearGradient(0, canvas.height * 0.5, 0, canvas.height);
              gradient.addColorStop(0, "transparent");
              gradient.addColorStop(0.7, "rgba(0,0,0,0.8)");
              gradient.addColorStop(1, "black");
              ctx.fillStyle = gradient;
              ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);

              // 3. Draw Movie Title
              ctx.textAlign = 'center';
              ctx.shadowColor = "rgba(0,0,0,0.8)";
              ctx.shadowBlur = 20;
              let titleSize = 130;
              if (movieTitle.length > 15) titleSize = 100;
              if (movieTitle.length > 25) titleSize = 80;
              
              ctx.font = `900 ${titleSize}px 'Oswald', sans-serif`;
              ctx.fillStyle = '#FFD700';
              ctx.fillText(movieTitle.toUpperCase(), canvas.width / 2, canvas.height - 300);

              // 4. Draw Actor Name
              ctx.font = "bold 60px 'Oswald', sans-serif";
              ctx.fillStyle = "white";
              ctx.fillText(userName.toUpperCase(), canvas.width / 2, 100);

              // 5. Draw Tagline
              ctx.font = "italic 40px 'Inter', sans-serif";
              ctx.fillStyle = "#cccccc";
              ctx.fillText(slogan, canvas.width / 2, canvas.height - 450);

              // 6. Draw Credits
              ctx.font = "20px 'Inter', sans-serif";
              ctx.fillStyle = "#666666";
              ctx.fillText(credits.toUpperCase(), canvas.width / 2, canvas.height - 100);

              resolve(canvas.toDataURL('image/png'));
          };
          img.src = baseImageBase64;
      });
  }

  // Orchestrator
  async generateMeme(
    userPhotoBase64: string, 
    templateId: string, 
    templateUrl: string, 
    userName: string, 
    movieTitle: string, 
    costume: string, 
    tagline: string, 
    coverText: string, 
    tone: string,
    preGeneratedPosterBase64?: string
  ): Promise<string> {
      
      let basePoster = preGeneratedPosterBase64;

      // If no pre-generation, do it now (blocking) with default strategy
      if (!basePoster) {
          basePoster = await this.generateAIImageOnly(userPhotoBase64, templateUrl, costume, 'cinematic');
      }

      const credits = `DIRECTED BY GEMINI   PRODUCED BY ${userName.toUpperCase()}`;
      return await this.applyTextOverlay(
          basePoster, 
          userName, 
          movieTitle, 
          tagline, 
          credits
      );
  }

  async validatePhoto(photoBase64: string): Promise<{ valid: boolean; message: string }> {
     if (photoBase64.length < 1000) return { valid: false, message: "Invalid photo" };
     return { valid: true, message: "OK" };
  }
}

export const geminiService = new MemeGeneratorService();