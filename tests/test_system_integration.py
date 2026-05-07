import json
import sys
import time
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch


REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

import backend.app as app_module  # noqa: E402


class SystemIntegrationTests(TestCase):
    @classmethod
    def setUpClass(cls):
        app_module.app.config.update(TESTING=True)

    def setUp(self):
        self.client = app_module.app.test_client()

    def test_cache_hit_serves_cached_billionaires_without_network(self):
        with TemporaryDirectory() as tmp_dir:
            cache_dir = Path(tmp_dir)
            cache_file = cache_dir / "cache.json"
            cached_data = [
                {
                    "id": "cached-1",
                    "name": "Cache One",
                    "wealth": 111,
                    "rank": 1,
                }
            ]
            cache_file.write_text(
                json.dumps(
                    {
                        "version": app_module.CACHE_VERSION,
                        "timestamp": time.time(),
                        "data": cached_data,
                    }
                )
            )

            with patch.object(app_module, "CACHE_DIR", str(cache_dir)), patch.object(
                app_module, "CACHE_FILE", str(cache_file)
            ), patch.object(
                app_module,
                "fetch_billionaires",
                side_effect=AssertionError("Live fetch should not be called for a warm cache."),
            ):
                response = self.client.get("/api/billionaires")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.get_json(), cached_data)

    def test_live_billionaires_merge_history_and_write_cache(self):
        with TemporaryDirectory() as tmp_dir:
            cache_dir = Path(tmp_dir)
            cache_file = cache_dir / "cache.json"
            live_people = [
                {
                    "id": "person-1",
                    "name": "Person One",
                    "wealth": 123,
                    "rank": 1,
                },
                {
                    "id": "person-2",
                    "name": "Person Two",
                    "wealth": 456,
                    "rank": 2,
                },
            ]
            history = {
                "person-1": {"last_year_wealth": 99},
            }

            with patch.object(app_module, "CACHE_DIR", str(cache_dir)), patch.object(
                app_module, "CACHE_FILE", str(cache_file)
            ), patch.object(
                app_module, "load_cache", return_value=None
            ), patch.object(
                app_module, "load_history", return_value=history
            ), patch.object(
                app_module, "fetch_billionaires", return_value=live_people
            ):
                response = self.client.get("/api/billionaires")

            self.assertEqual(response.status_code, 200)
            data = response.get_json()
            self.assertEqual(len(data), 2)
            self.assertEqual(data[0]["last_year_wealth"], 99)
            self.assertEqual(data[1]["last_year_wealth"], 456)

            saved_cache = json.loads(cache_file.read_text())
            self.assertEqual(saved_cache["version"], app_module.CACHE_VERSION)
            self.assertEqual(saved_cache["data"], data)
            self.assertIn("timestamp", saved_cache)

    def test_detail_routes_normalize_person_records(self):
        raw_people = [
            {
                "id": "alpha",
                "name": "Alpha",
                "image": "https://example.com/alpha.jpg",
                "worth_as_of": "2026-01-01",
                "rank": 12,
                "quote": "Hello world.",
                "about": ["Alpha fact"],
                "personal_stats": [
                    {"label": "Residence", "value": "Austin, Texas"},
                    {"label": "Source of wealth", "value": "Tesla, Automotive"},
                    {"label": "Philanthropy score", "value": "4"},
                    {"label": "Self-made score", "value": "8"},
                ],
            },
            {
                "id": "beta",
                "name": "Beta",
                "personal_stats": [
                    {"label": "Residence", "value": "Monaco"},
                    {"label": "Source of wealth", "value": "Investing, Finance"},
                    {"label": "Philanthropy score", "value": "not a number"},
                    {"label": "Self-made score", "value": "7"},
                ],
            },
        ]

        with patch.object(app_module, "load_full_person_details", return_value=raw_people):
            list_response = self.client.get("/api/billionaires/details")
            search_response = self.client.get("/api/billionaires/details/search?q=alpha")

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(search_response.status_code, 200)

        list_data = list_response.get_json()
        search_data = search_response.get_json()

        self.assertEqual(list_data, search_data)
        self.assertEqual(list_data[0]["residence"], "Austin, Texas")
        self.assertEqual(list_data[0]["state"], "Texas")
        self.assertEqual(list_data[0]["country"], "United States")
        self.assertEqual(list_data[0]["industry"], "Tesla")
        self.assertEqual(list_data[0]["philanthropy_score"], 4)
        self.assertEqual(list_data[0]["self_made_score"], 8)
        self.assertEqual(list_data[0]["about"], ["Alpha fact"])

        self.assertEqual(list_data[1]["residence"], "Monaco")
        self.assertEqual(list_data[1]["state"], "")
        self.assertEqual(list_data[1]["country"], "Monaco")
        self.assertEqual(list_data[1]["industry"], "Investing")
        self.assertIsNone(list_data[1]["philanthropy_score"])
        self.assertEqual(list_data[1]["self_made_score"], 7)

    def test_frontend_root_includes_lookup_and_years_wiring(self):
        response = self.client.get("/")

        try:
            self.assertEqual(response.status_code, 200)
            self.assertIn("text/html", response.headers.get("Content-Type", ""))

            html = response.get_data(as_text=True)
            required_fragments = [
                'id="comparison-lookup-input"',
                'id="comparison-lookup-add"',
                'id="comparison-lookup-remove"',
                'id="comparison-lookup-results"',
                'id="facts-years"',
                'src="main.js"',
                'src="comparison.js"',
                'src="explorer.js"',
            ]

            for fragment in required_fragments:
                with self.subTest(fragment=fragment):
                    self.assertIn(fragment, html)
        finally:
            response.close()
