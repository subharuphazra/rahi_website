"""Phase 3 backend tests: admin comment moderation endpoints + article DELETE cascade."""
import os
import time
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://rahi-news-portal.preview.emergentagent.com"
ADMIN_EMAIL = "rahipatrika@gmail.com"
ADMIN_PASSWORD = "Thanksc#2u"


def _session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin():
    s = _session()
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def user():
    s = _session()
    ts = int(time.time())
    email = f"mod_test_{ts}@example.com"
    pwd = "TestPass@2026"
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": pwd, "name": f"Mod Test {ts}"})
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def any_article(admin):
    r = admin.get(f"{BASE_URL}/api/articles", params={"limit": 5})
    assert r.status_code == 200
    items = r.json().get("items") or r.json()
    assert items, "No articles found to comment on"
    return items[0]


# -----------------------------
# Auth guards
# -----------------------------
def test_admin_comments_requires_auth():
    r = requests.get(f"{BASE_URL}/api/admin/comments")
    assert r.status_code == 401, f"expected 401 got {r.status_code} {r.text}"


def test_admin_comments_forbidden_for_non_admin(user):
    r = user.get(f"{BASE_URL}/api/admin/comments")
    assert r.status_code == 403, f"expected 403 got {r.status_code} {r.text}"


def test_admin_delete_forbidden_for_non_admin(user):
    r = user.delete(f"{BASE_URL}/api/admin/comments/does-not-exist")
    assert r.status_code == 403


# -----------------------------
# List & CRUD
# -----------------------------
def test_admin_list_returns_structure(admin):
    r = admin.get(f"{BASE_URL}/api/admin/comments")
    assert r.status_code == 200, r.text
    data = r.json()
    assert "items" in data and "total" in data
    assert isinstance(data["items"], list)
    assert isinstance(data["total"], int)


def test_post_comment_and_admin_sees_it(admin, user, any_article):
    body = f"TEST_body_{int(time.time())} awesome article"
    r = user.post(f"{BASE_URL}/api/articles/{any_article['id']}/comments", json={"body": body})
    assert r.status_code in (200, 201), r.text
    posted = r.json()
    cid = posted["id"]

    r = admin.get(f"{BASE_URL}/api/admin/comments")
    assert r.status_code == 200
    items = r.json()["items"]
    match = next((c for c in items if c["id"] == cid), None)
    assert match is not None, "Newly posted comment not seen by admin"
    for f in ("id", "user_name", "body", "created_at", "article_id", "article_title", "article_slug"):
        assert f in match, f"missing field: {f}"
    assert match["body"] == body
    assert match["article_id"] == any_article["id"]


def test_admin_list_filter_by_q(admin, user, any_article):
    marker = f"UNIQMARK{int(time.time()*1000)}"
    r = user.post(f"{BASE_URL}/api/articles/{any_article['id']}/comments", json={"body": f"hello {marker} world"})
    assert r.status_code in (200, 201)

    r = admin.get(f"{BASE_URL}/api/admin/comments", params={"q": marker})
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 1
    assert all(marker.lower() in (c["body"] + c["user_name"]).lower() for c in data["items"])

    # Case-insensitive
    r2 = admin.get(f"{BASE_URL}/api/admin/comments", params={"q": marker.lower()})
    assert r2.status_code == 200
    assert r2.json()["total"] >= 1


def test_admin_list_filter_by_article_id(admin, user, any_article):
    r = user.post(f"{BASE_URL}/api/articles/{any_article['id']}/comments", json={"body": "article-filter-check"})
    assert r.status_code in (200, 201)
    r = admin.get(f"{BASE_URL}/api/admin/comments", params={"article_id": any_article["id"]})
    assert r.status_code == 200
    data = r.json()
    assert data["total"] >= 1
    for c in data["items"]:
        assert c["article_id"] == any_article["id"]


def test_admin_delete_comment_removes_it(admin, user, any_article):
    r = user.post(f"{BASE_URL}/api/articles/{any_article['id']}/comments", json={"body": "TEST_to_delete"})
    assert r.status_code in (200, 201)
    cid = r.json()["id"]

    r = admin.delete(f"{BASE_URL}/api/admin/comments/{cid}")
    assert r.status_code == 200, r.text

    # Not in article listing
    r = requests.get(f"{BASE_URL}/api/articles/{any_article['id']}/comments")
    assert r.status_code == 200
    assert all(c["id"] != cid for c in r.json()["items"])

    # Not in admin listing
    r = admin.get(f"{BASE_URL}/api/admin/comments")
    assert all(c["id"] != cid for c in r.json()["items"])


def test_admin_delete_nonexistent_returns_404(admin):
    r = admin.delete(f"{BASE_URL}/api/admin/comments/nonexistent-id-xyz")
    assert r.status_code == 404


# -----------------------------
# Regression: article DELETE cascades comments
# -----------------------------
def test_article_delete_cascades_comments(admin, user):
    # Create article
    payload = {
        "title_en": f"TEST cascade {int(time.time())}",
        "title_bn": "টেস্ট",
        "slug": f"test-cascade-{int(time.time())}",
        "excerpt_en": "x", "excerpt_bn": "x",
        "body_en": "body", "body_bn": "body",
        "category": "business",
        "status": "published",
    }
    r = admin.post(f"{BASE_URL}/api/articles", json=payload)
    assert r.status_code in (200, 201), r.text
    art = r.json()
    aid = art["id"]

    # Comment on it
    r = user.post(f"{BASE_URL}/api/articles/{aid}/comments", json={"body": "TEST_cascade_body"})
    assert r.status_code in (200, 201), r.text
    cid = r.json()["id"]

    # Verify comment exists in admin listing
    r = admin.get(f"{BASE_URL}/api/admin/comments", params={"article_id": aid})
    assert any(c["id"] == cid for c in r.json()["items"])

    # Delete article
    r = admin.delete(f"{BASE_URL}/api/articles/{aid}")
    assert r.status_code in (200, 204), r.text

    # Comments should be gone
    r = admin.get(f"{BASE_URL}/api/admin/comments", params={"article_id": aid})
    assert r.status_code == 200
    assert all(c["id"] != cid for c in r.json()["items"])
    assert r.json()["total"] == 0
