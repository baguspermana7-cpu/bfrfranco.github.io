# Mastodon — Modbus TCP

**Char target**: ≤500

---

Modbus TCP — Modbus RTU PDU wrapped in 7-byte MBAP header, shipped over TCP.

Live animation: MBAP chip visibly larger than payload chip — protocol overhead made visible without a spec-table lookup.

Four engineering pitfalls openly documented:
→ Transaction ID reuse
→ Port 502 firewall default
→ Keepalive vs poll interval mismatch
→ Unit ID gateway routing

Compare side-by-side with Modbus RTU in compare mode.

CompTIA Net+ N10-009 §2.1. Free tier.

resistancezero.com/network/industrial-ot/modbus-tcp.html

---

(~487)
