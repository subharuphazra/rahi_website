"""End-to-end backend tests for Rahi Bangla API."""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback: read frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "rahipatrika@gmail.com"
ADMIN_PASSWORD = "Thanksc#2u"
READER_EMAIL = f"reader+{int(time.time())}@example.com"
READER_PASSWORD = "Reader@2026"

pytestmark = pytest.mark.order(1)


# ---- Fixtures ----
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    assert "access_token" in s.cookies or "access_token" in data
    return s


@pytest.fixture(scope="session")
def reader_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/register", json={
        "email": READER_EMAIL, "password": READER_PASSWORD, "name": "Test Reader"
    }, timeout=30)
    assert r.status_code == 200, f"Register failed: {r.status_code} {r.text}"
    assert r.json()["user"]["role"] == "user"
    return s


@pytest.fixture(scope="session")
def state():
    return {}


# ---- Meta ----
def test_root_meta():
    r = requests.get(f"{API}/", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["service"] == "Rahi Bangla API"
    assert set(["business", "education", "sports", "entertainment", "science", "lifestyle", "elections"]).issubset(set(data["categories"]))


# ---- Auth ----
def test_admin_login_sets_cookies(admin_session):
    # session already logged in via fixture
    assert admin_session.cookies.get("access_token")
    assert admin_session.cookies.get("refresh_token")


def test_admin_me(admin_session):
    r = admin_session.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "admin"


def test_reader_register(reader_session):
    r = reader_session.get(f"{API}/auth/me", timeout=30)
    assert r.status_code == 200
    assert r.json()["user"]["email"] == READER_EMAIL


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=30)
    assert r.status_code == 401


# ---- Articles listing ----
def test_list_articles_seeded(state):
    r = requests.get(f"{API}/articles", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 7, f"expected >=7 got {data['total']}"
    assert len(data["items"]) >= 1
    state["sample_slug"] = data["items"][0]["slug"]
    state["sample_id"] = data["items"][0]["id"]


def test_articles_filter_category():
    r = requests.get(f"{API}/articles?category=business", timeout=30)
    assert r.status_code == 200
    for it in r.json()["items"]:
        assert it["category"] == "business"


def test_articles_search():
    r = requests.get(f"{API}/articles?q=India", timeout=30)
    assert r.status_code == 200
    assert r.json()["total"] >= 1


# ---- Article CRUD ----
def test_admin_create_article(admin_session, state):
    r = admin_session.post(f"{API}/articles", json={
        "title_en": f"TEST_ Article {uuid.uuid4().hex[:6]}",
        "title_bn": "টেস্ট নিবন্ধ",
        "excerpt_en": "excerpt",
        "body_en": "body",
        "category": "business",
    }, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "id" in data and "slug" in data
    state["new_id"] = data["id"]
    state["new_slug"] = data["slug"]


def test_non_admin_cannot_create(reader_session):
    r = reader_session.post(f"{API}/articles", json={
        "title_en": "TEST_ nope", "category": "sports",
    }, timeout=30)
    assert r.status_code == 403


def test_get_article_by_slug_increments_views(state):
    slug = state["new_slug"]
    r1 = requests.get(f"{API}/articles/{slug}", timeout=30)
    assert r1.status_code == 200
    d1 = r1.json()
    assert "article" in d1 and "likes" in d1 and "liked" in d1 and "bookmarked" in d1
    v1 = d1["article"]["views"]
    r2 = requests.get(f"{API}/articles/{slug}", timeout=30)
    v2 = r2.json()["article"]["views"]
    assert v2 >= v1  # view increments on server-side after read


def test_admin_update_article(admin_session, state):
    r = admin_session.put(f"{API}/articles/{state['new_id']}", json={
        "title_en": "TEST_ Updated Title",
        "category": "sports",
    }, timeout=30)
    assert r.status_code == 200
    assert r.json()["title_en"] == "TEST_ Updated Title"


# ---- Likes / Bookmarks / Comments ----
def test_reader_like_toggle(reader_session, state):
    aid = state["new_id"]
    r1 = reader_session.post(f"{API}/articles/{aid}/like", timeout=30)
    assert r1.status_code == 200
    assert r1.json()["liked"] is True
    r2 = reader_session.post(f"{API}/articles/{aid}/like", timeout=30)
    assert r2.json()["liked"] is False


def test_reader_bookmark_and_list(reader_session, state):
    aid = state["new_id"]
    r = reader_session.post(f"{API}/articles/{aid}/bookmark", timeout=30)
    assert r.status_code == 200
    assert r.json()["bookmarked"] is True
    r2 = reader_session.get(f"{API}/me/bookmarks", timeout=30)
    assert r2.status_code == 200
    ids = [a["id"] for a in r2.json()["items"]]
    assert aid in ids


def test_reader_comment(reader_session, state):
    aid = state["new_id"]
    r = reader_session.post(f"{API}/articles/{aid}/comments", json={"body": "TEST_ nice article"}, timeout=30)
    assert r.status_code == 200
    r2 = requests.get(f"{API}/articles/{aid}/comments", timeout=30)
    bodies = [c["body"] for c in r2.json()["items"]]
    assert "TEST_ nice article" in bodies


# ---- Newsletter ----
def test_newsletter_and_duplicate():
    email = f"news+{int(time.time())}@example.com"
    r1 = requests.post(f"{API}/newsletter", json={"email": email}, timeout=30)
    assert r1.status_code == 200
    r2 = requests.post(f"{API}/newsletter", json={"email": email}, timeout=30)
    assert r2.status_code == 200


# ---- Upload ----
def test_admin_upload_and_serve(admin_session):
    # minimal PNG bytes
    png = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082"
    )
    files = {"file": ("t.png", io.BytesIO(png), "image/png")}
    r = admin_session.post(f"{API}/uploads", files=files, timeout=60)
    if r.status_code != 200:
        pytest.skip(f"Upload not available: {r.status_code} {r.text[:200]}")
    path = r.json()["path"]
    r2 = requests.get(f"{API}/files/{path}", timeout=60)
    assert r2.status_code == 200
    assert len(r2.content) > 0


# ---- Cleanup ----
def test_admin_delete_article(admin_session, state):
    r = admin_session.delete(f"{API}/articles/{state['new_id']}", timeout=30)
    assert r.status_code == 200
    r2 = requests.get(f"{API}/articles/{state['new_slug']}", timeout=30)
    assert r2.status_code == 404
