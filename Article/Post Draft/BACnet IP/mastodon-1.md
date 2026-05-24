# Mastodon — BACnet/IP

**Char target**: ≤500

---

BACnet/IP — ASHRAE 135 over UDP with 4-byte BVLC tunnel for IP transport.

Live animation: triangle-waveform packets, hex chips on Ethernet wire. BVLC tunnel renders as scan-line shroud at packet head — the distinctive visual trait.

Four engineering pitfalls openly documented:
→ BBMD foreign-device registration timeout
→ Port 47808 firewall default
→ Object instance ID collisions across vendors
→ COV subscription leak under network partition

ASHRAE 135 + RFC 768 cited. Free tier.

resistancezero.com/network/industrial-ot/bacnet-ip.html

---

(~496)
