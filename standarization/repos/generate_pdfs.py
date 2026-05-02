#!/usr/bin/env python3
"""
generate_pdfs.py — Convert REPO_*.md and REPO_INSTALL_PLAN.md to PDF using reportlab.

Usage:
    python3 standarization/repos/generate_pdfs.py

Outputs PDFs to the same directory as the source MD files.
"""

import os
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
from reportlab.lib.colors import HexColor

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# All MD files to convert
MD_FILES = [
    "REPO_weknora.md",
    "REPO_cobra.md",
    "REPO_task.md",
    "REPO_ccconnect.md",
    "REPO_harness.md",
    "REPO_gascity.md",
    "REPO_INSTALL_PLAN.md",
]


def safe_html(text):
    """Escape HTML special chars for reportlab Paragraph."""
    text = text.replace("&", "&amp;")
    text = text.replace("<", "&lt;")
    text = text.replace(">", "&gt;")
    return text


def clean_inline_md(text):
    """Convert basic inline markdown to reportlab XML."""
    # Bold: **text** -> <b>text</b>
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    # Italic: *text* or _text_ -> <i>text</i>  (single stars only, not bold)
    text = re.sub(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)", r"<i>\1</i>", text)
    # Inline code: `text` -> <font name="Courier">text</font>
    text = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', text)
    # Links: [text](url) -> text (url)
    text = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r"\1 (\2)", text)
    return text


def md_to_pdf(md_path, pdf_path):
    """Convert a Markdown file to PDF using reportlab."""
    with open(md_path, encoding="utf-8") as f:
        content = f.read()

    doc = SimpleDocTemplate(
        pdf_path,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
    )

    styles = getSampleStyleSheet()

    # Custom styles
    h1_style = ParagraphStyle(
        "CustomH1",
        parent=styles["Heading1"],
        fontSize=18,
        spaceAfter=12,
        spaceBefore=6,
        textColor=HexColor("#1a1a2e"),
    )
    h2_style = ParagraphStyle(
        "CustomH2",
        parent=styles["Heading2"],
        fontSize=14,
        spaceAfter=8,
        spaceBefore=10,
        textColor=HexColor("#16213e"),
    )
    h3_style = ParagraphStyle(
        "CustomH3",
        parent=styles["Heading3"],
        fontSize=12,
        spaceAfter=6,
        spaceBefore=8,
        textColor=HexColor("#0f3460"),
    )
    normal_style = ParagraphStyle(
        "CustomNormal",
        parent=styles["Normal"],
        fontSize=9,
        leading=14,
        spaceAfter=3,
        fontName="Helvetica",
    )
    bullet_style = ParagraphStyle(
        "CustomBullet",
        parent=styles["Normal"],
        fontSize=9,
        leading=14,
        leftIndent=12,
        spaceAfter=2,
        fontName="Helvetica",
    )
    code_style = ParagraphStyle(
        "CustomCode",
        parent=styles["Code"],
        fontSize=7.5,
        leading=11,
        fontName="Courier",
        leftIndent=12,
        spaceAfter=2,
        backColor=HexColor("#f4f4f4"),
    )
    table_style = ParagraphStyle(
        "CustomTable",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=12,
        fontName="Courier",
        leftIndent=6,
        spaceAfter=2,
    )

    story = []
    in_code_block = False
    code_lines = []

    lines = content.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]

        # Code block toggle
        if line.strip().startswith("```"):
            if not in_code_block:
                in_code_block = True
                code_lines = []
            else:
                in_code_block = False
                if code_lines:
                    story.append(Spacer(1, 4))
                    for cl in code_lines:
                        safe = safe_html(cl)
                        story.append(Paragraph(safe if safe else " ", code_style))
                    story.append(Spacer(1, 4))
                code_lines = []
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        stripped = line.strip()

        # Skip empty lines — add small spacer
        if not stripped:
            story.append(Spacer(1, 4))
            i += 1
            continue

        # Horizontal rule
        if stripped in ("---", "***", "___"):
            story.append(Spacer(1, 4))
            story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#cccccc")))
            story.append(Spacer(1, 4))
            i += 1
            continue

        # Table rows (contain |)
        if stripped.startswith("|") and stripped.endswith("|"):
            # Skip separator rows like |---|---|
            if re.match(r"^\|[-| :]+\|$", stripped):
                i += 1
                continue
            # Format as monospace table row
            safe = safe_html(stripped)
            story.append(Paragraph(safe, table_style))
            i += 1
            continue

        # Headings
        if stripped.startswith("# ") and not stripped.startswith("## "):
            text = clean_inline_md(safe_html(stripped[2:].strip()))
            story.append(Paragraph(text, h1_style))
            i += 1
            continue

        if stripped.startswith("## ") and not stripped.startswith("### "):
            text = clean_inline_md(safe_html(stripped[3:].strip()))
            story.append(Paragraph(text, h2_style))
            i += 1
            continue

        if stripped.startswith("### "):
            text = clean_inline_md(safe_html(stripped[4:].strip()))
            story.append(Paragraph(text, h3_style))
            i += 1
            continue

        # Bullet points
        if stripped.startswith("- ") or stripped.startswith("* "):
            text = clean_inline_md(safe_html(stripped[2:].strip()))
            story.append(Paragraph("• " + text, bullet_style))
            i += 1
            continue

        # Numbered list
        if re.match(r"^\d+\. ", stripped):
            text = re.sub(r"^\d+\. ", "", stripped)
            text = clean_inline_md(safe_html(text))
            story.append(Paragraph(text, bullet_style))
            i += 1
            continue

        # Blockquote
        if stripped.startswith("> "):
            text = clean_inline_md(safe_html(stripped[2:].strip()))
            quote_style = ParagraphStyle(
                "Quote",
                parent=normal_style,
                leftIndent=16,
                textColor=HexColor("#555555"),
                fontName="Helvetica-Oblique",
            )
            story.append(Paragraph(text, quote_style))
            i += 1
            continue

        # Regular paragraph
        text = clean_inline_md(safe_html(stripped))
        story.append(Paragraph(text, normal_style))
        i += 1

    doc.build(story)


def main():
    results = []
    for md_filename in MD_FILES:
        md_path = os.path.join(SCRIPT_DIR, md_filename)
        pdf_filename = md_filename.replace(".md", ".pdf")
        pdf_path = os.path.join(SCRIPT_DIR, pdf_filename)

        if not os.path.exists(md_path):
            results.append((md_filename, "SKIPPED — file not found", 0))
            continue

        try:
            md_to_pdf(md_path, pdf_path)
            size = os.path.getsize(pdf_path)
            results.append((pdf_filename, "OK", size))
        except Exception as e:
            results.append((pdf_filename, f"ERROR: {e}", 0))

    print("\nPDF Generation Results:")
    print("-" * 60)
    for fname, status, size in results:
        if status == "OK":
            print(f"  {fname:<35} {status}  ({size:,} bytes / {size//1024} KB)")
        else:
            print(f"  {fname:<35} {status}")
    print("-" * 60)
    print(f"Done. PDFs saved to: {SCRIPT_DIR}")


if __name__ == "__main__":
    main()
