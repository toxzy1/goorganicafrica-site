import importlib.util
import json
import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "update-directories.py"
SPEC = importlib.util.spec_from_file_location("update_directories", SCRIPT)
MONITOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MONITOR)

class DirectoryMonitorTests(unittest.TestCase):
    def setup_files(self, root, source):
        config, coverage, pending = root / "sources.json", root / "coverage.json", root / "pending"
        config.write_text(json.dumps({"sources": [source]}), encoding="utf-8")
        coverage.write_text(json.dumps({"countries": [{"name": "Testland", "active": True}]}), encoding="utf-8")
        return config, coverage, pending

    def test_new_changed_and_unchanged_pages_are_review_only(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = {"id":"test-source","country":"Testland","category":"grants","publisher":"Test Ministry",
                      "url":"https://example.gov.test/programmes","method":"official_page_review",
                      "frequency":"daily","status":"active","requires_review":True}
            config, coverage, pending = self.setup_files(root, source)
            page = {"body": b"<html>initial</html>"}
            state_path = pending / "state.json"
            with patch.object(MONITOR, "CONFIG", config), patch.object(MONITOR, "COVERAGE", coverage), \
                 patch.object(MONITOR, "PENDING", pending), patch.object(MONITOR, "STATE", state_path), \
                 patch.object(MONITOR, "get", side_effect=lambda url: page["body"]):
                MONITOR.main()
                latest = pending / "directory-candidates-latest.json"
                first = json.loads(latest.read_text(encoding="utf-8"))
                self.assertEqual(first["candidate_count"], 1)
                self.assertEqual(first["candidates"][0]["status"], "needs_review")
                self.assertEqual(first["candidates"][0]["action"], "review")
                files_before = sorted(p.name for p in pending.glob("directory-candidates-*.json"))
                MONITOR.main()
                self.assertEqual(sorted(p.name for p in pending.glob("directory-candidates-*.json")), files_before)
                page["body"] = b"<html>changed page</html>"
                state = json.loads(state_path.read_text(encoding="utf-8"))
                state["sources"]["test-source"]["last_checked"] = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
                state_path.write_text(json.dumps(state), encoding="utf-8")
                MONITOR.main()
                updated = json.loads(latest.read_text(encoding="utf-8"))
                self.assertEqual(updated["candidate_count"], 1)
                self.assertIn("changed", updated["candidates"][0]["reason"].lower())
                self.assertNotIn("directoryListings.json", [p.name for p in pending.iterdir()])

    def test_weekly_frequency_skips_early_checks(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = {"id":"weekly-source","country":"Testland","category":"finance","publisher":"Agency",
                      "url":"https://example.gov.test/finance","method":"official_page_review",
                      "frequency":"weekly","status":"active","requires_review":True}
            config, coverage, pending = self.setup_files(root, source)
            with patch.object(MONITOR, "CONFIG", config), patch.object(MONITOR, "COVERAGE", coverage), \
                 patch.object(MONITOR, "PENDING", pending), patch.object(MONITOR, "STATE", pending / "state.json"), \
                 patch.object(MONITOR, "get", return_value=b"page"):
                MONITOR.main()
                state_path = pending / "state.json"
                state = json.loads(state_path.read_text(encoding="utf-8"))
                state["sources"]["weekly-source"]["last_checked"] = datetime.now(timezone.utc).isoformat()
                state_path.write_text(json.dumps(state), encoding="utf-8")
                with patch.object(MONITOR, "get", side_effect=AssertionError("source checked too early")):
                    MONITOR.main()

    def test_failed_source_is_recorded_without_publishing(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = {"id":"unreachable-source","country":"Testland","category":"machinery","publisher":"Test Agency",
                      "url":"https://example.gov.test/machinery","method":"official_page_review",
                      "frequency":"daily","status":"active","requires_review":True}
            config, coverage, pending = self.setup_files(root, source)
            with patch.object(MONITOR, "CONFIG", config), patch.object(MONITOR, "COVERAGE", coverage), \
                 patch.object(MONITOR, "PENDING", pending), patch.object(MONITOR, "STATE", pending / "state.json"), \
                 patch.object(MONITOR, "get", side_effect=OSError("test connection failure")):
                MONITOR.main()
                payload = json.loads((pending / "directory-candidates-latest.json").read_text(encoding="utf-8"))
                self.assertEqual(payload["candidate_count"], 0)
                self.assertEqual(payload["errors"][0]["source"], "unreachable-source")
                self.assertNotIn("directoryListings.json", [p.name for p in pending.iterdir()])

if __name__ == "__main__":
    unittest.main()
