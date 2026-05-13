Title: Mapping the PLN Java-Bali Grid — 744 Nodes, 488 Edges, One Synchronous Chain

---

There is an engineering fact about the Java-Bali power system that does not appear in most discussions of Indonesian data center growth: roughly 70% of national peak demand runs through a single synchronous island chain. From the coal plants at Merak through the 500 kV backbone to the eastern interconnect at Banyuwangi and the submarine cable crossing to Bali, it is one machine. When it hiccups, the entire island feels it.

For data center infrastructure planning, that topology is not academic. It determines where N+1 grid feeds are actually independent. It explains why certain substations in the Jakarta metropolitan area carry disproportionate fault risk. And it is the reason why the Surabaya DC cluster in East Java faces different grid-resilience economics than a facility drawing from the same nominal voltage level in Bekasi.

I built the PLN Java-Bali Grid Monitor because this information exists in PLN annual reports, RUPTL documents, and BPS statistical releases — but it is not assembled in a form that makes the topology readable at a glance.

The monitor maps 744 substations and nodes across the 500, 275, 150, and 70 kV transmission backbone, derived from OSM infrastructure data cross-referenced against PLN AR 2024 and RUPTL 2025-2034. The 488 transmission edges include voltage classification, topology type, and source annotation — including the inferred edges that close connectivity gaps the public OSM dataset leaves open. Inferred edges render at reduced opacity so the distinction is visible.

Five provincial sub-pages add the 20 kV layer: named data-center operators, industrial intake points, and the evacuation topology from each major plant to its host substation. The DKI Jakarta + Banten page includes 18-plus known DC operators with their feeder connections. The Jawa Timur page shows the PLTU Paiton complex — at 4.71 GW, the largest single coal block in Indonesia — and the PLTGU Gresik gas plant that anchors the Surabaya metropolitan load.

The dataset will drift from operational reality over time. The OSM community and PLN's public disclosures are the practical ceiling for accuracy without direct access to PLN's internal SCADA. A scheduled refresh routine runs quarterly against OSM to catch topology changes.

What it gives you that public documents do not is a navigable, layered view of the system's actual structure — something that matters every time a new data center is sited near Bekasi or Surabaya and the grid-resilience question comes up in the design review.

https://resistancezero.com/pln-java-grid.html
