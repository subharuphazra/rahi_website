"""Phase 5 backend tests: Scheduled Breaking Headlines (start_at / end_at)."""
import os
import uuid
from datetime import datetime, timedelta, timezone
import pytest
import requests

BASE_URL = os.environ.get(
    "BACKEND_TEST_URL",
    "https://0c2b6ec2-46d8-46b0-a4fe-96cf47296641.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "rahipatrika@gmail.com"
ADMIN_PASSWORD = "Thanksc#2u"
TAG = f"TEST_P5_{uuid.uuid4().hex[:6]}"


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


@pytest.fixture(scope="module")
def admin():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    tok = r.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


@pytest.fixture(scope="module")
def anon():
    return requests.Session()


@pytest.fixture(scope="module")
def reader():
    s = requests.Session()
    email = f"reader_{uuid.uuid4().hex[:6]}@example.com"
    pw = "Reader@2026x"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "Reader"}, timeout=30)
    if r.status_code not in (200, 201):
        pytest.skip(f"reader register failed: {r.status_code} {r.text}")
    tok = r.json().get("access_token")
    if not tok:
        rr = s.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=30)
        tok = rr.json()["access_token"]
    s.headers.update({"Authorization": f"Bearer {tok}"})
    return s


_created_ids = []


@pytest.fixture(autouse=True, scope="module")
def _cleanup(admin):
    yield
    for _id in _created_ids:
        try:
            admin.delete(f"{API}/breaking/{_id}", timeout=10)
        except Exception:
            pass


def _create(admin, **payload):
    r = admin.post(f"{API}/breaking", json=payload, timeout=15)
    return r


class TestBreakingScheduleCreate:
    def test_live_no_schedule(self, admin, anon):
        r = _create(admin, text_en=f"{TAG} live", active=True, order=100)
        assert r.status_code == 200, r.text
        body = r.json()
        _created_ids.append(body["id"])
        assert body["start_at"] is None
        assert body["end_at"] is None
        # public list contains it
        items = anon.get(f"{API}/breaking").json()["items"]
        assert any(i["id"] == body["id"] for i in items), "live item missing from public list"

    def test_future_start_hidden_from_public(self, admin, anon):
        future = _iso(datetime.now(timezone.utc) + timedelta(hours=2))
        r = _create(admin, text_en=f"{TAG} scheduled", active=True, order=101, start_at=future)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        _created_ids.append(bid)
        assert r.json()["start_at"] == future
        # NOT in public list
        pub = anon.get(f"{API}/breaking").json()["items"]
        assert not any(i["id"] == bid for i in pub), "scheduled future item leaked to public"
        # IS in all_items
        all_ = anon.get(f"{API}/breaking?all_items=true").json()["items"]
        assert any(i["id"] == bid for i in all_)

    def test_past_end_expired_hidden(self, admin, anon):
        past_start = _iso(datetime.now(timezone.utc) - timedelta(hours=2))
        past_end = _iso(datetime.now(timezone.utc) - timedelta(hours=1))
        r = _create(admin, text_en=f"{TAG} expired", active=True, order=102,
                    start_at=past_start, end_at=past_end)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        _created_ids.append(bid)
        pub = anon.get(f"{API}/breaking").json()["items"]
        assert not any(i["id"] == bid for i in pub), "expired item leaked to public"
        all_ = anon.get(f"{API}/breaking?all_items=true").json()["items"]
        assert any(i["id"] == bid for i in all_)

    def test_currently_within_window_visible(self, admin, anon):
        start = _iso(datetime.now(timezone.utc) - timedelta(minutes=5))
        end = _iso(datetime.now(timezone.utc) + timedelta(hours=1))
        r = _create(admin, text_en=f"{TAG} window", active=True, order=103,
                    start_at=start, end_at=end)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        _created_ids.append(bid)
        pub = anon.get(f"{API}/breaking").json()["items"]
        assert any(i["id"] == bid for i in pub), "in-window item missing from public"

    def test_end_before_start_rejected(self, admin):
        s = _iso(datetime.now(timezone.utc) + timedelta(hours=2))
        e = _iso(datetime.now(timezone.utc) + timedelta(hours=1))
        r = _create(admin, text_en=f"{TAG} bad", start_at=s, end_at=e)
        assert r.status_code == 400, r.text

    def test_end_equal_start_rejected(self, admin):
        s = _iso(datetime.now(timezone.utc) + timedelta(hours=1))
        r = _create(admin, text_en=f"{TAG} bad2", start_at=s, end_at=s)
        assert r.status_code == 400, r.text

    def test_malformed_start_rejected(self, admin):
        r = _create(admin, text_en=f"{TAG} bad3", start_at="not-a-date")
        assert r.status_code == 400, r.text

    def test_malformed_end_rejected(self, admin):
        r = _create(admin, text_en=f"{TAG} bad4", end_at="tomorrow")
        assert r.status_code == 400, r.text


class TestBreakingScheduleUpdate:
    def test_update_start_and_end(self, admin, anon):
        r = _create(admin, text_en=f"{TAG} upd", active=True, order=110)
        assert r.status_code == 200
        bid = r.json()["id"]
        _created_ids.append(bid)
        # confirm live
        assert any(i["id"] == bid for i in anon.get(f"{API}/breaking").json()["items"])
        # Reschedule to future
        future = _iso(datetime.now(timezone.utc) + timedelta(hours=3))
        ru = admin.put(f"{API}/breaking/{bid}", json={"start_at": future})
        assert ru.status_code == 200, ru.text
        assert ru.json()["start_at"] == future
        # No longer public
        assert not any(i["id"] == bid for i in anon.get(f"{API}/breaking").json()["items"])

    def test_clear_start_with_empty_string(self, admin, anon):
        future = _iso(datetime.now(timezone.utc) + timedelta(hours=3))
        r = _create(admin, text_en=f"{TAG} clr", active=True, order=111, start_at=future)
        assert r.status_code == 200
        bid = r.json()["id"]
        _created_ids.append(bid)
        # not public (future)
        assert not any(i["id"] == bid for i in anon.get(f"{API}/breaking").json()["items"])
        # clear start_at with empty string
        ru = admin.put(f"{API}/breaking/{bid}", json={"start_at": ""})
        assert ru.status_code == 200, ru.text
        assert ru.json()["start_at"] is None
        # now live
        assert any(i["id"] == bid for i in anon.get(f"{API}/breaking").json()["items"])

    def test_update_malformed_rejected(self, admin):
        r = _create(admin, text_en=f"{TAG} updbad", active=True, order=112)
        bid = r.json()["id"]
        _created_ids.append(bid)
        ru = admin.put(f"{API}/breaking/{bid}", json={"start_at": "xyz"})
        assert ru.status_code == 400


class TestBreakingScheduleAuth:
    def test_reader_create_rejected(self, reader):
        r = reader.post(f"{API}/breaking",
                        json={"text_en": f"{TAG} nope",
                              "start_at": _iso(datetime.now(timezone.utc) + timedelta(hours=1))})
        assert r.status_code in (401, 403)

    def test_anon_create_rejected(self, anon):
        r = anon.post(f"{API}/breaking", json={"text_en": f"{TAG} nope"})
        assert r.status_code in (401, 403)

    def test_reader_update_rejected(self, admin, reader):
        r = _create(admin, text_en=f"{TAG} adm", active=True, order=120)
        bid = r.json()["id"]
        _created_ids.append(bid)
        ru = reader.put(f"{API}/breaking/{bid}", json={"start_at": _iso(datetime.now(timezone.utc))})
        assert ru.status_code in (401, 403)


class TestBackwardCompat:
    def test_legacy_item_still_live(self, admin, anon):
        # Simulated by creating without schedule fields; still needs to be live
        r = _create(admin, text_en=f"{TAG} legacy", active=True, order=130)
        assert r.status_code == 200
        bid = r.json()["id"]
        _created_ids.append(bid)
        assert r.json()["start_at"] is None and r.json()["end_at"] is None
        assert any(i["id"] == bid for i in anon.get(f"{API}/breaking").json()["items"])


class TestHealth:
    def test_root(self, anon):
        r = anon.get(f"{API}/")
        assert r.status_code == 200
        assert "service" in r.json()

    def test_health_endpoints(self, anon):
        for path in ("/health", "/health/live", "/health/ready"):
            r = anon.get(f"{BASE_URL}{path}", timeout=10)
            # allow 200 or 404 — endpoint may or may not exist at root
            assert r.status_code in (200, 404), f"{path} → {r.status_code}"
