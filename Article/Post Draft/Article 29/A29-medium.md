# Medium — How a Large Language Model Actually Works

*Publish via medium.com/p/import (sets the canonical). Canonical: https://resistancezero.com/article-29.html?utm_source=medium&utm_medium=syndication&utm_campaign=a29*

## From one token to a 1 GW campus

A large language model is a next-token probability engine. Text is cut into tokens, each token becomes a vector, the vectors pass through a stack of identical transformer blocks that score every token against every earlier one, and the stack emits a probability for the next token. That is the whole mechanism; the rest of the field is about scale, and scale is what reaches the plant room.

Three identities carry the article. Training a model costs about six floating-point operations per parameter per token, so Llama 3 405B on 15.6 trillion tokens is 6 × 405e9 × 15.6e12 = 3.79e25 FLOP, within rounding of the 3.8e25 Meta reports. Running it costs two operations per active parameter per generated token. And at that point the limit is not arithmetic but memory: every generated token needs every weight streamed from HBM once, so a 70B model in FP8 on one H200 cannot exceed 4.8 TB/s ÷ 70 GB, about 68 tokens per second for one user, however many FLOPs the chip advertises.

The second resource is the KV cache: the keys and values of every token already seen, kept so the model does not recompute them. For Llama 3 70B that is 320 KiB per token, so a single 128K-token conversation holds 40 GiB of HBM before a second user is served. DeepSeek-V3's multi-head latent attention needs 57 times less, which is one reason its 671B-parameter model, with only 37B active per token, is cheap to run.

From there the article climbs the hardware ladder rung by rung: what fits on a laptop, a workstation GPU, one server, one GB200 NVL72 rack (72 GPUs, 13.4 TB of HBM, 132 kW nominal, liquid-cooled), a pod, and a campus where 100k GB200 is about 220 MW at PUE 1.2. It covers what a training run does to a site (Meta reports power swings on the order of tens of megawatts and 419 unexpected interruptions in 54 days on 16K H100s), how post-training, distillation and quantization make models small, what "uncensored" models are, how serving engines batch users, what agents and harnesses are, and what the frontier's limits look like in energy and data.

Five calculators are embedded: will it fit, what a training run costs in dollars and megawatt-hours, tokens per second and dollars per million tokens, LoRA memory, and token cost per document. Every number carries a source.

Read the full article, with the calculators, on ResistanceZero: https://resistancezero.com/article-29.html?utm_source=medium&utm_medium=syndication&utm_campaign=a29
