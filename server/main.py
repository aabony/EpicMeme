
import os
import io
import uuid
import base64
import random
import textwrap
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import storage, vision
import vertexai
from vertexai.preview.vision_models import Image, GenerativeModel
from PIL import Image as PILImage, ImageDraw, ImageFont, ImageOps

# Config
BUCKET_NAME = os.getenv("GCS_BUCKET_NAME", "epicmeme-storage")
PROJECT_ID = os.getenv("GOOGLE_CLOUD_PROJECT")
LOCATION = "us-central1"

app = FastAPI()

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clients
storage_client = storage.Client()
vision_client = vision.ImageAnnotatorClient()
vertexai.init(project=PROJECT_ID, location=LOCATION)

# Fake names based on Tone
CREDITS_DB = {
    "Funny": [
        "Al Dente", "Terry Cloth", "Barb Dwyer", "Justin Case", 
        "Paige Turner", "Rick O'Shea", "Hazel Nutt", "Dan D. Lyon", 
        "Sue Flay", "Chris P. Bacon", "Ben Dover", "Sal Ami"
    ],
    "Action": [
        "Max Power", "Rip Steel", "Jack Danger", "Rock Stone", 
        "Blaze Storm", "Cliff Hanger", "Gunner Fury", "Ace Hunter", 
        "Dirk Savage", "Rex Armstrong", "Bolt Lightning"
    ],
    "Horror": [
        "Gore Verbinski", "D. Caying", "Frank N. Stein", "Bones Rattler", 
        "Carrie Coffin", "Ima Goul", "Rick Mortis", "Sue Pernatural", 
        "Robin Graves", "Fay Tal", "Barry M. Deep"
    ],
    "Romance": [
        "Val Entine", "Rose Bush", "Lovett Firstsight", "Hart Throb", 
        "Bea Mine", "Teddy Bear", "Honey Bunch", "Darling Love", 
        "Sweet Cheeks", "Romeo Juliett", "Cupid Arrow"
    ]
}

@app.post("/generate-meme")
async def generate_meme(
    user_photo: UploadFile = File(...),
    template_id: str = Form(...),
    user_name: str = Form(...),
    movie_title: str = Form(...),
    tagline: str = Form(...),
    cover_text: str = Form(...),
    tone: str = Form("Funny"),
    costume_description: str = Form(...) 
):
    # 1. Validation & Face Detection with Cloud Vision
    content = await user_photo.read()
    image_vision = vision.Image(content=content)
    response = vision_client.face_detection(image=image_vision)
    faces = response.face_annotations

    if not faces:
        raise HTTPException(status_code=400, detail="No faces detected. Please upload a clear photo.")

    # Smart Selection: Find the LARGEST face
    main_face = None
    max_area = 0

    for face in faces:
        vertices = face.bounding_poly.vertices
        x_coords = [v.x for v in vertices]
        y_coords = [v.y for v in vertices]
        width = max(x_coords) - min(x_coords)
        height = max(y_coords) - min(y_coords)
        area = width * height
        
        if area > max_area:
            max_area = area
            main_face = face

    if not main_face or main_face.detection_confidence < 0.7:
        raise HTTPException(status_code=400, detail="We couldn't clearly see the main face. Please try again.")
    
    # 2. THE NECK-UP RULE: Crop the headshot of the MAIN face
    vertices = main_face.bounding_poly.vertices
    x_coords = [v.x for v in vertices]
    y_coords = [v.y for v in vertices]
    x_min, x_max = min(x_coords), max(x_coords)
    y_min, y_max = min(y_coords), max(y_coords)
    
    # Add 20% padding
    width = x_max - x_min
    height = y_max - y_min
    pad_x = int(width * 0.2)
    pad_y = int(height * 0.2)
    
    img_pil = PILImage.open(io.BytesIO(content))
    img_w, img_h = img_pil.size
    
    crop_box = (
        max(0, x_min - pad_x),
        max(0, y_min - pad_y),
        min(img_w, x_max + pad_x),
        min(img_h, y_max + pad_y)
    )
    
    cropped_face_img = img_pil.crop(crop_box)
    
    cropped_bytes_io = io.BytesIO()
    cropped_face_img.save(cropped_bytes_io, format="PNG")
    cropped_bytes = cropped_bytes_io.getvalue()

    # 3. Magic Inpainting with Imagen 3
    bucket = storage_client.bucket(BUCKET_NAME)
    template_blob = bucket.blob(f"templates/{template_id}.png")
    
    try:
        template_bytes = template_blob.download_as_bytes()
    except Exception:
        raise HTTPException(status_code=404, detail="Template not found in storage.")
    
    # 3a. Generate Strict Mask from Template Transparency
    template_pil = PILImage.open(io.BytesIO(template_bytes))
    if template_pil.mode != 'RGBA':
        template_pil = template_pil.convert('RGBA')

    alpha = template_pil.getchannel('A')
    mask_pil = PILImage.eval(alpha, lambda a: 255 if a < 250 else 0)
    
    mask_bytes_io = io.BytesIO()
    mask_pil.save(mask_bytes_io, format="PNG")
    mask_bytes = mask_bytes_io.getvalue()

    # Setup Imagen Model
    model = GenerativeModel("imagen-3.0-generate-001")
    
    subject_ref = Image(image_bytes=cropped_bytes)
    template_ref = Image(image_bytes=template_bytes)
    mask_ref = Image(image_bytes=mask_bytes)
    
    prompt = f"Professional movie poster editing. Insert [subject] into the masked area, wearing {costume_description}. The generated body and lighting must match the exact perspective, texture, and grain of the surrounding movie poster. Maintain the original background completely intact. Ensure eyes are open and looking at the camera."
    
    results = model.edit_image(
        image=template_ref,
        mask=mask_ref,
        prompt=prompt,
        edit_mode="inpainting-insert",
        subject_reference=subject_ref,
    )
    
    final_img_bytes = results.images[0].image_bytes
    
    # 4. Add Text Overlays
    img = PILImage.open(io.BytesIO(final_img_bytes))
    draw = ImageDraw.Draw(img)
    
    try:
        font_main = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 80)
        font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 120)
        font_tagline = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf", 40)
        font_cover = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 35) # Slightly larger reading text
        font_credits = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Condensed.ttf", 20)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 24)
    except:
        font_main = ImageFont.load_default()
        font_title = ImageFont.load_default()
        font_tagline = ImageFont.load_default()
        font_cover = ImageFont.load_default()
        font_credits = ImageFont.load_default()
        font_small = ImageFont.load_default()

    # Draw User Name at Top
    draw.text((img.width/2, 80), user_name.upper(), fill="white", font=font_main, anchor="mt", stroke_width=2, stroke_fill="black")
    
    # Draw Cover Text (Left-aligned paragraph, commonly top-left or mid-left in 80s posters)
    if cover_text:
        # Wrap text to ~30 chars width
        lines = textwrap.wrap(cover_text, width=30)
        y_text = img.height / 3 
        x_text = 60 # Left margin
        
        for line in lines:
            # Draw with heavy shadow for readability over background
            draw.text((x_text + 2, y_text + 2), line, font=font_cover, fill="black")
            draw.text((x_text, y_text), line, font=font_cover, fill="white")
            y_text += 45 # Line height

    # Draw Tagline (Above Title)
    if tagline:
        draw.text((img.width/2, img.height - 250), tagline, fill="white", font=font_tagline, anchor="mb", stroke_width=1, stroke_fill="black")

    # Draw Dynamic Movie Title at the bottom
    draw.text((img.width/2, img.height - 130), movie_title.upper(), fill="yellow", font=font_title, anchor="mb", stroke_width=3, stroke_fill="black")

    # Generate Tone-Aware Billing Block
    names_list = CREDITS_DB.get(tone, CREDITS_DB["Funny"])
    random.shuffle(names_list)
    billing_parts = []
    roles = ["CO-STAR", "MUSIC", "EDITED BY", "PRODUCED BY", "DIRECTED BY"]
    
    for i, role in enumerate(roles):
        if i < len(names_list):
            billing_parts.append(f"{role} {names_list[i].upper()}")
    
    billing_text = "   •   ".join(billing_parts)
    
    # Draw Billing Block
    draw.text((img.width/2, img.height - 70), billing_text, fill="#cccccc", font=font_credits, anchor="mb", align="center")

    # Draw Coming Soon / Date
    draw.text((img.width/2, img.height - 30), "COMING SOON TO THEATERS", fill="#aaaaaa", font=font_small, anchor="mb", align="center")

    # 5. Save and Return
    output_buffer = io.BytesIO()
    img.save(output_buffer, format="PNG")
    output_filename = f"generated/{uuid.uuid4()}.png"
    output_blob = bucket.blob(output_filename)
    output_blob.upload_from_string(output_buffer.getvalue(), content_type="image/png")
    
    output_blob.make_public()
    
    return {"public_url": output_blob.public_url}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
