# LinkedIn — Article 30: Is "Agentic AI" a Fraud?

A video calling agentic AI "fraud" has been forwarded to a lot of engineers. I graded each of its 14 claims against the record instead of arguing about the word.

→ The mechanism it describes is right. The model emits a structured tool call; the application's own code executes it and returns the result. That is how the vendors document it.
→ Its showcase example is wrong. The restaurant demo it cites was a browser agent that read screenshots and clicked through the site, and asked before acting. Not an API script.
→ "No reasoning, no maths" is half right. Interpretability work shows a model computing 36 + 59 through two internal pathways — and then claiming it "carried the 1". It computes, unreliably, and cannot report how.
→ Reliability is the real limit. METR's best model finishes ~17-hour tasks at 50% success but only ~3-hour tasks at 80%. And 20 steps at 95% each succeed 0.95^20 = 36% of the time.
→ The money is real: big-four 2026 capex guidance is about $0.7 trillion, not the "$3 trillion" in the video.

The engineering answer for operations: an agent is a probabilistic planner fenced by deterministic checks. Tests, interlocks and a human gate decide which of its guesses touch the plant — and nothing writes to a BMS or SIS without one.

Four calculators in the article: agent or script, run cost and reliability, loop budget, verification coverage.

https://resistancezero.com/article-30.html?utm_source=linkedin&utm_medium=social&utm_campaign=a30

#AIAgents #DataCenter #OTSecurity #LLM #Engineering
