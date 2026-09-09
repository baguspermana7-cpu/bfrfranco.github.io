import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SPAN_CLASSES = {
    'article-21.html': 'a21-stat',
    'article-22.html': 'a22-stat',
    'article-23.html': 'col-stat',
    'article-24.html': 'dcj-stat',
    'article-25.html': 'pjm-stat',
    'article-26.html': 'pfas-stat',
    'article-27.html': 'ws-stat',
    'article-28.html': 'ws-stat',
    **{f'geopolitics-{number}.html': 'stat-highlight' for number in range(1, 4)},
}


def declarations(source, selector):
    match = re.search(re.escape(selector) + r'\s*\{([^}]+)\}', source)
    if not match:
        raise AssertionError(f'Missing selector: {selector}')
    return dict(re.findall(r'([\w-]+)\s*:\s*([^;]+);', match.group(1)))


class InlineProseStyles(unittest.TestCase):
    def test_only_named_prose_spans_are_normalized(self):
        for filename, class_name in SPAN_CLASSES.items():
            with self.subTest(page=filename):
                source = (ROOT / filename).read_text()
                self.assertIn(f'class="{class_name}"', source)
                rule = declarations(source, f'.article-body :is(p,li) span.{class_name}')
                for property_name, value in {
                    'background': 'transparent', 'font': 'inherit',
                    'color': 'inherit', 'padding': '0', 'border': '0',
                    'display': 'inline', 'white-space': 'normal',
                    'font-weight': '700',
                }.items():
                    self.assertEqual(rule.get(property_name), value, property_name)

    def test_article_eight_references_flow_without_flex_fragments(self):
        source = (ROOT / 'article-8.html').read_text()
        grid = declarations(source, 'ol.ref-list')
        self.assertEqual(grid.get('grid-template-columns'), 'minmax(0,1fr)')
        item = declarations(source, 'ol.ref-list li')
        self.assertEqual(item.get('display'), 'block')
        self.assertEqual(item.get('min-width'), '0')
        self.assertEqual(item.get('overflow-wrap'), 'anywhere')

    def test_governance_mobile_grid_overrides_inline_columns(self):
        source = (ROOT / 'article-13.html').read_text()
        mobile = source.split('/* Responsive */', 1)[1]
        grid = declarations(mobile, '.aig-kpi-grid')
        self.assertEqual(grid.get('grid-template-columns'),
                         'repeat(auto-fit, minmax(min(100%, 140px), 1fr)) !important')
        card = declarations(source, '.aig-kpi-card')
        self.assertEqual(card.get('min-width'), '0')
        self.assertEqual(card.get('overflow-wrap'), 'anywhere')

    def test_references_have_shrinkable_tracks_and_flowing_text(self):
        source = (ROOT / 'article-7.html').read_text()
        grid = declarations(source, '.references-list')
        self.assertEqual(grid.get('grid-template-columns'), 'minmax(0,1fr)')
        item = declarations(source, '.reference-item')
        self.assertEqual(item.get('display'), 'block')
        self.assertEqual(item.get('min-width'), '0')
        self.assertEqual(item.get('overflow-wrap'), 'anywhere')


if __name__ == '__main__':
    unittest.main()
