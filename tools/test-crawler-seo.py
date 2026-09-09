#!/usr/bin/env python3
"""Offline crawler regressions; run with python3 tools/test-crawler-seo.py."""

import importlib.util
from pathlib import Path
import tempfile
import subprocess
import sys
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET


TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
SPEC = importlib.util.spec_from_file_location("sitemap_builder", TOOLS / "build-sitemap.py")
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)
sys.path.insert(0, str(TOOLS))
import crawler_inventory  # noqa: E402
import crawler_llms  # noqa: E402


class SitemapRegressionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

    def page(self, name, head):
        target = self.root / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text("<html><head>" + head + "</head><body></body></html>")
        return str(target)

    def test_late_reversed_and_bot_specific_noindex(self):
        for directive in ("robots", "googlebot", "bingbot"):
            path = self.page("page.html", " " * 4000 +
                             f"<meta content='INDEX, NOINDEX' name='{directive}'>")
            self.assertTrue(BUILDER.is_noindex(path))

    def test_multiple_meta_restrictive_wins_and_none_alias(self):
        path = self.page("page.html", '<meta name=robots content=index>'
                         '<meta name=robots content=none>')
        self.assertTrue(BUILDER.is_noindex(path))

    def test_comments_do_not_supply_metadata(self):
        path = self.page("page.html", '<!-- <meta name=robots content=noindex> -->')
        self.assertFalse(BUILDER.is_noindex(path))

    def test_body_robots_are_restrictive_but_not_other_head_metadata(self):
        from crawler_inventory import read_metadata
        for agent in ('robots', 'googlebot', 'bingbot', 'googlebot-news'):
            path = self.page('page.html', '<title>Public title</title>')
            Path(path).write_text(Path(path).read_text() +
                                 f'<meta content="none" name="{agent}"/>'
                                 '<link rel=canonical href="https://example.com/">'
                                 '<title>Body title</title>')
            metadata = read_metadata(path)
            self.assertTrue(metadata.noindex)
            self.assertEqual(metadata.canonicals, [])
            self.assertEqual(metadata.title_parts, ['Public title'])

    def full_export(self, name, source):
        path = self.page(name, '')
        Path(path).write_text(source)
        report = self.inventory()
        spec = importlib.util.spec_from_file_location('llm_full', TOOLS / 'build-llms-full.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.build_content(self.root, report)

    def test_full_main_preserves_nested_articles_and_later_sections(self):
        content = self.full_export('page.html', '<html><head></head><body>'
            '<nav><nav>NESTED NAV</nav>NAV TAIL</nav><main data-note="a > b">'
            '<h1>INTRO SENTINEL</h1><article>' + 'First card ' * 30 +
            '<article>INNER SENTINEL</article>AFTER INNER</article>'
            '<article>SECOND CARD</article><section>FINAL SENTINEL</section>'
            '<footer><div>FOOTER SECRET</div></footer></main></body></html>')
        for sentinel in ('INTRO SENTINEL', 'INNER SENTINEL', 'AFTER INNER',
                         'SECOND CARD', 'FINAL SENTINEL'):
            self.assertIn(sentinel, content)
        for sentinel in ('NESTED NAV', 'NAV TAIL', 'FOOTER SECRET'):
            self.assertNotIn(sentinel, content)

    def test_body_fallback_preserves_all_articles_and_escaped_text(self):
        content = self.full_export('page.html', '<html><head></head><body>'
            '<article>' + 'First card ' * 30 + '</article><article>SECOND CARD</article>'
            '<p>keep &lt;placeholder&gt; and 1 &lt; 2</p>'
            '<script>"<main>FAKE MAIN</main>"</script>'
            '<template><template>HIDDEN</template>HIDDEN TAIL</template></body></html>')
        self.assertIn('SECOND CARD', content)
        self.assertIn('<placeholder>', content)
        self.assertIn('1 < 2', content)
        self.assertNotIn('FAKE MAIN', content)
        self.assertNotIn('HIDDEN', content)

    def test_body_noindex_is_omitted_from_both_exports(self):
        content = self.full_export('private.html', '<html><head></head><body>'
            '<meta name=robots content=noindex><main>PRIVATE SENTINEL</main></body></html>')
        self.assertNotIn('PRIVATE SENTINEL', content)
        self.assertNotIn('https://resistancezero.com/private.html', content)
        spec = importlib.util.spec_from_file_location('llm_map', TOOLS / 'build-llms-txt.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        self.assertNotIn('https://resistancezero.com/private.html', module.build_content(self.root))

    def test_reviewed_hub_navigation_gate_does_not_hide_public_body(self):
        from crawler_inventory import read_metadata
        metadata = read_metadata(TOOLS.parent / 'datacenter-solutions.html')
        self.assertEqual(metadata.gate_reasons, set())

    def test_reviewed_hub_exception_fails_closed_on_structural_changes(self):
        from crawler_inventory import read_metadata
        source = (TOOLS.parent / 'datacenter-solutions.html').read_text()
        mutations = (
            source.replace("enforceTierFeatureAccess('standards-ltc-lab')",
                           "enforceTierFeatureAccess('datacenter-solutions')"),
            source.replace("rootCard.addEventListener('click', handleRootCardClick)",
                           'handleRootCardClick()'),
            source.replace('</body>', '<div class=pro-panel>PRIVATE</div></body>'),
            source.replace('</body>', '<script>enforceTierFeatureAccess("other")</script></body>'),
            source.replace('event.preventDefault();', 'document.body.remove();'),
            source.replace('href="standards-ltc-lab.html"', 'href="datacenter-solutions.html"'),
            source + '<script>enforceTierFeatureAccess("other")',
            source.replace('</body>', '<img onerror="enforceTierFeatureAccess(\'other\')"></body>'),
        )
        for changed in mutations:
            path = self.page('datacenter-solutions.html', '')
            Path(path).write_text(changed)
            self.assertTrue(read_metadata(path).gate_reasons)

    def test_generic_badges_and_unrecognized_navigation_remain_conservative(self):
        from crawler_inventory import read_metadata
        path = self.page('other-hub.html', '')
        Path(path).write_text('<html><head></head><body><span class=ds-badge-pro>PRO</span>'
                             '<script>enforceTierFeatureAccess("other")</script></body></html>')
        self.assertEqual(read_metadata(path).gate_reasons, {'gated-markup', 'runtime-access-check'})

    def test_main_selection_ignores_inert_main_and_keeps_multiple_real_mains(self):
        content = self.full_export('page.html', '<html><head></head><body>'
            '<template><main>INERT SENTINEL</main></template>'
            '<main><p>FIRST MAIN</p><br/><img src="image.png"/>AFTER VOID</main>'
            '<main>SECOND MAIN</main><footer>FOOTER SENTINEL</footer></body></html>')
        for sentinel in ('FIRST MAIN', 'AFTER VOID', 'SECOND MAIN'):
            self.assertIn(sentinel, content)
        self.assertNotIn('INERT SENTINEL', content)
        self.assertNotIn('FOOTER SENTINEL', content)

    def test_repository_export_contains_independent_late_section_sentinels(self):
        spec = importlib.util.spec_from_file_location('llm_full', TOOLS / 'build-llms-full.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        cases = {
            'prd/datahall.html': ('Product outcome', 'Decision supported', 'AC-01'),
            'manual/cdu-mini-bms.html': ('Example A', 'Example B'),
            'datacenter-solutions.html': ('Data Center', 'Do you store my calculation data?'),
        }
        from crawler_inventory import read_metadata
        for name, sentinels in cases.items():
            path = TOOLS.parent / name
            self.assertFalse(read_metadata(path).gate_reasons)
            content = module.extract_page(path, {
                'loc': 'https://resistancezero.com/' + name, 'content_policy': 'public-body'})
            for sentinel in sentinels:
                self.assertIn(sentinel, content, name)

    def test_late_canonical_and_exact_origin(self):
        path = self.page("page.html", " " * 4000 +
                         '<link href="https://resistancezero.com/page.html" rel=canonical>')
        self.assertEqual(BUILDER.get_canonical(path), 'https://resistancezero.com/page.html')
        path = self.page("page.html", '<link rel=canonical '
                         'href="https://resistancezero.com.evil.test/page.html">')
        self.assertIsNone(BUILDER.get_canonical(path))

    def test_unknown_lastmod_is_omitted_not_filesystem_time(self):
        path = self.page("page.html", "")
        with patch.object(BUILDER, "SITE_ROOT", str(self.root)):
            self.assertIsNone(BUILDER.get_lastmod(path))

    def test_xml_escapes_urls_and_omits_unknown_lastmod(self):
        xml = BUILDER.build_sitemap([
            ('https://resistancezero.com/page.html?a=1&b=2', None, 'monthly', 0.7, 'page.html')])
        root = ET.fromstring(xml)
        self.assertEqual(root.find('.//{*}loc').text,
                         'https://resistancezero.com/page.html?a=1&b=2')
        self.assertIsNone(root.find('.//{*}lastmod'))

    def inventory(self, robots="User-agent: *\nAllow: /\n"):
        from crawler_inventory import collect_inventory
        (self.root / "robots.txt").write_text(robots)
        subprocess.run(['git', 'init', '-q', str(self.root)], check=True)
        subprocess.run(['git', '-C', str(self.root), 'add', '.'], check=True)
        self.page('local-preview.html', '')
        return collect_inventory(self.root)

    def test_recursive_published_inventory_preserves_private_boundaries(self):
        for name in ('network/foundations/deep/topic.html', 'manual/deep/topic.html',
                     'Apps/private.html', 'unknown/draft.html', 'article-1.html'):
            self.page(name, '')
        report = self.inventory()
        rows = {row['path']: row for row in report['pages']}
        self.assertEqual(rows['network/foundations/deep/topic.html']['status'], 'included')
        self.assertEqual(rows['manual/deep/topic.html']['status'], 'included')
        self.assertEqual(rows['Apps/private.html']['status'], 'excluded-directory')
        self.assertEqual(rows['unknown/draft.html']['status'], 'unreviewed-directory')
        self.assertEqual(rows['local-preview.html']['status'], 'untracked')
        self.assertTrue(report['errors'])

    def test_canonical_alias_not_duplicated_and_invalid_target_fails(self):
        self.page('article-1.html', '<link rel=canonical href="https://resistancezero.com/article-1.html">')
        self.page('alias.html', '<link rel=canonical href="https://resistancezero.com/article-1.html">')
        self.page('bad.html', '<link rel=canonical href="https://resistancezero.com/missing.html">')
        self.page('external.html', '<link rel=canonical href="https://example.com/">')
        report = self.inventory()
        self.assertEqual(len([row for row in report['pages'] if row['status'] == 'included']), 1)
        self.assertTrue(any('missing.html' in error for error in report['errors']))

    def test_noindex_block_conflict_is_reported_without_unblocking(self):
        self.page('article-1.html', '<meta name=robots content=noindex>')
        report = self.inventory('User-agent: *\nDisallow: /article-1.html\n')
        self.assertEqual(report['pages'][0]['status'], 'noindex')
        self.assertTrue(any('noindex' in warning for warning in report['warnings']))

    def test_bot_groups_must_not_bypass_wildcard(self):
        from crawler_inventory import RobotsPolicy
        policy = RobotsPolicy('User-agent: *\nDisallow: /tools/\n'
                              'User-agent: GPTBot\nAllow: /\n')
        self.assertFalse(policy.allowed('*', '/tools/test.html'))
        self.assertTrue(policy.allowed('GPTBot', '/tools/test.html'))
        self.assertTrue(policy.restriction_errors())

    def test_shared_groups_longest_match_and_allow_tie(self):
        from crawler_inventory import RobotsPolicy
        policy = RobotsPolicy('User-agent: *\nUser-agent: GPTBot\n'
                              'Disallow: /tools/\nAllow: /tools/public$\n'
                              'Disallow: /same\nAllow: /same\n')
        for agent in ('*', 'GPTBot', 'Googlebot'):
            self.assertFalse(policy.allowed(agent, '/tools/test.html'))
            self.assertTrue(policy.allowed(agent, '/tools/public'))
            self.assertFalse(policy.allowed(agent, '/tools/public/child'))
            self.assertTrue(policy.allowed(agent, '/same'))
        self.assertEqual(policy.restriction_errors(), [])

    def test_multiple_canonicals_fail_closed(self):
        self.page('article-1.html', '<link rel=canonical href="/article-1.html">'
                  '<link rel=canonical href="/other.html">')
        report = self.inventory()
        self.assertEqual(report['pages'][0]['status'], 'invalid-canonical')
        self.assertTrue(report['errors'])

    def test_repository_robots_has_shared_restrictions_and_only_real_sitemap(self):
        from crawler_inventory import RobotsPolicy
        policy = RobotsPolicy((TOOLS.parent / 'robots.txt').read_text())
        self.assertEqual(policy.restriction_errors(), [])
        self.assertEqual(policy.sitemaps, ['https://resistancezero.com/sitemap.xml'])

    def test_audit_rejects_duplicate_missing_extra_and_unverified_dates(self):
        from crawler_audit import audit_sitemap
        self.page('article-1.html', '')
        report = self.inventory()
        sitemap = self.root / 'sitemap.xml'
        sitemap.write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
                           '<url><loc>https://resistancezero.com/other.html</loc>'
                           '<lastmod>2099-01-01</lastmod></url>'
                           '<url><loc>https://resistancezero.com/other.html</loc></url></urlset>')
        errors = audit_sitemap(sitemap, report)
        for finding in ('duplicate', 'missing', 'unexpected', 'lastmod'):
            self.assertTrue(any(finding in error for error in errors), (finding, errors))

    def test_audit_rejects_malformed_xml(self):
        from crawler_audit import audit_sitemap
        sitemap = self.root / 'sitemap.xml'
        sitemap.write_text('<urlset><url>')
        self.assertTrue(audit_sitemap(sitemap, {'pages': []}))

    def test_llm_outputs_share_nested_inventory_and_omit_noindex(self):
        self.page('network/foundations/topic.html', '<title>Nested topic</title>')
        self.page('private.html', '<meta name=robots content=noindex><title>PRIVATE SENTINEL</title>')
        report = self.inventory()
        for filename in ('build-llms-txt.py', 'build-llms-full.py'):
            spec = importlib.util.spec_from_file_location('llm_builder', TOOLS / filename)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            content = module.build_content(self.root, report)
            self.assertIn('https://resistancezero.com/network/foundations/topic.html', content)
            self.assertNotIn('PRIVATE SENTINEL', content)
            self.assertNotIn('local-preview.html', content)

    def test_gated_full_content_is_metadata_only_not_access_bypass(self):
        path = self.page('datahallAI.html', '<title>Public title</title>')
        Path(path).write_text('<html><head><title>Public title</title></head>'
                             '<body class=locked><main>PRIVATE BODY SENTINEL</main></body></html>')
        report = self.inventory()
        row = next(row for row in report['pages'] if row['path'] == 'datahallAI.html')
        self.assertEqual(row['content_policy'], 'metadata-only')
        spec = importlib.util.spec_from_file_location('llm_full', TOOLS / 'build-llms-full.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        content = module.build_content(self.root, report)
        self.assertIn('Public title', content)
        self.assertNotIn('PRIVATE BODY SENTINEL', content)
        self.assertIn('metadata-only', content)

    def test_partial_gate_and_auth_only_path_are_not_exported(self):
        """Gated CONTENT must never be exported; a gated REGION must not withhold its page.

        This assertion used to require metadata-only for both rows. A region marker then
        withheld forty public pages — the whole article corpus — while sitemap.xml and
        llms.txt published the same URLs as public in the same build. What the rule is
        actually for is that the private text never reaches the export, and that is what
        is asserted here: the article keeps its public body with the pro-panel stripped,
        the root-only path stays metadata-only, and 'Private analysis' appears nowhere.
        """
        path = self.page('article-1.html', '<title>Article</title>')
        Path(path).write_text('<html><head><title>Article</title></head><body>'
                             '<p>Public lede</p>'
                             '<div class=pro-panel>Private analysis</div></body></html>')
        self.page('market.html', '')
        (self.root / 'auth.js').write_text("var ROOT_ONLY_PATHS = ['/market.html'];")
        report = self.inventory()
        rows = {row['path']: row for row in report['pages'] if row['status'] == 'included'}
        self.assertEqual(rows['article-1.html']['content_policy'], 'public-body')
        self.assertEqual(rows['market.html']['content_policy'], 'metadata-only')
        spec = importlib.util.spec_from_file_location('llm_full', TOOLS / 'build-llms-full.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        content = module.build_content(self.root, report)
        self.assertNotIn('Private analysis', content)
        self.assertIn('Public lede', content)

    def test_llm_audit_rejects_missing_duplicate_and_stale_body(self):
        from crawler_audit import audit_llms
        self.page('article-1.html', '<title>Article</title>')
        report = self.inventory()
        (self.root / 'llms.txt').write_text('- [Wrong](https://resistancezero.com/wrong.html)\n' * 2)
        (self.root / 'llms-full.txt').write_text('STALE PRIVATE CONTENT')
        errors = audit_llms(self.root, report)
        for finding in ('missing', 'duplicate', 'unexpected', 'stale'):
            self.assertTrue(any(finding in error for error in errors), (finding, errors))

    def test_all_builders_fail_closed_on_inventory_errors(self):
        report = {'errors': ['unreviewed-publication'], 'pages': []}
        with self.assertRaises(ValueError):
            BUILDER.walk_html_files(report)
        for filename in ('build-llms-txt.py', 'build-llms-full.py'):
            spec = importlib.util.spec_from_file_location('llm_builder', TOOLS / filename)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            with self.assertRaises(ValueError):
                module.build_content(self.root, report)

    def test_nested_symlink_cannot_publish_excluded_content(self):
        from crawler_inventory import RobotsPolicy, classify_page
        self.page('_private/topic.html', '<title>Private</title>')
        (self.root / 'network').symlink_to(self.root / '_private', target_is_directory=True)
        row, errors, _ = classify_page(self.root, 'network/topic.html', True,
                                      RobotsPolicy('User-agent: *\nAllow: /\n'))
        self.assertEqual(row['status'], 'missing-or-symlink')
        self.assertTrue(errors)

    def test_specific_allow_exception_cannot_reopen_private_subtree(self):
        from crawler_inventory import RobotsPolicy
        policy = RobotsPolicy('User-agent: *\nDisallow: /Apps/\n'
                              'User-agent: GPTBot\nDisallow: /Apps/\nAllow: /Apps/private/\n')
        self.assertTrue(policy.restriction_errors())

    def test_metadata_inside_script_is_not_indexing_policy(self):
        path = self.page('article-1.html', '<script>var sample = "<meta name=robots content=noindex>";</script>')
        self.assertFalse(BUILDER.is_noindex(path))


class TierGatedRegionTests(unittest.TestCase):
    """A tier-gated REGION must not withhold the page that contains it.

    Observed RED before this fix: forty public pages — the whole article corpus and the
    Future Forward set — carried a `pro-panel` / `gated-badge` class for a calculator's
    paid tier, the inventory read that as page-level access control, and llms-full.txt
    exported them as metadata only. sitemap.xml and llms.txt published the same URLs as
    public in the same build, so the export contradicted the site's own discovery files.
    Only a document-level access call or a root-only path withholds a page now, and the
    gated region itself is stripped out of the body that does get exported.
    """

    PAGE = ('<html><body><main>'
            '<p>Public opening paragraph.</p>'
            '<div class="pro-panel" id="proFacilityContext">'
            '<p>PAID TIER BODY</p><span class="gated-badge">Pro</span></div>'
            '<p>Public closing paragraph.</p>'
            '</main></body></html>')

    def test_gated_region_is_stripped_from_the_exported_body(self):
        body = crawler_llms.extract_public_body(self.PAGE)
        self.assertNotIn('PAID TIER BODY', body)
        self.assertIn(crawler_llms.GATED_REGION_NOTICE, body)

    def test_public_prose_around_a_gated_region_survives(self):
        body = crawler_llms.extract_public_body(self.PAGE)
        self.assertIn('Public opening paragraph.', body)
        self.assertIn('Public closing paragraph.', body)

    def test_region_marker_alone_is_not_a_page_level_gate(self):
        self.assertNotIn('gated-markup', crawler_inventory.PAGE_LEVEL_GATE_REASONS)
        for reason in ('runtime-access-check', 'auth-root-only-path'):
            self.assertIn(reason, crawler_inventory.PAGE_LEVEL_GATE_REASONS)

    def test_published_articles_export_a_body_and_gated_cockpits_do_not(self):
        inventory = crawler_inventory.collect_inventory(ROOT)
        policy = {page['path']: page['content_policy'] for page in inventory['pages']}
        for public in ('article-1.html', 'article-9.html', 'FF-1.html'):
            self.assertEqual(policy.get(public), 'public-body', public)
        for gated in ('datahallAI.html', 'dc-conventional.html'):
            self.assertEqual(policy.get(gated), 'metadata-only', gated)


if __name__ == "__main__":
    unittest.main()
