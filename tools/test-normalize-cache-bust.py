#!/usr/bin/env python3
"""Behavioural tests for tools/normalize-cache-bust.py.

The predecessor of that tool hardcoded an old token and always wrote, so running
it reverted every cache-bust bump on the site. These tests pin the two properties
that stop it happening again: the target is the NEWEST token in the tree, and
nothing is written without --apply.
"""
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

TOOL = Path(__file__).resolve().parent / 'normalize-cache-bust.py'

NEW = '<link rel="stylesheet" href="styles.min.css?v=2026-09-08-editorial">\n'
OLD = '<link rel="stylesheet" href="styles.min.css?v=2026-05-09-v1">\n'
PROSE = '<p><code>styles.min.css?v=2026-05-09-v1</code> was the May token.</p>\n'


def run(root, *args):
    """Run the tool against a throwaway tree by pointing ROOT at it."""
    source = TOOL.read_text(encoding='utf-8').replace(
        "ROOT = Path(__file__).resolve().parent.parent",
        f"ROOT = Path({str(root)!r})")
    harness = root / '_tool.py'
    harness.write_text(source, encoding='utf-8')
    return subprocess.run([sys.executable, str(harness), *args],
                          capture_output=True, text=True)


class NormalizeCacheBust(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / 'new.html').write_text(NEW, encoding='utf-8')
        (self.root / 'old.html').write_text(OLD, encoding='utf-8')

    def tearDown(self):
        self.tmp.cleanup()

    def test_check_is_the_default_and_writes_nothing(self):
        before = (self.root / 'old.html').read_text(encoding='utf-8')
        result = run(self.root)
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn('2 different tokens', result.stdout)
        self.assertEqual((self.root / 'old.html').read_text(encoding='utf-8'), before,
                         'a report must not modify the tree')

    def test_apply_converges_on_the_newest_token_never_an_older_one(self):
        result = run(self.root, '--apply')
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('2026-09-08-editorial', (self.root / 'old.html').read_text(encoding='utf-8'))
        self.assertIn('2026-09-08-editorial', (self.root / 'new.html').read_text(encoding='utf-8'))
        self.assertNotIn('2026-05-09-v1', (self.root / 'old.html').read_text(encoding='utf-8'))

    def test_clean_tree_reports_clean_and_exits_zero(self):
        (self.root / 'old.html').write_text(NEW, encoding='utf-8')
        result = run(self.root)
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('CLEAN', result.stdout)

    def test_documentation_prose_is_not_a_tag(self):
        (self.root / 'old.html').write_text(NEW + PROSE, encoding='utf-8')
        result = run(self.root, '--apply')
        self.assertEqual(result.returncode, 0, result.stdout)
        self.assertIn('<code>styles.min.css?v=2026-05-09-v1</code>',
                      (self.root / 'old.html').read_text(encoding='utf-8'),
                      'prose quoting an old token is documentation, not a load')

    def test_check_is_a_word_this_tool_answers_to(self):
        """Every ship gate on this site types --check. The v1.10.12 tool accepted it and WROTE;
        the rewrite refused it with 'unrecognized arguments'. Both are wrong in the same way — the
        caller's word and the tool's behaviour have to be the same thing."""
        before = (self.root / 'old.html').read_text(encoding='utf-8')
        result = run(self.root, '--check')
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn('2 different tokens', result.stdout)
        self.assertEqual((self.root / 'old.html').read_text(encoding='utf-8'), before,
                         '--check may never modify the tree')

    def test_check_and_apply_together_are_refused(self):
        result = run(self.root, '--check', '--apply')
        self.assertEqual(result.returncode, 2, result.stdout)


if __name__ == '__main__':
    unittest.main(verbosity=2)
