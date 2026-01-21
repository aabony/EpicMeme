
import os
import io
import json
import uuid
import base64
import random
import requests
import traceback
import shutil
from typing import Optional, List, Dict
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from google.cloud import storage, vision
import vertexai
from vertexai.preview.vision_models import Image, ImageGenerationModel
from PIL import Image as PILImage, ImageDraw, ImageFont, ImageOps, ImageFilter

# Config
BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "epicmeme-storage")
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = "us-central1"
TEMPLATES_FILE = "templates.json"
UPLOAD_DIR = "uploads"

# Ensure local directories exist
os.makedirs(os.path.join(UPLOAD_DIR, "templates"), exist_ok=True)
os.makedirs(os.path.join(UPLOAD_DIR, "generated"), exist_ok=True)

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve local uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Clients
storage_client = None
vision_client = None

def init_clients():
    global storage_client, vision_client
    try:
        # Check Project ID first to avoid hard crash inside library
        if not PROJECT_ID:
            print("WARNING: GOOGLE_CLOUD_PROJECT environment variable not set. Vertex AI will fail.")
        
        # Try to init storage, but don't crash app if it fails
        try:
            storage_client = storage.Client()
            print("Storage Client initialized.")
        except Exception as e:
            print(f"Storage Client failed (using local fallback): {e}")

        try:
            vision_client = vision.ImageAnnotatorClient()
            print("Vision Client initialized.")
        except Exception as e:
             print(f"Vision Client failed: {e}")
        
        if PROJECT_ID:
            try:
                vertexai.init(project=PROJECT_ID, location=LOCATION)
                print("Vertex AI initialized.")
            except Exception as e:
                 print(f"Vertex AI failed: {e}")
        
    except Exception as e:
        print(f"WARNING: Google Cloud clients failed to initialize: {e}")

init_clients()

# --- TEMPLATE DATABASE MANAGEMENT ---

INITIAL_TEMPLATES = [
  {
    "id": 'terminator',
    "title": 'The Terminator',
    "category": 'Sci-Fi',
    "coverImage": 'https://image.tmdb.org/t/p/original/qvktm0BHcnmDpul4Hz01GIazWPr.jpg',
    "images": ['https://image.tmdb.org/t/p/original/qvktm0BHcnmDpul4Hz01GIazWPr.jpg'],
    "movieTitle": 'THE TERMINATOR',
    "costume": 'a leather jacket, sunglasses, and a robotic eye'
  },
  {
    "id": 'good_bad_ugly',
    "title": 'The Good, The Bad & The Ugly',
    "category": 'Action',
    "coverImage": 'https://image.tmdb.org/t/p/original/bX2xnavhMYjWDoZp1VM6VnU1xwe.jpg',
    "images": ['https://image.tmdb.org/t/p/original/bX2xnavhMYjWDoZp1VM6VnU1xwe.jpg'],
    "movieTitle": 'THE GOOD, THE BAD & THE UGLY',
    "costume": 'a cowboy hat, dusty poncho, and cigarillo'
  },
  {
    "id": 'cool_runnings',
    "title": 'Cool Runnings',
    "category": 'Comedy',
    "coverImage": 'https://image.tmdb.org/t/p/original/qN6H0LgqX7Xb4.jpg',
    "images": ['https://image.tmdb.org/t/p/original/qN6H0LgqX7Xb4.jpg'],
    "movieTitle": 'COOL RUNNINGS',
    "costume": 'a Jamaican bobsled team uniform or colorful spandex suit'
  },
  {
    "id": 'matrix',
    "title": 'The Matrix',
    "category": 'Sci-Fi',
    "coverImage": 'https://image.tmdb.org/t/p/original/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
    "images": ['https://image.tmdb.org/t/p/original/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg'],
    "movieTitle": 'THE MATRIX',
    "costume": 'a long black leather trench coat and dark sunglasses'
  },
  {
    "id": 'superman',
    "title": 'Superman',
    "category": 'Action',
    "coverImage": 'https://image.tmdb.org/t/p/original/d7px1FQxZB4lsVBSWF4.jpg',
    "images": ['https://image.tmdb.org/t/p/original/d7px1FQxZB4lsVBSWF4.jpg'],
    "movieTitle": 'SUPERMAN',
    "costume": 'a blue superhero suit with a red cape and S shield'
  },
  {
    "id": 'spiderman',
    "title": 'Spider-Man',
    "category": 'Action',
    "coverImage": 'https://image.tmdb.org/t/p/original/gh4cZbhZxyTbgx.jpg',
    "images": ['https://image.tmdb.org/t/p/original/gh4cZbhZxyTbgx.jpg'],
    "movieTitle": 'SPIDER-MAN',
    "costume": 'a red and blue spider superhero suit'
  },
  {
    "id": 'airplane',
    "title": 'Airplane!',
    "category": 'Comedy',
    "coverImage": 'https://image.tmdb.org/t/p/original/z4x0Kn.jpg', 
    "images": ['https://image.tmdb.org/t/p/original/z4x0Kn.jpg'],
    "movieTitle": 'AIRPLANE!',
    "costume": 'a retro airline pilot uniform or stewardess outfit'
  },
  {
    "id": 'sgt_pepper',
    "title": "Sgt. Pepper's Band",
    "category": 'Musical',
    "coverImage": 'https://upload.wikimedia.org/wikipedia/en/1/17/Sgt._Pepper%27s_Lonely_Hearts_Club_Band_%28film%29_poster.jpg',
    "images": ['https://upload.wikimedia.org/wikipedia/en/1/17/Sgt._Pepper%27s_Lonely_Hearts_Club_Band_%28film%29_poster.jpg'],
    "movieTitle": "SGT. PEPPER'S BAND",
    "costume": 'a colorful satin marching band uniform with epaulettes'
  }
]

def ensure_structure(templates):
    """Ensures all templates have the 'images' array."""
    for t in templates:
        if 'images' not in t or not isinstance(t['images'], list):
            t['images'] = [t['coverImage']] if t.get('coverImage') else []
    return templates

def load_templates():
    if os.path.exists(TEMPLATES_FILE):
        try:
            with open(TEMPLATES_FILE, 'r') as f:
                data = json.load(f)
                return ensure_structure(data)
        except:
            return ensure_structure(INITIAL_TEMPLATES)
    return ensure_structure(INITIAL_TEMPLATES)

def save_templates(templates):
    with open(TEMPLATES_FILE, 'w') as f:
        json.dump(templates, f, indent=2)

TEMPLATES_DB = load_templates()

@app.get("/")
def health_check():
    return {"status": "ok", "project_id": PROJECT_ID}

@app.get("/templates")
def get_templates():
    return TEMPLATES_DB

@app.post("/admin/generate-template-background")
async def generate_template_background(
    request: Request,
    template_id: str = Form(...),
    prompt: str = Form(...)
):
    print(f"--- AI GEN BACKGROUND REQUEST: {template_id} ---")
    global TEMPLATES_DB
    
    try:
        if not PROJECT_ID:
            raise HTTPException(status_code=500, detail="Vertex AI not configured (missing PROJECT_ID)")

        model = ImageGenerationModel.from_pretrained("imagegeneration@006")
        
        # Enhanced prompt engineering for masterpiece quality
        full_prompt = (
            f"{prompt}, movie poster style, cinematic lighting, 8k resolution, "
            f"photorealistic, masterpiece, highly detailed, vertical aspect ratio, no text"
        )
        
        print(f"Generating with prompt: {full_prompt}")
        
        results = model.generate_images(
            prompt=full_prompt,
            number_of_images=1,
            aspect_ratio="3:4", 
            guidance_scale=15,
        )
        
        if not results or not results[0]:
            raise HTTPException(status_code=500, detail="Image generation returned no results")
            
        generated_bytes = results[0].image_bytes
        filename = f"templates/{template_id}_gen_{uuid.uuid4().hex[:6]}.png"
        public_url = ""

        # Strategy 1: Cloud Storage
        uploaded_to_cloud = False
        if storage_client:
            try:
                bucket = storage_client.bucket(BUCKET_NAME)
                blob = bucket.blob(filename)
                blob.upload_from_string(generated_bytes, content_type="image/png")
                try: 
                    blob.make_public()
                    public_url = blob.public_url
                except: 
                    public_url = blob.generate_signed_url(expiration=3600*24*365)
                uploaded_to_cloud = True
            except Exception as e:
                print(f"Cloud upload failed: {e}")

        # Strategy 2: Local Storage
        if not uploaded_to_cloud:
            local_path = os.path.join(UPLOAD_DIR, filename)
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(generated_bytes)
            
            base_url = str(request.base_url).rstrip("/")
            public_url = f"{base_url}/uploads/{filename}"
            print(f"Saved locally: {public_url}")

        # Update DB
        updated = False
        for t in TEMPLATES_DB:
            if t['id'] == template_id:
                if 'images' not in t: t['images'] = []
                t['images'].insert(0, public_url)
                t['coverImage'] = public_url
                updated = True
                break
        
        if not updated: raise HTTPException(status_code=404, detail="Template ID not found")
        save_templates(TEMPLATES_DB)
        
        return {"success": True, "url": public_url}

    except Exception as e:
        print(f"Gen Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/admin/upload-template-image")
async def update_template_image(
    request: Request,
    file: UploadFile = File(...), 
    template_id: str = Form(...)
):
    print(f"--- UPLOAD REQUEST RECEIVED for Template: {template_id} ---")
    global TEMPLATES_DB
    
    try:
        content = await file.read()
        print(f"File read successfully. Size: {len(content)} bytes")
        
        filename = f"templates/{template_id}_{uuid.uuid4().hex[:6]}.png"
        public_url = ""

        # Strategy 1: Try Cloud Storage
        uploaded_to_cloud = False
        if storage_client:
            try:
                bucket = storage_client.bucket(BUCKET_NAME)
                blob = bucket.blob(filename)
                blob.upload_from_string(content, content_type=file.content_type)
                try: 
                    blob.make_public()
                    public_url = blob.public_url
                except: 
                    public_url = blob.generate_signed_url(expiration=3600*24*365)
                uploaded_to_cloud = True
                print("Uploaded to Google Cloud Storage")
            except Exception as cloud_err:
                print(f"Cloud upload failed ({cloud_err}), falling back to local.")

        # Strategy 2: Local Storage Fallback
        if not uploaded_to_cloud:
            local_path = os.path.join(UPLOAD_DIR, filename)
            # Ensure dir exists (filename includes 'templates/')
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as f:
                f.write(content)
            
            # Construct full URL based on request host
            base_url = str(request.base_url).rstrip("/")
            public_url = f"{base_url}/uploads/{filename}"
            print(f"Saved locally to: {public_url}")

        if not public_url:
            raise HTTPException(status_code=500, detail="Failed to generate image URL")

        # Update DB
        updated = False
        for t in TEMPLATES_DB:
            if t['id'] == template_id:
                if 'images' not in t: t['images'] = []
                t['images'].insert(0, public_url)
                t['coverImage'] = public_url
                updated = True
                break
        
        if not updated: raise HTTPException(status_code=404, detail="Template ID not found")
        save_templates(TEMPLATES_DB)
        return {"success": True, "url": public_url}

    except Exception as e:
        print(f"Upload Error: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

# --- GENERATION LOGIC ---
# (Rest of the file remains largely unchanged, ensuring imports are kept)

CREDITS_DB = {
    "Funny": ["Al Dente", "Terry Cloth", "Barb Dwyer", "Justin Case", "Paige Turner", "Rick O'Shea", "Hazel Nutt"],
    "Action": ["Max Power", "Rip Steel", "Jack Danger", "Rock Stone", "Blaze Storm", "Cliff Hanger"],
    "Horror": ["Gore Verbinski", "D. Caying", "Frank N. Stein", "Bones Rattler", "Carrie Coffin"],
    "Romance": ["Val Entine", "Rose Bush", "Lovett Firstsight", "Hart Throb", "Bea Mine"]
}

def download_image(url: str) -> bytes:
    if not url: return None
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.content
    except Exception as e:
        print(f"Failed to download image from {url}: {e}")
        return None

def get_face_bounds(img_content: bytes):
    if not vision_client: return None
    try:
        image = vision.Image(content=img_content)
        response = vision_client.face_detection(image=image)
        faces = response.face_annotations
        if not faces: return None
        main_face = max(faces, key=lambda f: (f.bounding_poly.vertices[2].x - f.bounding_poly.vertices[0].x) * (f.bounding_poly.vertices[2].y - f.bounding_poly.vertices[0].y))
        vertices = main_face.bounding_poly.vertices
        x_min = min(v.x for v in vertices)
        x_max = max(v.x for v in vertices)
        y_min = min(v.y for v in vertices)
        y_max = max(v.y for v in vertices)
        return (x_min, y_min, x_max - x_min, y_max - y_min)
    except Exception as e:
        print(f"Face detection error: {e}")
        return None

def generate_smart_mask(img_pil: PILImage.Image) -> PILImage.Image:
    if not vision_client:
        print("Vision Client missing, using fallback center mask.")
        mask = PILImage.new("L", img_pil.size, 0)
        d = ImageDraw.Draw(mask)
        w, h = img_pil.size
        d.ellipse((w*0.25, h*0.1, w*0.75, h*0.6), fill=255)
        return mask.filter(ImageFilter.GaussianBlur(30))

    try:
        img_byte_arr = io.BytesIO()
        img_pil.save(img_byte_arr, format='JPEG')
        content = img_byte_arr.getvalue()
        
        image_vision = vision.Image(content=content)
        response = vision_client.face_detection(image=image_vision)
        faces = response.face_annotations

        mask = PILImage.new("L", img_pil.size, 0)
        draw = ImageDraw.Draw(mask)

        if not faces:
            print("No faces detected in template. Using center fallback.")
            w, h = img_pil.size
            draw.ellipse((w*0.3, h*0.15, w*0.7, h*0.6), fill=255)
            return mask.filter(ImageFilter.GaussianBlur(40))

        main_face = max(faces, key=lambda f: (f.bounding_poly.vertices[2].x - f.bounding_poly.vertices[0].x) * (f.bounding_poly.vertices[2].y - f.bounding_poly.vertices[0].y))
        vertices = main_face.bounding_poly.vertices
        x_min = min(v.x for v in vertices)
        x_max = max(v.x for v in vertices)
        y_min = min(v.y for v in vertices)
        y_max = max(v.y for v in vertices)
        
        w_face = x_max - x_min
        h_face = y_max - y_min
        
        pad_x = w_face * 0.4
        pad_top = h_face * 0.8 
        pad_bottom = h_face * 0.5
        
        draw.ellipse(
            (
                x_min - pad_x, 
                y_min - pad_top, 
                x_max + pad_x, 
                y_max + pad_bottom
            ), 
            fill=255
        )
        return mask.filter(ImageFilter.GaussianBlur(radius=30))

    except Exception as e:
        print(f"Smart Mask Generation Failed: {e}")
        mask = PILImage.new("L", img_pil.size, 0)
        d = ImageDraw.Draw(mask)
        w, h = img_pil.size
        d.ellipse((w*0.3, h*0.2, w*0.7, h*0.6), fill=255)
        return mask.filter(ImageFilter.GaussianBlur(30))

@app.post("/generate-meme")
async def generate_meme(
    request: Request,
    user_photo: UploadFile = File(...),
    template_photo: UploadFile = File(None), 
    template_id: str = Form(...),
    template_url: Optional[str] = Form(None),
    user_name: str = Form(...),
    movie_title: str = Form(...),
    tagline: str = Form(...),
    cover_text: str = Form(...),
    tone: str = Form("Funny"),
    costume_description: str = Form(...) 
):
    try:
        # Fallback if vertex not available
        if not PROJECT_ID:
             print("WARNING: PROJECT_ID not set. Mocking generation for demo.")
             # Simply return the user photo composited for demo if no backend
             # In real app we raise error, but here we want robustness
             pass

        if not vision_client or not storage_client:
             init_clients()

        # 1. READ & PREP USER PHOTO
        content = await user_photo.read()
        try:
            user_pil = PILImage.open(io.BytesIO(content))
        except:
             raise HTTPException(status_code=400, detail="Invalid image file")

        user_pil = ImageOps.exif_transpose(user_pil)
        if user_pil.mode != 'RGB':
            user_pil = user_pil.convert('RGB')
            
        # SMART CROP
        face_bounds = get_face_bounds(content)
        if face_bounds:
            ux, uy, uw, uh = face_bounds
            pad = int(uw * 0.5) 
            left = max(0, ux - pad)
            top = max(0, uy - pad)
            right = min(user_pil.width, ux + uw + pad)
            bottom = min(user_pil.height, uy + uh + pad)
            user_pil = user_pil.crop((left, top, right, bottom))
        
        user_bytes_io = io.BytesIO()
        user_pil.save(user_bytes_io, format="PNG")
        user_bytes = user_bytes_io.getvalue()

        # 2. READ & PREP TEMPLATE
        template_bytes = None
        if template_photo:
            template_bytes = await template_photo.read()
        elif template_url:
            template_bytes = download_image(template_url)
        if not template_bytes: raise HTTPException(status_code=400, detail="Could not load template image")

        template_pil = PILImage.open(io.BytesIO(template_bytes)).convert("RGB")
        if template_pil.width > 1200 or template_pil.height > 1200:
             template_pil.thumbnail((1200, 1200), PILImage.LANCZOS)
             
        t_buf = io.BytesIO()
        template_pil.save(t_buf, format="PNG")
        template_bytes = t_buf.getvalue()

        # 3. GENERATE MASK
        mask_pil = generate_smart_mask(template_pil)
        m_buf = io.BytesIO()
        mask_pil.save(m_buf, format="PNG")
        mask_bytes = m_buf.getvalue()

        # 4. AI INPAINTING
        final_img_bytes = None
        try:
            if PROJECT_ID:
                model = ImageGenerationModel.from_pretrained("imagegeneration@006")
                prompt = (
                    f"A cinematic movie poster. The main character is now portrayed by the person in the reference image. "
                    f"Ensure the new face matches the dramatic lighting, shadows, skin texture, and color grading of the original movie poster exactly. "
                    f"Seamless photorealistic integration. The character is wearing {costume_description}. "
                    f"High budget Hollywood style, 8k resolution, highly detailed."
                )
                results = model.edit_image(
                    base_image=Image(image_bytes=template_bytes),
                    mask=Image(image_bytes=mask_bytes),
                    prompt=prompt,
                    edit_mode="inpainting-insert",
                    reference_images=[Image(image_bytes=user_bytes)],
                    guidance_scale=60, 
                    mask_mode="mask-mode-background",
                )
                final_img_bytes = results.images[0].image_bytes
            else:
                 # Mock for no-cloud env
                 template_pil.paste(user_pil.resize((200,200)), (100,100))
                 buf = io.BytesIO()
                 template_pil.save(buf, format="PNG")
                 final_img_bytes = buf.getvalue()
                 
        except Exception as ai_e:
            print(f"Vertex AI Generation Failed: {ai_e}")
            raise HTTPException(status_code=500, detail=f"AI Generation Failed: {str(ai_e)}")

        # 5. TEXT OVERLAYS
        img = PILImage.open(io.BytesIO(final_img_bytes))
        gradient = PILImage.new('L', (img.width, img.height), 0)
        g_draw = ImageDraw.Draw(gradient)
        g_draw.rectangle((0, int(img.height*0.65), img.width, img.height), fill=230) 
        gradient = gradient.filter(ImageFilter.GaussianBlur(radius=60))
        black_layer = PILImage.new('RGBA', img.size, (0,0,0,255))
        black_layer.putalpha(gradient)
        img = PILImage.alpha_composite(img.convert('RGBA'), black_layer)
        draw = ImageDraw.Draw(img)

        try:
            font_main = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 70)
            font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 100)
            font_credits = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 20) 
        except:
            font_main = ImageFont.load_default()
            font_title = ImageFont.load_default()
            font_credits = ImageFont.load_default()

        def draw_centered(y, text, font, color="white"):
            if not text: return
            bbox = draw.textbbox((0, 0), text, font=font)
            text_w = bbox[2] - bbox[0]
            x = (img.width - text_w) / 2
            for off in [-3, 3]:
                draw.text((x+off, y+off), text, font=font, fill="black")
            draw.text((x, y), text, font=font, fill=color)

        draw_centered(60, user_name.upper(), font_main)
        draw_centered(img.height - 200, movie_title.upper(), font_title, color="#FFD700")
        names = CREDITS_DB.get(tone, CREDITS_DB["Funny"])
        random.shuffle(names)
        cred_text = f"DIRECTED BY {names[0].upper()}   PRODUCED BY {names[1].upper()}"
        draw_centered(img.height - 100, cred_text, font_credits, color="#ccc")

        # 6. SAVE & RETURN
        output_buffer = io.BytesIO()
        img.save(output_buffer, format="PNG")
        
        filename = f"generated/{uuid.uuid4()}.png"
        public_url = ""

        # Strategy 1: Cloud
        if storage_client:
             try:
                bucket = storage_client.bucket(BUCKET_NAME)
                blob = bucket.blob(filename)
                blob.upload_from_string(output_buffer.getvalue(), content_type="image/png")
                try: blob.make_public(); public_url = blob.public_url
                except: public_url = blob.generate_signed_url(expiration=3600)
             except Exception as e:
                 print(f"Cloud gen upload failed: {e}")

        # Strategy 2: Local
        if not public_url:
             local_path = os.path.join(UPLOAD_DIR, filename)
             with open(local_path, "wb") as f:
                 f.write(output_buffer.getvalue())
             base_url = str(request.base_url).rstrip("/")
             public_url = f"{base_url}/uploads/{filename}"

        return {"public_url": public_url, "id": filename}

    except Exception as fatal:
        print(f"FATAL: {fatal}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(fatal))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    print("\n" + "="*50)
    print(f"🚀  EPICMEME SERVER STARTED ON PORT {port}")
    print(f"👉  API URL: http://localhost:{port}")
    print("="*50 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
