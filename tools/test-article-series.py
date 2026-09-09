import importlib.util
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("article_series", ROOT / "tools/sync-article-series.py")
SERIES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SERIES)


class ArticleSeriesTests(unittest.TestCase):
    def test_published_navigation_is_current(self):
        changes = SERIES.collect_changes(ROOT)
        self.assertEqual([], [name for name, before, after in changes])

    def test_next_publication_updates_previous_tail(self):
        current = SERIES.published_families(ROOT)["article"]
        next_name = f"article-{int(current[-1].split('-')[1].split('.')[0]) + 1}.html"
        names = current + [next_name]
        position = len(current) - 1
        before = (ROOT / current[-1]).read_text()
        after = SERIES.sync_navigation(before, names, position)
        after = SERIES.sync_footer(after, names, position)
        self.assertIn(f"Article {len(current)} of {len(names)}", after)
        self.assertEqual(2, after.count(f'href="{next_name}"'))
        self.assertNotIn("Latest Article", after)
        self.assertEqual(after, SERIES.sync_navigation(after, names, position))

    def test_missing_navigation_fails_closed(self):
        with self.assertRaises(ValueError):
            SERIES.sync_navigation("<html></html>", ["article-1.html"], 0)

    def test_independent_family_counts(self):
        before = (ROOT / "FF-1.html").read_text()
        after = SERIES.sync_navigation(before, ["FF-1.html", "FF-2.html"], 0)
        self.assertIn("Future Forward &mdash; Article 1 of 2", after)
        self.assertIn('href="FF-2.html"', after)


if __name__ == "__main__":
    unittest.main()
