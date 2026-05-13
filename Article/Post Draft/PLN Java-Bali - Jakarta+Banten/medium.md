Title: The Jakarta Grid Concentration Problem — 18 DC Operators on One Backbone Node

---

When a new data center site evaluation in the Jakarta corridor includes "dual-feed from different substations" as a redundancy criterion, the question worth asking is whether those two substations actually share a common upstream busbar. In the Jakarta metropolitan area, the answer is often yes — and that fact is not visible from a single facility's grid connection diagram.

The DKI Jakarta + Banten provincial grid detail page was built to make that topology readable.

At approximately 11.5 GW peak load, Jakarta and Banten represent the heaviest concentration of demand on the entire Java-Bali 500/150 kV backbone. Coastal coal plants and city-edge gas turbines feed a load profile that includes 18-plus known data-center operators, several of which are co-located in the Bekasi and Tangerang corridors within a few kilometers of each other.

The provincial page adds a 20 kV DC-feeder overlay to the standard 500/150 kV transmission map. The overlay shows named operators with their feeder connection points — so the question of which substations are shared upstream infrastructure has a visual answer rather than a document-search answer.

The data is from PLN Distribution UID Jakarta Raya and Banten 2024 baseline figures, cross-referenced against operator filings in the overlay source file. The accuracy ceiling is the public disclosure level; proprietary SCADA or DNO data would push it further.

For grid-resilience analysis, the concentration picture matters more than any single facility's internal redundancy design. A facility with 2N power distribution and dual UPS strings is still exposed to a common-cause failure at the 150 kV level if its two feeds trace back to the same substation. Seeing the operators' positions in the provincial topology makes that exposure assessable rather than theoretical.

https://resistancezero.com/pln-java-grid-jakarta-banten.html
