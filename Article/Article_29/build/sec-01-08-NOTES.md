# Notes: sections 1-8 (sec-01.html ... sec-08.html)

Word counts (prose, tags and chart JSON stripped; tables included):
sec-01 answer 720 | sec-02 tokens 760 | sec-03 block 1020 | sec-04 kv-cache 665 | sec-05 moe 698 | sec-06 sampling 758 | sec-07 families 655 | sec-08 training 1256
(sec-02, 04, 07 are under 700 by 5-40 words once the long tables are discounted; content is complete for the outline.)

Sources cited:
- 01: S2 S7 S9
- 02: S1 S2 S3 S25 S27 S72
- 03: S1 S2 S3 S23 S26 S45 S46 S47 S48 S49 S50 S51
- 04: S1 S2 S3 S9 S30
- 05: S1 S3 S9 S23 S25 S26 S59
- 06: S1 S4 S32 S33
- 07: S1 S2 S3 S4 S5 S23 S24 S25 S26 S27 S28 S29 S69 S74
- 08: S1 S2 S3 S5 S6 S7 S8 S25 S26 S41 S60 S65 S69 S70 S73

Figure placeholders: llm-d1 (sec-01, once; sec-03 refers back to it in prose), llm-d11 (sec-02), llm-d2 (sec-03), llm-d3 (sec-04), llm-d4 (sec-05), llm-d5 (sec-08).
Calculator placeholders: tokens (sec-02), fit (sec-04), training (sec-08).
Charts: sec-02 (Indonesian/English token ratio, basisTag measured, S72), sec-07 (tokens per parameter, logY, basisTag derived). Both use "yLabel" and "x"; sec-07 sets "logY": true as article-28 does.
Callouts: one ws-insight-box in each section.

Derived numbers computed here, not literally in RESEARCH.md (arithmetic shown inline in the text):
- 2 x 70e9 = 1.4e11 FLOP/token (sec-01); softmax table for logits 4/3/1 at T 0.5/1/2 (sec-06, illustrative inputs);
- 141 - 70.6 = 70.4 GB; concurrency ceilings 26 / 6 / 1 at 8K / 32K / 128K (sec-04); FP8 cache halves 40 GiB to 20 GiB (sec-04);
- 37/671 = 5.5%, 7.4e10 vs 1.34e12 FLOP/token (factor 18), active shares 9.4/4.3/3.2/3.1%, 8 x 141 = 1,128 GB (sec-05);
- 32,768 / 576 = 57x (sec-03); sqrt(128) = 11.3; 1e6/555k = 1.80 tok/word (sec-02);
- tokens/param for Maverick (22T/400B = 55) and the 3,000x vs Chinchilla comparison (sec-07);
- 70e9 x 16 B = 1.12 TB training state (sec-08); 419 interruptions in 54 days = about one per three hours (sec-08).

Claims dropped or softened as unverified:
- gpt-oss-120b context: written as "not stated in the source extract".
- Gemini 3.x context: "reported 1M, not confirmed on the docs page read".
- H800 peak FLOPs: stated as an assumption (equal to H100).
- R1 $294k composition: stated as not verified. R1-Distill 800k samples not used.
- GPU rental $2-3/h: labelled assumed, not sourced; PUE 1.2: labelled assumed.
- Min-p (arXiv 2407.01082), SentencePiece, SwiGLU: labelled background references (no S-number in the dossier).
- Statements of reasoning with no source number: hallucination explanation (6.3), speculative-decoding gain shrinking at large batch (6.4), MoE all-to-all happening twice per layer (5.3). They follow from cited mechanisms; reviewer may want to soften or cite.
- Cross-reference to "section 14 of the full article" in 6.3 and "the article on xAI Colossus (150 MW in 122 days) on this site" in 8.6 are unlinked text; add hrefs at assembly.
