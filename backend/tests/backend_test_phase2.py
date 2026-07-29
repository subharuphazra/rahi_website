"""Phase 2 backend regression: password reset, newsletter, SEO endpoints."""
import os
import re
import asyncio
import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://rahi-news-portal.preview.emergentagent.com"
ADMIN_EMAIL = "rahipatrika@gmail.com"
ADMIN_PASSWORD = "Thanksc#2u"
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]


# -----------------------------
# Fixtures
# -----------------------------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    s = requests.Session()
    s.cookies.update(r.cookies)
    s.headers.update({"Content-Type": "application/json"})
    return s


def _mongo():
    return AsyncIOMotorClient(MONGO_URL)[DB_NAME]


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


# -----------------------------
# SEO: sitemap, rss, meta
# -----------------------------
class TestSEO:
    def test_sitemap_xml(self, api):
        r = api.get(f"{BASE_URL}/api/sitemap.xml")
        assert r.status_code == 200
        assert "xml" in r.headers.get("content-type", "").lower()
        body = r.text
        assert "<urlset" in body
        # count <loc> entries
        locs = re.findall(r"<loc>", body)
        assert len(locs) >= 8, f"expected >=8 urls, got {len(locs)}"

    def test_rss_xml(self, api):
        r = api.get(f"{BASE_URL}/api/rss.xml")
        assert r.status_code == 200
        body = r.text
        assert "<rss" in body
        assert "<title>Rahi Bangla</title>" in body
        assert "<item>" in body

    def test_article_meta(self, api):
        # Pick a real article slug
        lst = api.get(f"{BASE_URL}/api/articles?limit=1").json()
        assert lst["items"], "no articles present to test meta"
        slug = lst["items"][0]["slug"]
        r = api.get(f"{BASE_URL}/api/meta/article/{slug}")
        assert r.status_code == 200
        data = r.json()
        for k in ["title", "description", "image", "author", "published"]:
            assert k in data
        assert data["title"]

    def test_article_meta_404(self, api):
        r = api.get(f"{BASE_URL}/api/meta/article/definitely-not-a-real-slug-xyz")
        assert r.status_code == 404


# -----------------------------
# Password reset
# -----------------------------
class TestPasswordReset:
    def test_forgot_password_known_email(self, api):
        r = api.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": ADMIN_EMAIL})
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_forgot_password_unknown_email(self, api):
        r = api.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": "nobody-xyz@example.com"})
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    def test_verify_invalid_token(self, api):
        r = api.get(f"{BASE_URL}/api/auth/reset-password/verify", params={"token": "INVALID_TOKEN_XX"})
        assert r.status_code == 404

    def test_full_reset_flow_and_restore(self, api):
        """Reset admin password to a temp, log in, then restore back to Thanksc#2u."""

        async def get_latest_token(email):
            db = _mongo()
            doc = await db.password_reset_tokens.find({"email": email, "used": False}).sort("created_at", -1).to_list(1)
            return doc[0]["token"] if doc else None

        # 1. Request forgot
        r = api.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": ADMIN_EMAIL})
        assert r.status_code == 200

        token = asyncio.run(get_latest_token(ADMIN_EMAIL))
        assert token, "reset token not found in mongo"

        # 2. Verify
        r = api.get(f"{BASE_URL}/api/auth/reset-password/verify", params={"token": token})
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

        # 3. Reset
        new_pw = "TempReset#123"
        r = api.post(f"{BASE_URL}/api/auth/reset-password", json={"token": token, "password": new_pw})
        assert r.status_code == 200
        assert r.json()["ok"] is True

        # 4. Login with new password
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": new_pw})
        assert r.status_code == 200, r.text

        # 5. Old password should fail
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 401

        # 6. Reset back to original
        r = api.post(f"{BASE_URL}/api/auth/forgot-password", json={"email": ADMIN_EMAIL})
        assert r.status_code == 200
        token2 = asyncio.run(get_latest_token(ADMIN_EMAIL))
        assert token2 and token2 != token
        r = api.post(f"{BASE_URL}/api/auth/reset-password", json={"token": token2, "password": ADMIN_PASSWORD})
        assert r.status_code == 200

        # 7. Confirm restore
        r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200

    def test_reset_with_invalid_token(self, api):
        r = api.post(f"{BASE_URL}/api/auth/reset-password", json={"token": "NOPE", "password": "whatever12"})
        assert r.status_code == 400


# -----------------------------
# Newsletter
# -----------------------------
class TestNewsletter:
    TEST_EMAIL = f"test_ns_{os.urandom(3).hex()}@example.com"

    def test_subscribe_new(self, api):
        r = api.post(f"{BASE_URL}/api/newsletter", json={"email": self.TEST_EMAIL})
        assert r.status_code == 200
        assert r.json()["ok"] is True

        # verify token stored
        async def _tok():
            db = _mongo()
            doc = await db.newsletter.find_one({"email": self.TEST_EMAIL})
            return doc

        doc = asyncio.run(_tok())
        assert doc and doc.get("unsub_token"), "unsub_token not stored"
        # stash for later tests
        type(self).TOKEN = doc["unsub_token"]

    def test_verify_token(self, api):
        r = api.get(f"{BASE_URL}/api/newsletter/verify", params={"token": self.TOKEN})
        assert r.status_code == 200
        assert r.json()["email"] == self.TEST_EMAIL

    def test_verify_invalid_token(self, api):
        r = api.get(f"{BASE_URL}/api/newsletter/verify", params={"token": "bogus_zzz"})
        assert r.status_code == 404

    def test_unsubscribe_invalid(self, api):
        r = api.post(f"{BASE_URL}/api/newsletter/unsubscribe", json={"token": "bogus_zzz"})
        assert r.status_code == 404

    def test_unsubscribe_valid(self, api):
        r = api.post(f"{BASE_URL}/api/newsletter/unsubscribe", json={"token": self.TOKEN})
        assert r.status_code == 200

        async def _check():
            db = _mongo()
            return await db.newsletter.find_one({"email": self.TEST_EMAIL})

        assert asyncio.run(_check()) is None

    def test_broadcast_forbidden_for_anon(self, api):
        s = requests.Session()
        r = s.post(f"{BASE_URL}/api/admin/newsletter/broadcast", json={"subject": "X"})
        assert r.status_code in (401, 403)

    def test_broadcast_forbidden_for_user(self, api):
        # Register a fresh reader
        email = f"reader_{os.urandom(3).hex()}@example.com"
        r = api.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "Reader@2026", "name": "Reader"})
        assert r.status_code == 200
        s = requests.Session()
        s.cookies.update(r.cookies)
        r = s.post(f"{BASE_URL}/api/admin/newsletter/broadcast", json={"subject": "X"}, headers={"Content-Type": "application/json"})
        assert r.status_code == 403

    def test_broadcast_admin(self, admin):
        # ensure at least one subscriber
        sub_email = f"broadcast_{os.urandom(3).hex()}@example.com"
        admin.post(f"{BASE_URL}/api/newsletter", json={"email": sub_email})
        r = admin.post(f"{BASE_URL}/api/admin/newsletter/broadcast", json={"subject": "Rahi test", "intro": "hi"})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("ok") is True
        assert "sent" in data and "recipients" in data
        # cleanup subscriber
        async def _clean():
            db = _mongo()
            await db.newsletter.delete_one({"email": sub_email})
        asyncio.run(_clean())
