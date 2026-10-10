import importlib.util
import json
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Keep these unit tests runnable in the lightweight site-build job without
# downloading Argos models or installing the optional translation engine.
try:
    import argostranslate  # noqa: F401
except ModuleNotFoundError:
    argos_stub = types.ModuleType("argostranslate")
    argos_stub.__path__ = []
    package_stub = types.ModuleType("argostranslate.package")
    translate_stub = types.ModuleType("argostranslate.translate")
    translate_stub.translate = lambda text, source, target: text
    argos_stub.package = package_stub
    argos_stub.translate = translate_stub
    sys.modules["argostranslate"] = argos_stub
    sys.modules["argostranslate.package"] = package_stub
    sys.modules["argostranslate.translate"] = translate_stub

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "translate-agricultural-news.py"
SPEC = importlib.util.spec_from_file_location("translate_agricultural_news", SCRIPT)
TRANSLATOR = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = TRANSLATOR
SPEC.loader.exec_module(TRANSLATOR)


class TranslationDraftTests(unittest.TestCase):
    def test_url_and_numeric_values_are_preserved(self):
        original = "Use 12.5% less water; read https://example.com/path?id=42"
        with patch.object(TRANSLATOR.argostranslate.translate, "translate", side_effect=lambda text, source, target: text):
            result = TRANSLATOR.translate_value(original, "fr", {})
        self.assertEqual(result, original)

    def test_existing_translations_are_preserved_and_batch_is_capped(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            base_path = root / "agriculturalNews.json"
            supplement_path = root / "agriculturalNewsSupplement.json"
            articles = []
            for index in range(26):
                article = {
                    "title": f"Title {index}",
                    "summary": f"Summary {index}",
                    "url": f"https://example.com/{index}",
                }
                if index == 0:
                    article["translations"] = {
                        "fr": {"title": "Titre déjà validé", "summary": "Résumé déjà validé"}
                    }
                articles.append(article)
            base_path.write_text(json.dumps({"countries": [{"code": "NG", "articles": articles}]}), encoding="utf-8")
            supplement_path.write_text(json.dumps({"records": []}), encoding="utf-8")

            with patch.object(TRANSLATOR, "ROOT", root), \
                 patch.object(TRANSLATOR, "FILES", (base_path, supplement_path)), \
                 patch.object(TRANSLATOR, "install_models"), \
                 patch.object(TRANSLATOR, "translate_value", side_effect=lambda value, target, cache: f"{target}:{value}"):
                TRANSLATOR.main()

            result = json.loads(base_path.read_text(encoding="utf-8"))
            saved = result["countries"][0]["articles"]
            drafted = [item for item in saved if item.get("translation_review_status") == "pending_human_review"]
            self.assertEqual(len(drafted), 25)
            self.assertNotIn("translation_review_status", saved[25])
            self.assertEqual(saved[0]["translations"]["fr"]["title"], "Titre déjà validé")
            self.assertEqual(saved[0]["translations"]["fr"]["summary"], "Résumé déjà validé")
            self.assertTrue(saved[0]["translations"]["ar"]["title"].startswith("ar:"))
            self.assertTrue(saved[0]["translations"]["sw"]["summary"].startswith("sw:"))

    def test_install_models_preflights_all_pairs_before_installing(self):
        packages = [
            types.SimpleNamespace(from_code="en", to_code=target, install=MagicMock())
            for target in ("fr", "ar", "pt", "sw")
        ]
        installed = [types.SimpleNamespace(from_code="en", to_code="fr")]
        with (
            patch.object(TRANSLATOR.argostranslate.package, "update_package_index", create=True),
            patch.object(TRANSLATOR.argostranslate.package, "get_available_packages", return_value=packages, create=True),
            patch.object(TRANSLATOR.argostranslate.package, "get_installed_packages", return_value=installed, create=True),
        ):
            TRANSLATOR.install_models()
        self.assertEqual([p.to_code for p in packages if p.install.called], ["ar", "pt", "sw"])

    def test_missing_model_fails_before_any_download(self):
        french = types.SimpleNamespace(from_code="en", to_code="fr", install=MagicMock())
        with (
            patch.object(TRANSLATOR.argostranslate.package, "update_package_index", create=True),
            patch.object(TRANSLATOR.argostranslate.package, "get_available_packages", return_value=[french], create=True),
            patch.object(TRANSLATOR.argostranslate.package, "get_installed_packages", return_value=[], create=True),
        ):
            with self.assertRaisesRegex(RuntimeError, "en->ar"):
                TRANSLATOR.install_models()
        french.install.assert_not_called()


if __name__ == "__main__":
    unittest.main()
