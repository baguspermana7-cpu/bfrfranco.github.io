const puppeteer = require('puppeteer');
const path = require('path');

// Articles to generate PDFs for
const articles = [
    {
        html: 'article-9.html',
        pdf: 'article-9-paper.pdf',
        title: 'The HVAC Shock No One Priced In | Bagus Dwi Permana'
    },
    {
        html: 'article-10.html',
        pdf: 'article-10-paper.pdf',
        title: 'Water Stress and AI Data Centers | Bagus Dwi Permana'
    },
    {
        html: 'article-11.html',
        pdf: 'article-11-paper.pdf',
        title: 'AI Data Centers vs Citizen Electricity Bills | Bagus Dwi Permana'
    },
    {
        html: 'article-12.html',
        pdf: 'article-12-paper.pdf',
        title: 'The Uncomfortable Truth: AI Data Centers Funding Grid Future | Bagus Dwi Permana'
    },
    {
        html: 'geopolitics-1.html',
        pdf: 'geopolitics-1-paper.pdf',
        title: 'The 72-Hour Warning | Bagus Dwi Permana'
    }
];

async function generatePDF(article) {
    console.log(`\n📄 Generating PDF for: ${article.html}`);

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Set viewport for consistent rendering
        await page.setViewport({ width: 1200, height: 800 });

        // Get absolute file paths
        const htmlPath = path.resolve(__dirname, article.html);
        const pdfPath = path.resolve(__dirname, article.pdf);

        console.log('   Loading:', htmlPath);

        // Load the HTML file
        await page.goto(`file://${htmlPath}`, {
            waitUntil: 'networkidle0',
            timeout: 120000
        });

        // Wait for fonts to load
        await page.evaluateHandle('document.fonts.ready');

        // Wait a bit more for any animations/charts to render
        await new Promise(resolve => setTimeout(resolve, 2000));

        console.log('   Rendering PDF...');

        // Generate PDF
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '25mm',
                left: '15mm'
            },
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: `
                <div style="width: 100%; font-size: 9px; padding: 0 20mm; display: flex; justify-content: space-between; color: #666; font-family: Arial, sans-serif;">
                    <span>${article.title}</span>
                    <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
                </div>
            `
        });

        console.log(`   ✅ Generated: ${pdfPath}`);
        return true;
    } catch (err) {
        console.error(`   ❌ Error generating ${article.html}:`, err.message);
        return false;
    } finally {
        await browser.close();
    }
}

async function generateAllPDFs() {
    console.log('🚀 Starting PDF generation...');
    console.log(`   Found ${articles.length} articles to process\n`);

    let success = 0;
    let failed = 0;

    for (const article of articles) {
        const result = await generatePDF(article);
        if (result) {
            success++;
        } else {
            failed++;
        }
    }

    console.log('\n========================================');
    console.log(`📊 Summary: ${success} succeeded, ${failed} failed`);
    console.log('========================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

// Check if a specific article is requested via command line
const targetArticle = process.argv[2];

if (targetArticle) {
    const article = articles.find(a => a.html === targetArticle || a.pdf === targetArticle);
    if (article) {
        generatePDF(article).then(success => {
            process.exit(success ? 0 : 1);
        });
    } else {
        console.log('Available articles:');
        articles.forEach(a => console.log(`  - ${a.html}`));
        process.exit(1);
    }
} else {
    generateAllPDFs().catch(err => {
        console.error('Fatal error:', err);
        process.exit(1);
    });
}
