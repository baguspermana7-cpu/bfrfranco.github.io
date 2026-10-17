# LinkedIn — Geopolitics 3: Strait of Hormuz Fiber Shock

What happens to a region's network if several submarine cables in the Strait of Hormuz and Gulf of Oman fail at the same time?

Geopolitics 3 is a scenario-based engineering analysis built from public sources. It attributes responsibility to no one and describes no methods. Its starting facts: 20.7 million barrels a day moved through Hormuz in 2024 (US EIA), and submarine cables carry more than 99% of intercontinental data.

The finding is that the real failure mode is regional degradation, not an instant blackout. Carriers reroute within hours. Then surviving routes carry traffic they were not meant to carry continuously, a practical 15-40 ms RTT penalty on longer detours, and spare capacity, clean latency and stable application behavior vanish in that order. Repair makes it worse: the recent global average delay before repair work can start is about 1.5 months.

Routes that look diverse can share a failure domain. TeleGeography notes territorial routing pushes many paths into Omani waters. New systems add choices without removing chokepoints.

The article compares how GCC states absorb the shock and asks what resilience means: physical separation, exits on both sides of the Strait and a realistic repair path. A bounded Strait Corridor Fiber Shock Calculator is included.

Read it: https://resistancezero.com/geopolitics-3.html?utm_source=linkedin&utm_medium=social&utm_campaign=g3

#SubseaCables #DataCenter #Resilience #Networking #CriticalInfrastructure #Gulf
