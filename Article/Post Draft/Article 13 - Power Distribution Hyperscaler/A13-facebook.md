# Facebook — Article 13: Data Center Power Distribution: Hyperscaler Design

New on ResistanceZero: Data Center Power Distribution: Hyperscaler Design.

How do AWS, Google, Microsoft and xAI actually deliver power to a rack? This article compares their architectures, from 12V to 48V, 380V and 800V DC.

Some of the findings: AWS distributed UPS reduces conversion losses by 35% and limits a failure to a single rack. Google's 48V design cuts distribution losses 16x against 12V, because losses scale with current squared and 48V carries a quarter of the current (93.75% lower). Microsoft's Mt Diablo 400V DC enables 15-35% more AI accelerators per rack space. New power shelves support 130+ kW per rack for GB200 workloads.

It also covers UPS and battery technologies, generators, failure scenarios, arc flash, protection coordination and reliability calculations. Interactive calculators are included.

https://resistancezero.com/article-13.html?utm_source=facebook&utm_medium=social&utm_campaign=a13
