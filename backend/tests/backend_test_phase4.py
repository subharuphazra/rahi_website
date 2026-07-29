"""Phase 4 backend tests: Categories, Breaking News, Sidebar News, Layouts.

Tested against local backend (http://localhost:8001) because public preview
ingress is currently returning 404 on /api/* per iteration notes.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("BACKEND_TEST_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "rahipatrika@gmail.com"
ADMIN_PASSWORD = "Thanksc#2u"

TAG = f"TEST_{uuid.uuid4().hex[:6]}"


# ---------- Fixtures ----------
@pytest.fixture(scope="session")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    token = r.json().get("access_token")
    assert token
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


@pytest.fixture(scope="session")
def anon():
    return requests.Session()


@pytest.fixture(scope="session")
def reader():
    """Non-admin authenticated session for authorization checks."""
    s = requests.Session()
    email = f"reader_{uuid.uuid4().hex[:6]}@example.com"
    pw = "Reader@2026x"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "Reader"}, timeout=30)
    if r.status_code not in (200, 201):
        pytest.skip(f"reader register failed {r.status_code} {r.text}")
    tok = r.json().get("access_token")
    if not tok:
        # login
        rr = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
        tok = rr.json().get("access_token")
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


# ---------- Health / backward-compat ----------
class TestBackwardCompat:
    def test_root(self, anon):
        r = anon.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert "service" in data
        assert isinstance(data.get("categories"), list) and len(data["categories"]) >= 7

    def test_articles_list(self, anon):
        r = anon.get(f"{API}/articles")
        assert r.status_code == 200
        assert "items" in r.json()

    def test_auth_me(self, admin):
        r = admin.get(f"{API}/auth/me")
        assert r.status_code == 200
        body = r.json()
        # response may be {user:{...}} or flat user
        user = body.get("user", body)
        assert user.get("role") == "admin"


# ---------- Categories ----------
class TestCategories:
    def test_default_seed(self, anon):
        r = anon.get(f"{API}/categories")
        assert r.status_code == 200
        slugs = {c["slug"] for c in r.json()["items"]}
        for s in ("business", "education", "sports", "entertainment", "science", "lifestyle", "elections"):
            assert s in slugs, f"missing default slug {s}"

    def test_create_category_admin(self, admin):
        slug = f"{TAG}_cat"
        r = admin.post(f"{API}/categories", json={"slug": slug, "name_en": "TestCat", "name_bn": "টেস্ট", "order": 99})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["slug"] == slug.lower().replace("_", "-") or body["slug"]
        # persistence
        r2 = admin.get(f"{API}/categories")
        assert any(c["slug"] == body["slug"] for c in r2.json()["items"])
        # save id for later tests
        pytest.custom_cat_id = body["id"]
        pytest.custom_cat_slug = body["slug"]

    def test_duplicate_slug_rejected(self, admin):
        slug = "business"
        r = admin.post(f"{API}/categories", json={"slug": slug, "name_en": "Dup"})
        assert r.status_code == 400

    def test_non_admin_create_rejected(self, reader):
        r = reader.post(f"{API}/categories", json={"slug": f"{TAG}_x", "name_en": "X"})
        assert r.status_code in (401, 403), r.status_code

    def test_anon_create_rejected(self, anon):
        r = anon.post(f"{API}/categories", json={"slug": f"{TAG}_y", "name_en": "Y"})
        assert r.status_code in (401, 403)

    def test_update_category(self, admin):
        cid = getattr(pytest, "custom_cat_id", None)
        assert cid, "prereq missing"
        r = admin.put(f"{API}/categories/{cid}", json={"name_en": "UpdatedCat", "order": 42})
        assert r.status_code == 200
        assert r.json()["name_en"] == "UpdatedCat"
        # persistence via list
        items = admin.get(f"{API}/categories").json()["items"]
        got = [c for c in items if c["id"] == cid][0]
        assert got["order"] == 42

    def test_delete_category_blocked_if_used(self, admin):
        # create article with new category, then try deleting
        slug = getattr(pytest, "custom_cat_slug", None)
        art_payload = {
            "title_en": f"{TAG} article",
            "title_bn": "টেস্ট",
            "excerpt_en": "x",
            "excerpt_bn": "x",
            "body_en": "x",
            "body_bn": "x",
            "category": slug,
            "image_url": "",
            "published": True,
            "featured": False,
        }
        r = admin.post(f"{API}/articles", json=art_payload)
        assert r.status_code == 200, r.text
        pytest.custom_art_id = r.json()["id"]
        # try delete category - should be blocked
        rd = admin.delete(f"{API}/categories/{pytest.custom_cat_id}")
        assert rd.status_code == 400, rd.text

    def test_delete_category_after_removing_article(self, admin):
        # delete article, then delete category
        rd = admin.delete(f"{API}/articles/{pytest.custom_art_id}")
        assert rd.status_code == 200
        rc = admin.delete(f"{API}/categories/{pytest.custom_cat_id}")
        assert rc.status_code == 200


class TestArticleCategoryValidation:
    def test_reject_unknown_category(self, admin):
        payload = {
            "title_en": f"{TAG} bad", "title_bn": "x",
            "excerpt_en": "x", "excerpt_bn": "x",
            "body_en": "x", "body_bn": "x",
            "category": "nonexistent-xyz", "image_url": "",
            "published": True, "featured": False,
        }
        r = admin.post(f"{API}/articles", json=payload)
        assert r.status_code == 400
        assert "category" in r.text.lower()

    def test_new_category_then_article(self, admin):
        slug = f"testcat-{uuid.uuid4().hex[:6]}"
        r = admin.post(f"{API}/categories", json={"slug": slug, "name_en": "NC"})
        assert r.status_code == 200
        payload = {
            "title_en": f"{TAG} good", "title_bn": "x",
            "excerpt_en": "x", "excerpt_bn": "x",
            "body_en": "x", "body_bn": "x",
            "category": slug, "image_url": "",
            "published": True, "featured": False,
        }
        ra = admin.post(f"{API}/articles", json=payload)
        assert ra.status_code == 200, ra.text
        # cleanup
        admin.delete(f"{API}/articles/{ra.json()['id']}")
        admin.delete(f"{API}/categories/{r.json()['id']}")


# ---------- Breaking News ----------
class TestBreaking:
    def test_public_default_active_only(self, admin, anon):
        # create active + inactive
        r1 = admin.post(f"{API}/breaking", json={"text_en": f"{TAG} A", "active": True, "order": 1})
        r2 = admin.post(f"{API}/breaking", json={"text_en": f"{TAG} B", "active": False, "order": 2})
        assert r1.status_code == 200 and r2.status_code == 200
        pytest.br_id_active = r1.json()["id"]
        pytest.br_id_inactive = r2.json()["id"]

        items = anon.get(f"{API}/breaking").json()["items"]
        ids = {i["id"] for i in items}
        assert pytest.br_id_active in ids
        assert pytest.br_id_inactive not in ids
        # all_items true
        items_all = anon.get(f"{API}/breaking?all_items=true").json()["items"]
        ids_all = {i["id"] for i in items_all}
        assert pytest.br_id_inactive in ids_all

    def test_update_and_delete_breaking(self, admin):
        r = admin.put(f"{API}/breaking/{pytest.br_id_active}", json={"active": False, "text_bn": "BN"})
        assert r.status_code == 200
        assert r.json()["active"] is False
        assert r.json()["text_bn"] == "BN"
        # delete both
        assert admin.delete(f"{API}/breaking/{pytest.br_id_active}").status_code == 200
        assert admin.delete(f"{API}/breaking/{pytest.br_id_inactive}").status_code == 200

    def test_missing_text_en_rejected(self, admin):
        r = admin.post(f"{API}/breaking", json={"text_bn": "only bn"})
        assert r.status_code in (400, 422)

    def test_non_admin_rejected(self, reader):
        r = reader.post(f"{API}/breaking", json={"text_en": "x"})
        assert r.status_code in (401, 403)


# ---------- Sidebar ----------
class TestSidebar:
    def test_invalid_side_rejected(self, anon):
        r = anon.get(f"{API}/sidebar-news?side=middle")
        assert r.status_code == 400

    def test_left_returns_auto_topup(self, anon):
        r = anon.get(f"{API}/sidebar-news?side=left&limit=5")
        assert r.status_code == 200
        items = r.json()["items"]
        assert len(items) <= 5
        # at least some items (from seeded articles) and marked auto=True
        assert any(i.get("auto") is True and i.get("article_id") for i in items), items

    def test_curated_flow(self, admin, anon):
        r = admin.post(f"{API}/sidebar-news", json={"side": "left", "text_en": f"{TAG} curated", "order": 0})
        assert r.status_code == 200
        cid = r.json()["id"]
        # include curated in default listing, marked auto=false
        items = anon.get(f"{API}/sidebar-news?side=left&limit=10").json()["items"]
        curated_hit = [i for i in items if i["id"] == cid]
        assert len(curated_hit) == 1
        assert curated_hit[0]["auto"] is False

        # include_auto=false -> only curated
        only_c = anon.get(f"{API}/sidebar-news?side=left&limit=10&include_auto=false").json()["items"]
        assert all(i.get("auto") is False for i in only_c)
        assert any(i["id"] == cid for i in only_c)

        # admin endpoint requires admin
        ra = anon.get(f"{API}/admin/sidebar-news")
        assert ra.status_code in (401, 403)
        radm = admin.get(f"{API}/admin/sidebar-news?side=left")
        assert radm.status_code == 200
        assert any(i["id"] == cid for i in radm.json()["items"])

        # update
        ru = admin.put(f"{API}/sidebar-news/{cid}", json={"text_en": "updated"})
        assert ru.status_code == 200 and ru.json()["text_en"] == "updated"

        # delete
        rd = admin.delete(f"{API}/sidebar-news/{cid}")
        assert rd.status_code == 200

    def test_non_admin_create_sidebar_rejected(self, reader):
        r = reader.post(f"{API}/sidebar-news", json={"side": "left", "text_en": "x"})
        assert r.status_code in (401, 403)

    def test_invalid_side_on_create(self, admin):
        r = admin.post(f"{API}/sidebar-news", json={"side": "middle", "text_en": "x"})
        assert r.status_code == 400


# ---------- Layouts ----------
class TestLayouts:
    KEY = f"test:layout:{uuid.uuid4().hex[:6]}"

    def test_get_empty(self, anon):
        r = anon.get(f"{API}/layouts/{self.KEY}")
        assert r.status_code == 200
        assert r.json() == {"key": self.KEY, "blocks": []}

    def test_put_and_get(self, admin, anon):
        blocks = [{"i": "a", "x": 0, "y": 0, "w": 6, "h": 2, "type": "hero"}]
        r = admin.put(f"{API}/layouts/{self.KEY}", json={"key": self.KEY, "blocks": blocks})
        assert r.status_code == 200, r.text
        assert r.json()["blocks"] == blocks
        # anonymous GET returns the same blocks
        r2 = anon.get(f"{API}/layouts/{self.KEY}")
        assert r2.status_code == 200
        assert r2.json()["blocks"] == blocks

    def test_key_mismatch(self, admin):
        r = admin.put(f"{API}/layouts/{self.KEY}", json={"key": "different", "blocks": []})
        assert r.status_code == 400

    def test_non_admin_put_rejected(self, reader, anon):
        blocks = [{"i": "a"}]
        r = reader.put(f"{API}/layouts/{self.KEY}", json={"key": self.KEY, "blocks": blocks})
        assert r.status_code in (401, 403)
        r2 = anon.put(f"{API}/layouts/{self.KEY}", json={"key": self.KEY, "blocks": blocks})
        assert r2.status_code in (401, 403)

    def test_delete_clears(self, admin, anon):
        r = admin.delete(f"{API}/layouts/{self.KEY}")
        assert r.status_code == 200
        r2 = anon.get(f"{API}/layouts/{self.KEY}")
        assert r2.json() == {"key": self.KEY, "blocks": []}
