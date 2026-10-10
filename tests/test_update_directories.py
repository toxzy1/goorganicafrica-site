import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "update-directories.py"
SPEC = importlib.util.spec_from_file_location("update_directories", SCRIPT)
MONITOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MONITOR)


class DirectoryMonitorTests(unittest.TestCase):
    def test_candidates_are_review_only_and_unchanged_runs_are_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            config = root / "sources.json"
            coverage = root / "coverage.json"
            pending = root / "pending"
            config.write_text(json.dumps({"sources": [{
                "id": "test-official-source",
                "country": "Testland",
                "category": "grants",
                "publisher": "Test Ministry",
                "url": "https://example.gov.test/programmes",
                "method": "official_page_review",
                "status": "active",
                "requires_review": True
            }]}), encoding="utf-8")
            coverage.write_text(json.dumps({"countries": [
                {"name": "Testland", "active": True}
            ]}), encoding="utf-8")

            with patch.object(MONITOR, "CONFIG", config), \
                 patch.object(MONITOR, "COVERAGE", coverage), \
                 patch.object(MONITOR, "PENDING", pending), \
                 patch.object(MONITOR, "get", return_value=b"<html>official programme page</html>"):
                MONITOR.main()
                latest = pending / "directory-candidates-latest.json"
                first_payload = latest.read_text(encoding="utf-8")
                first = json.loads(first_payload)

                self.assertEqual(first["candidate_count"], 1)
                self.assertEqual(first["candidates"][0]["status"], "needs_review")
                self.assertEqual(first["candidates"][0]["action"], "review")
                self.assertIn("fingerprint", first["candidates"][0]["notes"].lower())

                generated_files_before = sorted(p.name for p in pending.glob("directory-candidates-*.json"))
                MONITOR.main()
                generated_files_after = sorted(p.name for p in pending.glob("directory-candidates-*.json"))

                self.assertEqual(generated_files_after, generated_files_before)
                self.assertEqual(latest.read_text(encoding="utf-8"), first_payload)

    def test_failed_source_is_recorded_without_publishing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            config = root / "sources.json"
            coverage = root / "coverage.json"
            pending = root / "pending"
            config.write_text(json.dumps({"sources": [{
                "id": "unreachable-source",
                "country": "Testland",
                "category": "machinery",
                "publisher": "Test Agency",
                "url": "https://example.gov.test/machinery",
                "method": "official_page_review",
                "status": "active",
                "requires_review": True
            }]}), encoding="utf-8")
            coverage.write_text(json.dumps({"countries": [
                {"name": "Testland", "active": True}
            ]}), encoding="utf-8")

            with patch.object(MONITOR, "CONFIG", config), \
                 patch.object(MONITOR, "COVERAGE", coverage), \
                 patch.object(MONITOR, "PENDING", pending), \
                 patch.object(MONITOR, "get", side_effect=OSError("test connection failure")):
                MONITOR.main()
                payload = json.loads((pending / "directory-candidates-latest.json").read_text(encoding="utf-8"))
                self.assertEqual(payload["candidate_count"], 0)
                self.assertEqual(payload["errors"][0]["source"], "unreachable-source")
                self.assertFalse(any(p.name == "directoryListings.json" for p in pending.iterdir()))


if __name__ == "__main__":
    unittest.main()
