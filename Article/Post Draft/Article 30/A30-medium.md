# Medium — Is "Agentic AI" a Fraud?
*Publish via medium.com/p/import (sets the canonical). Canonical: https://resistancezero.com/article-30.html?utm_source=medium&utm_medium=syndication&utm_campaign=a30*

## What an agent actually is, from token prediction to a software factory

A widely shared video argues that "agentic AI" is fraud: a language model only predicts the next token, the real work in any agent is ordinary code calling ordinary APIs, and the industry invented the word to keep money flowing after language models hit a wall. Rather than argue about the word, this article takes the video's fourteen separable claims and grades each one against the record.

The mechanism the video describes is right, and it is what the vendors themselves document: the model returns a structured tool call, the application's code executes it, and the result goes back to the model for the next step. Its showcase example is not: the restaurant-booking demo it cites was a browser agent that read screenshots and clicked through the website, and asked for confirmation before side effects.

The absolutes fail too. Interpretability research shows a model computing 36 + 59 through two internal pathways, a rough estimate and an exact last digit, and then, asked how, claiming it "carried the 1". The model computes, unreliably, and cannot report what it did. That is the design rule the article lands on: treat every output as a proposal that something deterministic must check.

Reliability is the binding constraint. METR finds the best model completes tasks of about 17 hours of human time at 50 % success but only about 3 hours at 80 %, and twenty steps at 95 % each succeed only 0.95^20 = 36 % of the time end to end. The money is real as well: the four largest buyers guide to about $0.7 trillion of capex in 2026, against the video's unsourced "$3 trillion".

For operations engineers the conclusion is practical: an agent is a probabilistic planner fenced by deterministic executors, verifiers and a human gate, and nothing writes to a BMS or a safety system without an interlock. The article ends with a ten-point checklist and four calculators.

Read the full article, with the graded tables and calculators, on ResistanceZero: https://resistancezero.com/article-30.html?utm_source=medium&utm_medium=syndication&utm_campaign=a30
