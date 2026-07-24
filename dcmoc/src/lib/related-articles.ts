/* ─── related-articles (Workstream N) ────────────────────────────────────────
 * Curated resistancezero.com reading lists for the SITE-INTELLIGENCE family
 * diagnostic modals (RedValue `Diagnosis.references`). Every slug + title is
 * VERIFIED against the live article set (og:title, checked 2026-07-24) —
 * never invent an article number: a dead or mislabeled link inside a
 * diagnostic modal is worse than no link at all. When a new article ships,
 * append here with its verified slug/title (see CONTENT_LINKAGE_PLAYBOOK).
 * ──────────────────────────────────────────────────────────────────────── */

export interface RelatedArticle {
    /** Article title exactly as published (og:title) on resistancezero.com. */
    title: string;
    /** Absolute URL, e.g. https://resistancezero.com/article-25.html */
    href: string;
}

const article = (n: number, title: string): RelatedArticle => ({
    title,
    href: `https://resistancezero.com/article-${n}.html`,
});

/** Topic → verified external reading list. Keys mirror the SITE-INTELLIGENCE
 *  sibling tabs that consume them (talent / grid / disaster / tax). */
export const RELATED_ARTICLES: Record<'talent' | 'grid' | 'disaster' | 'tax', RelatedArticle[]> = {
    /* Hiring-difficulty diagnostics — workforce scarcity, sourcing strategy. */
    talent: [
        article(24, 'Data Center Manpower Shortage: The Most In-Demand Job in AI'),
        article(27, 'No Humans, No Data Centers: 20 Strategies to Solve the AI Workforce Crisis'),
        article(4, 'In-House Capability Is a Reliability Strategy'),
    ],
    /* Grid-grade diagnostics — grid scarcity, distribution design, tariffs. */
    grid: [
        article(25, 'PJM Is 6 GW Short by 2027. 65 Million People Are in the Blast Zone.'),
        article(13, 'Data Center Power Distribution Design: Hyperscaler Architecture Deep Dive'),
        article(11, 'AI Data Centers vs Citizen Electricity Bills: Who Really Pays?'),
    ],
    /* Disaster-category diagnostics — resilience, site selection, water, community risk. */
    disaster: [
        article(7, 'From Reliability to Resilience: Why Tier Ratings Stop at Design'),
        article(19, "Singapore vs Batam Data Centers: Why Cost Alone Doesn't Win"),
        article(10, 'Water Stress and AI Data Centers: The Hidden Crisis in Southeast Asia'),
        article(14, 'The $64 Billion Rebellion: Why Communities Worldwide Are Fighting Data Centers'),
    ],
    /* Weak-incentive diagnostics — jurisdiction economics and energy-policy plays. */
    tax: [
        article(17, "The $37 Billion Opportunity: Why SEA's Data Center Surge Will Define the Next Digital Decade"),
        article(21, 'Nuclear SMRs for AI: The $10 Billion Bet on Atomic-Powered Data Centers'),
    ],
};

export default RELATED_ARTICLES;
