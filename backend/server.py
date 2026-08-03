from dotenv import load_dotenv
from pathlib import Path
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import uuid
import secrets
import logging
import bcrypt
import jwt
import requests
import httpx
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Any

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Form, Depends, Query, Header
from starlette.middleware.cors import CORSMiddleware
from fastapi.responses import Response as FastResponse, PlainTextResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# -----------------------------
# Config
# -----------------------------
JWT_ALGORITHM = "HS256"
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
APP_NAME = os.environ.get("APP_NAME", "rahi-bangla")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
DEFAULT_CATEGORIES = [
    {"slug": "business", "name_en": "Business", "name_bn": "ব্যবসা"},
    {"slug": "education", "name_en": "Education", "name_bn": "শিক্ষা"},
    {"slug": "sports", "name_en": "Sports", "name_bn": "খেলা"},
    {"slug": "entertainment", "name_en": "Entertainment", "name_bn": "বিনোদন"},
    {"slug": "science", "name_en": "Science", "name_bn": "বিজ্ঞান"},
    {"slug": "lifestyle", "name_en": "Lifestyle", "name_bn": "জীবনধারা"},
    {"slug": "elections", "name_en": "Elections", "name_bn": "নির্বাচন"},
]


async def get_category_slugs() -> List[str]:
    """Get all valid category slugs from DB (falls back to defaults if empty)."""
    docs = await db.categories.find({}, {"_id": 0, "slug": 1}).to_list(200)
    if not docs:
        return [c["slug"] for c in DEFAULT_CATEGORIES]
    return [d["slug"] for d in docs]

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Rahi Bangla API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://rahipatrika.in",
        "https://www.rahipatrika.in",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter(prefix="/api")


# -----------------------------
# Auth helpers
# -----------------------------
def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id, "email": email, "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=60*60*12, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=60*60*24*7, path="/")


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


async def optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


# -----------------------------
# Storage helpers
# -----------------------------
storage_key: Optional[str] = None

def init_storage() -> str:
    global storage_key
    if storage_key:
        return storage_key
    emergent_key = os.environ.get("EMERGENT_LLM_KEY")
    if not emergent_key:
        raise RuntimeError("EMERGENT_LLM_KEY missing")
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": emergent_key}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# -----------------------------
# Models
# -----------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    role: str

class ArticleIn(BaseModel):
    title_en: str = Field(min_length=1)
    title_bn: str = ""
    excerpt_en: str = ""
    excerpt_bn: str = ""
    body_en: str = ""
    body_bn: str = ""
    category: str
    image_path: Optional[str] = None
    image_url: Optional[str] = None
    published: bool = True
    featured: bool = False

class CommentIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)

class NewsletterIn(BaseModel):
    email: EmailStr

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=6)

class UnsubscribeIn(BaseModel):
    token: str

class BroadcastIn(BaseModel):
    subject: str = Field(min_length=1)
    intro: str = ""
    article_ids: List[str] = []


# -----------------------------
# Email helper
# -----------------------------
async def send_email(to: str, subject: str, html: str, reply_to: Optional[str] = None) -> Optional[str]:
    email_key = os.environ.get("EMERGENT_EMAIL_KEY")
    from_name = os.environ.get("EMAIL_FROM_NAME", "Rahi Bangla")
    if not email_key:
        logger.warning("EMERGENT_EMAIL_KEY missing — skipping email send")
        return None
    payload = {"to": [to], "subject": subject, "html": html, "from_name": from_name}
    if reply_to:
        payload["contact_email"] = reply_to
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": email_key},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        logger.error(f"Email send failed {e.response.status_code}: {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return None


def _email_shell(title: str, body_html: str, footer_html: str = "") -> str:
    return f"""<!doctype html>
<html><body style="margin:0;background:#fafafa;font-family:'Helvetica Neue',Arial,sans-serif;color:#0f0f11;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #e5e5e5;">
        <tr><td style="padding:24px 32px;border-bottom:1px solid #e5e5e5;">
          <div style="font-family:'Playfair Display',Georgia,serif;font-size:28px;font-weight:900;letter-spacing:-0.02em;">Rahi Bangla</div>
          <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#6b7280;margin-top:4px;">India's Story, Told Twice</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:26px;line-height:1.2;margin:0 0 16px;">{title}</h1>
          {body_html}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e5e5e5;background:#fafafa;font-size:12px;color:#6b7280;">
          {footer_html or 'You received this email from Rahi Bangla.'}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""


# -----------------------------
# Utility
# -----------------------------
def slugify(text: str) -> str:
    text = re.sub(r"[^\w\s-]", "", text.lower()).strip()
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:80] or str(uuid.uuid4())[:8]

def clean_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u["name"], "role": u["role"]}

def clean_article(a: dict) -> dict:
    a.pop("_id", None)
    return a

def article_url(slug: str) -> str:
    return f"{FRONTEND_URL}/article/{slug}"

def strip_html(html: str, limit: int = 200) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


# -----------------------------
# Startup
# -----------------------------
@app.on_event("startup")
async def startup():
    # Indexes
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.articles.create_index("slug", unique=True)
    await db.articles.create_index("id", unique=True)
    await db.articles.create_index("category")
    await db.articles.create_index([("created_at", -1)])
    await db.comments.create_index([("article_id", 1), ("created_at", -1)])
    await db.likes.create_index([("article_id", 1), ("user_id", 1)], unique=True)
    await db.bookmarks.create_index([("user_id", 1), ("article_id", 1)], unique=True)
    await db.newsletter.create_index("email", unique=True)
    await db.password_reset_tokens.create_index("token", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)

    # Seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    if admin_email and admin_password:
        existing = await db.users.find_one({"email": admin_email})
        if existing is None:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": admin_email,
                "name": "Rahi Admin",
                "role": "admin",
                "password_hash": hash_password(admin_password),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
            logger.info("Admin seeded")
        elif not verify_password(admin_password, existing["password_hash"]):
            await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})
            logger.info("Admin password refreshed")

    # Storage
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

    # Seed sample articles if none exist
    count = await db.articles.count_documents({})
    if count == 0:
        await seed_sample_articles()

    # Seed categories if none exist
    cat_count = await db.categories.count_documents({})
    if cat_count == 0:
        now_iso = datetime.now(timezone.utc).isoformat()
        for i, c in enumerate(DEFAULT_CATEGORIES):
            await db.categories.insert_one({
                "id": str(uuid.uuid4()),
                "slug": c["slug"],
                "name_en": c["name_en"],
                "name_bn": c["name_bn"],
                "order": i,
                "created_at": now_iso,
            })
    await db.categories.create_index("slug", unique=True)
    await db.breaking.create_index([("order", 1)])
    await db.sidebar_news.create_index([("order", 1)])


async def seed_sample_articles():
    admin = await db.users.find_one({"role": "admin"})
    author_id = admin["id"] if admin else "system"
    author_name = admin["name"] if admin else "Rahi Desk"
    samples = [
        {
            "title_en": "Sensex Surges Past 82,000 as FII Inflows Return to Indian Markets",
            "title_bn": "বিদেশি বিনিয়োগের ফিরে আসায় সেনসেক্স ৮২,০০০ ছাড়াল",
            "excerpt_en": "Benchmark indices notched a record close on Friday as global funds resumed buying Indian equities amid easing bond yields.",
            "excerpt_bn": "বন্ড ইয়েল্ড কমে যাওয়ায় বৈশ্বিক তহবিল ভারতীয় ইক্যুইটিতে বিনিয়োগ ফের শুরু করায় সূচকগুলি রেকর্ড উচ্চতায় বন্ধ হয়েছে।",
            "body_en": "Indian equities extended their record run as the BSE Sensex climbed 512 points to close at a new high, powered by banking and IT majors. Foreign portfolio investors turned net buyers after weeks of outflows, signaling renewed confidence in the domestic growth story.",
            "body_bn": "ব্যাংকিং ও আইটি খাতের বড় কোম্পানিগুলির নেতৃত্বে বিএসই সেনসেক্স ৫১২ পয়েন্ট বেড়ে নতুন উচ্চতায় বন্ধ হয়েছে। কয়েক সপ্তাহ পর বিদেশি পোর্টফোলিও বিনিয়োগকারীরা নিট ক্রেতা হয়েছেন।",
            "category": "business",
            "image_url": "https://images.pexels.com/photos/33217250/pexels-photo-33217250.jpeg",
            "featured": True,
        },
        {
            "title_en": "India Clinches Historic Series Win in Perth Test",
            "title_bn": "পার্থ টেস্টে ঐতিহাসিক সিরিজ জয় ভারতের",
            "excerpt_en": "A blistering double century from Yashasvi Jaiswal set up India's first series win at Perth in over a decade.",
            "excerpt_bn": "যশস্বী জয়সওয়ালের বিধ্বংসী দ্বিশতকে এক দশকেরও বেশি সময় পর পার্থে সিরিজ জয় ভারতের।",
            "body_en": "India completed a memorable 3-1 series triumph at the WACA as pacers Bumrah and Siraj shared 12 wickets between them. Captain Rohit Sharma lauded the young batting unit for its fearless approach.",
            "body_bn": "ওয়াকাতে ভারত ৩-১ ব্যবধানে দুর্দান্ত সিরিজ জয় সম্পন্ন করেছে। পেসার বুমরাহ ও সিরাজ মিলে ১২ উইকেট নিয়েছেন।",
            "category": "sports",
            "image_url": "https://images.pexels.com/photos/31723741/pexels-photo-31723741.jpeg",
            "featured": True,
        },
        {
            "title_en": "Election Commission Announces Poll Dates for Five States",
            "title_bn": "পাঁচ রাজ্যে নির্বাচনের তারিখ ঘোষণা করল নির্বাচন কমিশন",
            "excerpt_en": "Voting will begin next month in a phased schedule as the Model Code of Conduct comes into immediate effect.",
            "excerpt_bn": "পর্যায়ক্রমিক সময়সূচিতে আগামী মাসে ভোটগ্রহণ শুরু হবে; আদর্শ আচরণবিধি অবিলম্বে কার্যকর হয়েছে।",
            "body_en": "The Chief Election Commissioner outlined a three-phase schedule spanning six weeks, with results to be declared on a single day. Political parties have welcomed the timeline.",
            "body_bn": "মুখ্য নির্বাচন কমিশনার ছয় সপ্তাহব্যাপী তিন দফার সময়সূচি ঘোষণা করেছেন এবং একই দিনে ফলাফল ঘোষণা করা হবে।",
            "category": "elections",
            "image_url": "https://images.pexels.com/photos/5926271/pexels-photo-5926271.jpeg",
        },
        {
            "title_en": "ISRO Successfully Places Communications Satellite in Orbit",
            "title_bn": "যোগাযোগ উপগ্রহ সফলভাবে কক্ষপথে বসাল ইসরো",
            "excerpt_en": "The GSLV Mk-III launch marks India's 100th successful mission from Sriharikota.",
            "excerpt_bn": "জিএসএলভি এমকে-III উৎক্ষেপণ শ্রীহরিকোটা থেকে ভারতের ১০০তম সফল অভিযান।",
            "body_en": "The 4,700 kg satellite will bolster broadband coverage across remote regions of India. Scientists at ISRO called it a leap forward for national connectivity.",
            "body_bn": "৪,৭০০ কেজির উপগ্রহটি ভারতের প্রত্যন্ত অঞ্চলে ব্রডব্যান্ড কভারেজ বাড়াবে।",
            "category": "science",
            "image_url": "https://images.pexels.com/photos/30547598/pexels-photo-30547598.jpeg",
        },
        {
            "title_en": "New Bollywood Biopic Sets Opening Weekend Box Office Record",
            "title_bn": "নতুন বলিউড বায়োপিক ওপেনিং উইকএন্ডে বক্স অফিসে রেকর্ড",
            "excerpt_en": "The film has crossed ₹120 crore in India within three days of release, becoming the highest opener of the year.",
            "excerpt_bn": "মুক্তির তিন দিনের মধ্যে ছবিটি ভারতে ১২০ কোটি টাকার গণ্ডি অতিক্রম করেছে।",
            "body_en": "Critics have praised the lead performance and cinematography. Trade analysts predict a lifetime collection north of ₹400 crore.",
            "body_bn": "সমালোচকরা প্রধান চরিত্রের অভিনয় এবং চিত্রগ্রহণের প্রশংসা করেছেন।",
            "category": "entertainment",
            "image_url": "https://images.unsplash.com/photo-1622927254841-21f273c7a6e9",
        },
        {
            "title_en": "CBSE Rolls Out AI-Focused Curriculum for Class 9 Onwards",
            "title_bn": "নবম শ্রেণি থেকে এআই-কেন্দ্রিক পাঠ্যক্রম চালু করছে সিবিএসই",
            "excerpt_en": "The new framework introduces practical machine learning modules and ethical AI discussions in secondary schools.",
            "excerpt_bn": "নতুন কাঠামোতে মাধ্যমিক বিদ্যালয়ে ব্যবহারিক মেশিন লার্নিং মডিউল ও নৈতিক এআই আলোচনা যুক্ত হয়েছে।",
            "body_en": "The Central Board of Secondary Education is partnering with tech companies to train teachers and provide project-based learning kits.",
            "body_bn": "সিবিএসই শিক্ষক প্রশিক্ষণ এবং প্রকল্প-ভিত্তিক শেখার কিট প্রদানের জন্য প্রযুক্তি সংস্থাগুলির সাথে অংশীদারিত্ব করছে।",
            "category": "education",
            "image_url": "https://images.pexels.com/photos/35743103/pexels-photo-35743103.jpeg",
        },
        {
            "title_en": "Winter Wellness: Ayurvedic Rituals from Bengal Making a Comeback",
            "title_bn": "শীতকালীন সুস্থতা: বাংলার আয়ুর্বেদিক অভ্যাস ফিরছে",
            "excerpt_en": "From nolen gur infusions to sesame oil massages, traditional wellness practices are trending among urban Indians.",
            "excerpt_bn": "নলেন গুড়ের চা থেকে তিল তেলের মালিশ — শহুরে ভারতীয়দের মধ্যে চিরাচরিত অভ্যাস আবার জনপ্রিয়।",
            "body_en": "Wellness clinics report a surge in bookings for Panchakarma detox programs as awareness of Ayurveda grows among younger demographics.",
            "body_bn": "পঞ্চকর্ম ডিটক্স প্রোগ্রামের বুকিংয়ে বৃদ্ধি লক্ষ্য করা যাচ্ছে।",
            "category": "lifestyle",
            "image_url": "https://images.pexels.com/photos/33217250/pexels-photo-33217250.jpeg",
        },
    ]
    now = datetime.now(timezone.utc)
    for i, s in enumerate(samples):
        doc = {
            "id": str(uuid.uuid4()),
            "slug": slugify(s["title_en"]) + "-" + uuid.uuid4().hex[:6],
            "author_id": author_id,
            "author_name": author_name,
            "image_path": None,
            "published": True,
            "featured": s.get("featured", False),
            "views": 0,
            "created_at": (now - timedelta(hours=i)).isoformat(),
            "updated_at": (now - timedelta(hours=i)).isoformat(),
            **{k: v for k, v in s.items() if k != "featured"},
        }
        try:
            await db.articles.insert_one(doc)
        except Exception:
            pass


# -----------------------------
# Health / meta
# -----------------------------
@api_router.get("/")
async def root():
    slugs = await get_category_slugs()
    return {"service": "Rahi Bangla API", "categories": slugs}


# -----------------------------
# Auth endpoints
# -----------------------------
@api_router.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id,
        "email": email,
        "name": payload.name.strip(),
        "role": "user",
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    access = create_access_token(user_id, email, "user")
    refresh = create_refresh_token(user_id)
    set_auth_cookies(response, access, refresh)
    return {"user": clean_user(doc), "access_token": access}


@api_router.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    access = create_access_token(user["id"], user["email"], user["role"])
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    return {"user": clean_user(user), "access_token": access}


@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user": clean_user(user)}


# -----------------------------
# Uploads
# -----------------------------
@api_router.post("/uploads")
async def upload(file: UploadFile = File(...), user: dict = Depends(get_current_admin)):
    ext = (file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "bin").lower()
    file_id = str(uuid.uuid4())
    path = f"{APP_NAME}/articles/{file_id}.{ext}"
    data = await file.read()
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large (max 8MB)")
    result = put_object(path, data, file.content_type or "application/octet-stream")
    await db.files.insert_one({
        "id": file_id,
        "storage_path": result["path"],
        "original_filename": file.filename,
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "uploaded_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"path": result["path"], "size": result.get("size", len(data))}


@api_router.get("/files/{path:path}")
async def download(path: str):
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        # still try storage in case public/legacy
        try:
            data, ct = get_object(path)
            return FastResponse(content=data, media_type=ct)
        except Exception:
            raise HTTPException(status_code=404, detail="File not found")
    data, ct = get_object(path)
    return FastResponse(content=data, media_type=record.get("content_type") or ct)


# -----------------------------
# Articles
# -----------------------------
@api_router.get("/articles")
async def list_articles(
    category: Optional[str] = None,
    q: Optional[str] = None,
    featured: Optional[bool] = None,
    limit: int = Query(20, ge=1, le=100),
    skip: int = Query(0, ge=0),
):
    query: dict = {"published": True}
    if category:
        query["category"] = category
    if featured is not None:
        query["featured"] = featured
    if q:
        query["$or"] = [
            {"title_en": {"$regex": q, "$options": "i"}},
            {"title_bn": {"$regex": q, "$options": "i"}},
            {"excerpt_en": {"$regex": q, "$options": "i"}},
        ]
    cursor = db.articles.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit)
    items = await cursor.to_list(length=limit)
    total = await db.articles.count_documents(query)
    return {"items": items, "total": total}


@api_router.get("/articles/{slug}")
async def get_article(slug: str, request: Request):
    art = await db.articles.find_one({"slug": slug}, {"_id": 0})
    if not art:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.articles.update_one({"slug": slug}, {"$inc": {"views": 1}})
    likes = await db.likes.count_documents({"article_id": art["id"]})
    user = await optional_user(request)
    liked = False
    bookmarked = False
    if user:
        liked = bool(await db.likes.find_one({"article_id": art["id"], "user_id": user["id"]}))
        bookmarked = bool(await db.bookmarks.find_one({"article_id": art["id"], "user_id": user["id"]}))
    return {"article": art, "likes": likes, "liked": liked, "bookmarked": bookmarked}


@api_router.post("/articles")
async def create_article(payload: ArticleIn, user: dict = Depends(get_current_admin)):
    valid = await get_category_slugs()
    if payload.category not in valid:
        raise HTTPException(status_code=400, detail="Invalid category")
    article_id = str(uuid.uuid4())
    slug = slugify(payload.title_en) + "-" + uuid.uuid4().hex[:6]
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": article_id,
        "slug": slug,
        "author_id": user["id"],
        "author_name": user["name"],
        "views": 0,
        "created_at": now,
        "updated_at": now,
        **payload.model_dump(),
    }
    await db.articles.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/articles/{article_id}")
async def update_article(article_id: str, payload: ArticleIn, user: dict = Depends(get_current_admin)):
    valid = await get_category_slugs()
    if payload.category not in valid:
        raise HTTPException(status_code=400, detail="Invalid category")
    update = payload.model_dump()
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = await db.articles.update_one({"id": article_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Article not found")
    art = await db.articles.find_one({"id": article_id}, {"_id": 0})
    return art


@api_router.delete("/articles/{article_id}")
async def delete_article(article_id: str, user: dict = Depends(get_current_admin)):
    result = await db.articles.delete_one({"id": article_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Article not found")
    await db.comments.delete_many({"article_id": article_id})
    await db.likes.delete_many({"article_id": article_id})
    await db.bookmarks.delete_many({"article_id": article_id})
    return {"ok": True}


# Admin: list all (including unpublished)
@api_router.get("/admin/articles")
async def admin_list_articles(user: dict = Depends(get_current_admin), limit: int = 200):
    cursor = db.articles.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = await cursor.to_list(length=limit)
    return {"items": items}


# -----------------------------
# Likes / Bookmarks / Comments
# -----------------------------
@api_router.post("/articles/{article_id}/like")
async def toggle_like(article_id: str, user: dict = Depends(get_current_user)):
    art = await db.articles.find_one({"id": article_id})
    if not art:
        raise HTTPException(status_code=404, detail="Article not found")
    existing = await db.likes.find_one({"article_id": article_id, "user_id": user["id"]})
    if existing:
        await db.likes.delete_one({"_id": existing["_id"]})
        liked = False
    else:
        await db.likes.insert_one({
            "article_id": article_id,
            "user_id": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        liked = True
    count = await db.likes.count_documents({"article_id": article_id})
    return {"liked": liked, "likes": count}


@api_router.post("/articles/{article_id}/bookmark")
async def toggle_bookmark(article_id: str, user: dict = Depends(get_current_user)):
    art = await db.articles.find_one({"id": article_id})
    if not art:
        raise HTTPException(status_code=404, detail="Article not found")
    existing = await db.bookmarks.find_one({"article_id": article_id, "user_id": user["id"]})
    if existing:
        await db.bookmarks.delete_one({"_id": existing["_id"]})
        bookmarked = False
    else:
        await db.bookmarks.insert_one({
            "article_id": article_id,
            "user_id": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        bookmarked = True
    return {"bookmarked": bookmarked}


@api_router.get("/me/bookmarks")
async def my_bookmarks(user: dict = Depends(get_current_user)):
    bookmarks = await db.bookmarks.find({"user_id": user["id"]}).to_list(200)
    ids = [b["article_id"] for b in bookmarks]
    arts = await db.articles.find({"id": {"$in": ids}}, {"_id": 0}).to_list(200)
    return {"items": arts}


@api_router.get("/articles/{article_id}/comments")
async def list_comments(article_id: str):
    items = await db.comments.find({"article_id": article_id}, {"_id": 0}).sort("created_at", -1).to_list(200)
    return {"items": items}


@api_router.post("/articles/{article_id}/comments")
async def add_comment(article_id: str, payload: CommentIn, user: dict = Depends(get_current_user)):
    art = await db.articles.find_one({"id": article_id})
    if not art:
        raise HTTPException(status_code=404, detail="Article not found")
    doc = {
        "id": str(uuid.uuid4()),
        "article_id": article_id,
        "user_id": user["id"],
        "user_name": user["name"],
        "body": payload.body.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.comments.insert_one(doc)
    doc.pop("_id", None)
    return doc


# -----------------------------
# Admin: comment moderation
# -----------------------------
@api_router.get("/admin/comments")
async def admin_list_comments(
    user: dict = Depends(get_current_admin),
    q: Optional[str] = None,
    article_id: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    skip: int = Query(0, ge=0),
):
    query: dict = {}
    if article_id:
        query["article_id"] = article_id
    if q:
        query["$or"] = [
            {"body": {"$regex": q, "$options": "i"}},
            {"user_name": {"$regex": q, "$options": "i"}},
        ]
    total = await db.comments.count_documents(query)
    items = await db.comments.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    # attach article title + slug
    ids = list({c["article_id"] for c in items})
    arts = await db.articles.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "slug": 1, "title_en": 1, "title_bn": 1}).to_list(len(ids))
    by_id = {a["id"]: a for a in arts}
    for c in items:
        a = by_id.get(c["article_id"])
        c["article_title"] = (a.get("title_en") or a.get("title_bn")) if a else "(deleted)"
        c["article_slug"] = a.get("slug") if a else None
    return {"items": items, "total": total}


@api_router.delete("/admin/comments/{comment_id}")
async def admin_delete_comment(comment_id: str, user: dict = Depends(get_current_admin)):
    result = await db.comments.delete_one({"id": comment_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"ok": True}


# -----------------------------
# Newsletter
# -----------------------------
def _make_unsub_token() -> str:
    return secrets.token_urlsafe(24)

async def _send_welcome_email(email: str, unsub_token: str):
    unsub_url = f"{FRONTEND_URL}/unsubscribe?token={unsub_token}"
    body = f"""
      <p style="font-size:16px;line-height:1.6;color:#1a1a1d;margin:0 0 16px;">
        Welcome to <strong>Rahi Bangla</strong> — India's bilingual newsroom. You're now subscribed to our daily briefing.
      </p>
      <p style="font-size:16px;line-height:1.6;color:#1a1a1d;margin:0 0 16px;">
        Every morning we'll send a curated set of stories across business, elections, sports, entertainment, science, education and lifestyle — in English and বাংলা.
      </p>
      <p style="margin:28px 0 0;">
        <a href="{FRONTEND_URL}" style="display:inline-block;background:#D92D20;color:#ffffff;text-decoration:none;padding:12px 22px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;">Visit Rahi Bangla</a>
      </p>
    """
    footer = f'You are subscribed as {email}. <a href="{unsub_url}" style="color:#6b7280;">Unsubscribe</a>.'
    await send_email(email, "Welcome to Rahi Bangla", _email_shell("Welcome aboard.", body, footer))


@api_router.post("/newsletter")
async def newsletter_subscribe(payload: NewsletterIn):
    email = payload.email.lower()
    existing = await db.newsletter.find_one({"email": email})
    if existing:
        # already subscribed — treat as success (idempotent)
        token = existing.get("unsub_token")
        if not token:
            token = _make_unsub_token()
            await db.newsletter.update_one({"email": email}, {"$set": {"unsub_token": token}})
        return {"ok": True, "already_subscribed": True}
    token = _make_unsub_token()
    await db.newsletter.insert_one({
        "email": email,
        "unsub_token": token,
        "confirmed": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    # Fire and log-only — non-blocking
    try:
        await _send_welcome_email(email, token)
    except Exception as e:
        logger.error(f"welcome email failed: {e}")
    return {"ok": True}


@api_router.post("/newsletter/unsubscribe")
async def newsletter_unsubscribe(payload: UnsubscribeIn):
    result = await db.newsletter.delete_one({"unsub_token": payload.token})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Invalid unsubscribe link")
    return {"ok": True}


@api_router.get("/newsletter/verify")
async def newsletter_verify_token(token: str):
    doc = await db.newsletter.find_one({"unsub_token": token})
    if not doc:
        raise HTTPException(status_code=404, detail="Invalid token")
    return {"email": doc["email"]}


@api_router.post("/admin/newsletter/broadcast")
async def newsletter_broadcast(payload: BroadcastIn, user: dict = Depends(get_current_admin)):
    if payload.article_ids:
        arts = await db.articles.find({"id": {"$in": payload.article_ids}, "published": True}, {"_id": 0}).to_list(20)
    else:
        arts = await db.articles.find({"published": True}, {"_id": 0}).sort("created_at", -1).limit(5).to_list(5)
    subs = await db.newsletter.find({}).to_list(2000)
    if not subs:
        return {"ok": True, "sent": 0}
    sent = 0
    for sub in subs:
        email = sub["email"]
        token = sub.get("unsub_token") or _make_unsub_token()
        if not sub.get("unsub_token"):
            await db.newsletter.update_one({"email": email}, {"$set": {"unsub_token": token}})
        unsub_url = f"{FRONTEND_URL}/unsubscribe?token={token}"
        items_html = ""
        for a in arts:
            title = a.get("title_en") or a.get("title_bn") or "Untitled"
            excerpt = a.get("excerpt_en") or a.get("excerpt_bn") or strip_html(a.get("body_en") or a.get("body_bn") or "", 200)
            img = a.get("image_url") or (f"{FRONTEND_URL}/api/files/{a['image_path']}" if a.get("image_path") else None)
            img_html = f'<img src="{img}" alt="" style="width:100%;max-width:520px;height:auto;display:block;margin:0 0 16px;" />' if img else ""
            items_html += f"""
              <div style="border-top:1px solid #e5e5e5;padding-top:20px;margin-top:20px;">
                {img_html}
                <a href="{article_url(a['slug'])}" style="text-decoration:none;color:#0f0f11;">
                  <h2 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;line-height:1.2;margin:0 0 8px;">{title}</h2>
                </a>
                <p style="font-size:14px;color:#4b5563;line-height:1.6;margin:0 0 8px;">{excerpt}</p>
                <a href="{article_url(a['slug'])}" style="font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#D92D20;text-decoration:none;">Read the story →</a>
              </div>
            """
        intro_html = f'<p style="font-size:16px;line-height:1.6;color:#1a1a1d;margin:0 0 16px;">{payload.intro}</p>' if payload.intro else ""
        html = _email_shell(payload.subject, intro_html + items_html, f'You subscribed to Rahi Bangla with {email}. <a href="{unsub_url}" style="color:#6b7280;">Unsubscribe</a>.')
        eid = await send_email(email, payload.subject, html)
        if eid:
            sent += 1
    return {"ok": True, "sent": sent, "recipients": len(subs)}


# -----------------------------
# Password reset
# -----------------------------
@api_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        expires = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": user["id"],
            "email": email,
            "expires_at": expires,
            "used": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        reset_url = f"{FRONTEND_URL}/reset-password?token={token}"
        body = f"""
          <p style="font-size:16px;line-height:1.6;color:#1a1a1d;margin:0 0 16px;">
            Someone (hopefully you) requested a password reset for your Rahi Bangla account.
          </p>
          <p style="font-size:16px;line-height:1.6;color:#1a1a1d;margin:0 0 24px;">
            This link expires in 60 minutes. If you didn't request this, you can safely ignore this email.
          </p>
          <p style="margin:0 0 24px;">
            <a href="{reset_url}" style="display:inline-block;background:#D92D20;color:#ffffff;text-decoration:none;padding:12px 22px;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;">Reset password</a>
          </p>
          <p style="font-size:12px;color:#6b7280;word-break:break-all;">Or paste this URL in your browser: {reset_url}</p>
        """
        await send_email(email, "Reset your Rahi Bangla password", _email_shell("Password reset request", body))
        logger.info(f"Password reset link (dev log) for {email}: {reset_url}")
    # Always respond ok to prevent user enumeration
    return {"ok": True}


@api_router.get("/auth/reset-password/verify")
async def verify_reset_token(token: str):
    doc = await db.password_reset_tokens.find_one({"token": token, "used": False})
    if not doc:
        raise HTTPException(status_code=404, detail="Invalid or expired link")
    expires = doc.get("expires_at")
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=404, detail="Link expired")
    return {"email": doc["email"]}


@api_router.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn):
    doc = await db.password_reset_tokens.find_one({"token": payload.token, "used": False})
    if not doc:
        raise HTTPException(status_code=400, detail="Invalid or expired link")
    expires = doc.get("expires_at")
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires and expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Link expired")
    await db.users.update_one({"id": doc["user_id"]}, {"$set": {"password_hash": hash_password(payload.password)}})
    await db.password_reset_tokens.update_one({"_id": doc["_id"]}, {"$set": {"used": True}})
    return {"ok": True}


# -----------------------------
# SEO: sitemap + RSS
# -----------------------------
@app.get("/api/sitemap.xml")
async def sitemap():
    articles = await db.articles.find({"published": True}, {"_id": 0, "slug": 1, "updated_at": 1, "created_at": 1}).sort("created_at", -1).to_list(1000)
    cats = await get_category_slugs()
    urls = [(FRONTEND_URL + "/", None), *((f"{FRONTEND_URL}/category/{c}", None) for c in cats)]
    urls += [(article_url(a["slug"]), a.get("updated_at") or a.get("created_at")) for a in articles]
    parts = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u, lastmod in urls:
        parts.append("  <url>")
        parts.append(f"    <loc>{u}</loc>")
        if lastmod:
            parts.append(f"    <lastmod>{lastmod}</lastmod>")
        parts.append("  </url>")
    parts.append("</urlset>")
    return FastResponse(content="\n".join(parts), media_type="application/xml")


@app.get("/api/rss.xml")
async def rss_feed():
    articles = await db.articles.find({"published": True}, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    def esc(s: str) -> str:
        return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    items = []
    for a in articles:
        title = a.get("title_en") or a.get("title_bn") or "Untitled"
        desc = a.get("excerpt_en") or strip_html(a.get("body_en") or "", 300)
        link = article_url(a["slug"])
        pub = a.get("created_at") or datetime.now(timezone.utc).isoformat()
        try:
            pub_dt = datetime.fromisoformat(pub)
            pub_rfc = pub_dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
        except Exception:
            pub_rfc = pub
        items.append(f"""
      <item>
        <title>{esc(title)}</title>
        <link>{link}</link>
        <guid isPermaLink="true">{link}</guid>
        <pubDate>{pub_rfc}</pubDate>
        <category>{esc(a.get('category', ''))}</category>
        <description>{esc(desc)}</description>
      </item>""")
    rss = f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Rahi Bangla</title>
    <link>{FRONTEND_URL}</link>
    <description>India's Story, Told Twice — bilingual news covering business, elections, sports, entertainment, science, education and lifestyle.</description>
    <language>en-in</language>
    {''.join(items)}
  </channel>
</rss>"""
    return FastResponse(content=rss, media_type="application/rss+xml")


# -----------------------------
# Public article meta (for OG/JSON-LD)
# -----------------------------
@api_router.get("/meta/article/{slug}")
async def article_meta(slug: str):
    a = await db.articles.find_one({"slug": slug, "published": True}, {"_id": 0})
    if not a:
        raise HTTPException(status_code=404, detail="Not found")
    image = a.get("image_url") or (f"{FRONTEND_URL}/api/files/{a['image_path']}" if a.get("image_path") else None)
    return {
        "title": a.get("title_en") or a.get("title_bn"),
        "description": a.get("excerpt_en") or strip_html(a.get("body_en") or "", 200),
        "image": image,
        "author": a.get("author_name"),
        "published": a.get("created_at"),
        "modified": a.get("updated_at"),
        "category": a.get("category"),
        "url": article_url(a["slug"]),
    }


# -----------------------------
# Categories (public + admin CRUD)
# -----------------------------
class CategoryIn(BaseModel):
    slug: str = Field(min_length=1, max_length=40)
    name_en: str = Field(min_length=1, max_length=60)
    name_bn: str = ""
    order: int = 0

class CategoryUpdate(BaseModel):
    name_en: Optional[str] = None
    name_bn: Optional[str] = None
    order: Optional[int] = None


@api_router.get("/categories")
async def list_categories():
    items = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(200)
    return {"items": items}


@api_router.post("/categories")
async def create_category(payload: CategoryIn, user: dict = Depends(get_current_admin)):
    raw = (payload.slug or "").strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,39}", raw):
        raise HTTPException(status_code=400, detail="Invalid slug (use a-z, 0-9, hyphen)")
    slug = raw
    if await db.categories.find_one({"slug": slug}):
        raise HTTPException(status_code=400, detail="Category slug already exists")
    doc = {
        "id": str(uuid.uuid4()),
        "slug": slug,
        "name_en": payload.name_en.strip(),
        "name_bn": (payload.name_bn or "").strip(),
        "order": payload.order,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/categories/{cat_id}")
async def update_category(cat_id: str, payload: CategoryUpdate, user: dict = Depends(get_current_admin)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    result = await db.categories.update_one({"id": cat_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    doc = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    return doc


@api_router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, user: dict = Depends(get_current_admin)):
    cat = await db.categories.find_one({"id": cat_id})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    # count articles in that category
    used = await db.articles.count_documents({"category": cat["slug"]})
    if used > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {used} article(s) still use this category")
    await db.categories.delete_one({"id": cat_id})
    return {"ok": True}


# -----------------------------
# Breaking news (multiple items with CRUD)
# -----------------------------
class BreakingIn(BaseModel):
    text_en: str = Field(min_length=1, max_length=280)
    text_bn: str = ""
    link: str = ""
    active: bool = True
    order: int = 0
    start_at: Optional[str] = None  # ISO datetime; when null → live immediately
    end_at: Optional[str] = None    # ISO datetime; when null → stays until deactivated

class BreakingUpdate(BaseModel):
    text_en: Optional[str] = None
    text_bn: Optional[str] = None
    link: Optional[str] = None
    active: Optional[bool] = None
    order: Optional[int] = None
    start_at: Optional[str] = None
    end_at: Optional[str] = None


def _parse_iso(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return None


def _breaking_is_live_now(item: dict, now: Optional[datetime] = None) -> bool:
    if not item.get("active"):
        return False
    now = now or datetime.now(timezone.utc)
    start = _parse_iso(item.get("start_at"))
    end = _parse_iso(item.get("end_at"))
    if start and now < start:
        return False
    if end and now >= end:
        return False
    return True


@api_router.get("/breaking")
async def list_breaking(all_items: bool = False):
    if all_items:
        items = await db.breaking.find({}, {"_id": 0}).sort("order", 1).to_list(200)
        return {"items": items}
    # Return only items currently live (active + within schedule window)
    now = datetime.now(timezone.utc)
    items = await db.breaking.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(500)
    live = [i for i in items if _breaking_is_live_now(i, now)]
    return {"items": live}


@api_router.post("/breaking")
async def create_breaking(payload: BreakingIn, user: dict = Depends(get_current_admin)):
    # Validate schedule fields if provided
    if payload.start_at and not _parse_iso(payload.start_at):
        raise HTTPException(status_code=400, detail="Invalid start_at (use ISO 8601)")
    if payload.end_at and not _parse_iso(payload.end_at):
        raise HTTPException(status_code=400, detail="Invalid end_at (use ISO 8601)")
    if payload.start_at and payload.end_at:
        s = _parse_iso(payload.start_at)
        e = _parse_iso(payload.end_at)
        if s and e and e <= s:
            raise HTTPException(status_code=400, detail="end_at must be after start_at")
    doc = {
        "id": str(uuid.uuid4()),
        "text_en": payload.text_en.strip(),
        "text_bn": (payload.text_bn or "").strip(),
        "link": (payload.link or "").strip(),
        "active": payload.active,
        "order": payload.order,
        "start_at": payload.start_at or None,
        "end_at": payload.end_at or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.breaking.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/breaking/{item_id}")
async def update_breaking(item_id: str, payload: BreakingUpdate, user: dict = Depends(get_current_admin)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "start_at" in update and update["start_at"] and not _parse_iso(update["start_at"]):
        raise HTTPException(status_code=400, detail="Invalid start_at")
    if "end_at" in update and update["end_at"] and not _parse_iso(update["end_at"]):
        raise HTTPException(status_code=400, detail="Invalid end_at")
    # Empty string clears the field
    for k in ("start_at", "end_at"):
        if k in update and update[k] == "":
            update[k] = None
    result = await db.breaking.update_one({"id": item_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Breaking item not found")
    doc = await db.breaking.find_one({"id": item_id}, {"_id": 0})
    return doc


@api_router.delete("/breaking/{item_id}")
async def delete_breaking(item_id: str, user: dict = Depends(get_current_admin)):
    result = await db.breaking.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Breaking item not found")
    return {"ok": True}


# -----------------------------
# Sidebar curated news (left/right columns with latest)
# -----------------------------
class SidebarIn(BaseModel):
    side: str = "left"           # "left" or "right"
    text_en: str = Field(min_length=1, max_length=280)
    text_bn: str = ""
    link: str = ""
    article_id: Optional[str] = None  # optional link to internal article
    active: bool = True
    order: int = 0

class SidebarUpdate(BaseModel):
    side: Optional[str] = None
    text_en: Optional[str] = None
    text_bn: Optional[str] = None
    link: Optional[str] = None
    article_id: Optional[str] = None
    active: Optional[bool] = None
    order: Optional[int] = None


def _article_to_sidebar(a: dict, side: str) -> dict:
    return {
        "id": f"auto-{a['id']}",
        "auto": True,
        "side": side,
        "text_en": a.get("title_en") or a.get("title_bn") or "",
        "text_bn": a.get("title_bn") or a.get("title_en") or "",
        "link": f"/article/{a['slug']}",
        "article_id": a["id"],
        "created_at": a.get("created_at"),
        "active": True,
    }


@api_router.get("/sidebar-news")
async def sidebar_news(side: str = "left", limit: int = 10, include_auto: bool = True):
    """Public: returns curated items for a side, optionally topped up with latest articles."""
    if side not in ("left", "right"):
        raise HTTPException(status_code=400, detail="side must be left or right")
    curated = await db.sidebar_news.find(
        {"side": side, "active": True}, {"_id": 0}
    ).sort("order", 1).to_list(limit)
    # mark curated as non-auto
    for c in curated:
        c["auto"] = False

    used_article_ids = {c.get("article_id") for c in curated if c.get("article_id")}
    remaining = max(0, limit - len(curated))
    auto = []
    if include_auto and remaining > 0:
        # Pull latest articles (published), skip ones already linked
        skip_offset = 0 if side == "left" else remaining  # bias right side to next set
        cursor = db.articles.find(
            {"published": True}, {"_id": 0}
        ).sort("created_at", -1).skip(skip_offset).limit(limit * 2)
        arts = await cursor.to_list(limit * 2)
        for a in arts:
            if len(auto) >= remaining:
                break
            if a["id"] in used_article_ids:
                continue
            auto.append(_article_to_sidebar(a, side))
    items = curated + auto
    return {"items": items[:limit]}


@api_router.get("/admin/sidebar-news")
async def admin_list_sidebar(user: dict = Depends(get_current_admin), side: Optional[str] = None):
    q = {}
    if side:
        q["side"] = side
    items = await db.sidebar_news.find(q, {"_id": 0}).sort("order", 1).to_list(500)
    return {"items": items}


@api_router.post("/sidebar-news")
async def create_sidebar(payload: SidebarIn, user: dict = Depends(get_current_admin)):
    if payload.side not in ("left", "right"):
        raise HTTPException(status_code=400, detail="side must be left or right")
    doc = {
        "id": str(uuid.uuid4()),
        "side": payload.side,
        "text_en": payload.text_en.strip(),
        "text_bn": (payload.text_bn or "").strip(),
        "link": (payload.link or "").strip(),
        "article_id": payload.article_id,
        "active": payload.active,
        "order": payload.order,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.sidebar_news.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/sidebar-news/{item_id}")
async def update_sidebar(item_id: str, payload: SidebarUpdate, user: dict = Depends(get_current_admin)):
    update = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")
    if "side" in update and update["side"] not in ("left", "right"):
        raise HTTPException(status_code=400, detail="side must be left or right")
    result = await db.sidebar_news.update_one({"id": item_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    doc = await db.sidebar_news.find_one({"id": item_id}, {"_id": 0})
    return doc


@api_router.delete("/sidebar-news/{item_id}")
async def delete_sidebar(item_id: str, user: dict = Depends(get_current_admin)):
    result = await db.sidebar_news.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


# -----------------------------
# Layouts (persist admin's drag-and-drop layout per page)
# -----------------------------
class LayoutIn(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    # blocks: list of { i, x, y, w, h, type, category?, articleId?, title? }
    blocks: List[Any] = []


@api_router.get("/layouts/{key}")
async def get_layout(key: str):
    doc = await db.layouts.find_one({"key": key}, {"_id": 0})
    if not doc:
        return {"key": key, "blocks": []}
    return doc


@api_router.put("/layouts/{key}")
async def save_layout(key: str, payload: LayoutIn, user: dict = Depends(get_current_admin)):
    if payload.key != key:
        raise HTTPException(status_code=400, detail="Key mismatch")
    doc = {
        "key": key,
        "blocks": payload.blocks,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": user["id"],
    }
    await db.layouts.update_one({"key": key}, {"$set": doc}, upsert=True)
    return doc


@api_router.delete("/layouts/{key}")
async def reset_layout(key: str, user: dict = Depends(get_current_admin)):
    await db.layouts.delete_one({"key": key})
    return {"ok": True}



# -----------------------------
# Register router + middleware
# -----------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "*")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Health endpoints (platform ingress discovery)
# -----------------------------
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

@app.get("/health/ready")
async def readiness_check():
    try:
        await db.command("ping")
        return {"ready": True, "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not ready: {str(e)}")

@app.get("/health/live")
async def liveness_check():
    return {"alive": True}


@app.on_event("shutdown")
async def shutdown():
    client.close()
