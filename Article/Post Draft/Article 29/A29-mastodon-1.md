# Mastodon — Article 29

How a large language model actually works, written for the people who run the racks.

Tokens → attention → KV cache → MoE → sampling → training → serving → the hardware ladder from a laptop to a 1 GW campus. Every number sourced; five calculators.

Three to keep: training ≈ 6 × params × tokens; a 70B model's KV cache is 320 KiB per token (40 GiB at 128K context); one GB200 NVL72 rack is 132 kW, liquid-cooled.

https://resistancezero.com/article-29.html?utm_source=mastodon&utm_medium=social&utm_campaign=a29

#DataCenter #AI #LLM #LiquidCooling
