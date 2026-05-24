# LinkedIn — OPC-UA topic

**Char target**: ~1,100.

---

OPC-UA (IEC 62541) is the modern industrial protocol. Structured binary, built-in security with X.509 certificates, and a publish-subscribe model where the server pushes monitored items at a configured cadence.

The visualisation captures the three things that make OPC-UA different from Modbus / BACnet:

1. Always-on encryption shroud. The wire renders with a scan-line overlay whenever security mode ≠ none (default is sign-and-encrypt). Toggle it off and the overlay disappears — that's the unencrypted UDP-equivalent state most operators wouldn't deploy.

2. Layered chips. The byte chip isn't a flat fill — it renders as 3 stacked rects encoding the binary message structure (message header / sequence header / body). It's literal: that's how the bytes are laid out in an OPC-UA frame.

3. Three actors, not two. Client (broker-diamond) talks to server (sensor-circle), but there's also a discovery server visible — that's how OPC-UA clients learn which security policies a server supports before connecting.

resistancezero.com/network/industrial-ot/opc-ua.html

Four engineering pitfalls openly documented:
→ Certificate trust list mismatch (server doesn't trust client AND vice versa = generic BadSecurityChecksFailed; audit both lists symmetrically)
→ Publishing interval < sampling interval = wasted bandwidth
→ Queue overflow on slow subscribers (default behaviour is silent drop-oldest)
→ Endpoint discovery vs hardcoded URLs (skip discovery and the upgrade path becomes painful)

Free tier. IEC 62541 + OPC Foundation + VDI/VDE 2657 cited.

#OPCUA #IndustrialNetworks #IIoT #ICSSecurity
