# LinkedIn — BACnet/IP topic

**Char target**: ~900.

---

BACnet/IP wraps ASHRAE 135 — the building-automation protocol that runs your HVAC, lighting, fire panels, and elevator dispatch — inside a 4-byte BVLC (BACnet Virtual Link Control) tunnel for IP transport.

Visualisation: triangle-waveform packets render as hex chips on Ethernet wire. The BVLC tunnel is the distinctive trait — when the chip is the BVLC head, a brief scan-line shroud renders over it so you can see exactly where the tunnel wraps the payload.

resistancezero.com/network/industrial-ot/bacnet-ip.html

Four engineering pitfalls openly documented:
→ BBMD (Broadcast Management Device) foreign-device registration timeout (default 60 s; miss the renewal and your remote BMS controller goes silent)
→ Default port 47808 (0xBAC0) commonly blocked by enterprise firewalls as "unknown UDP"
→ Object instance ID collisions across vendors (ASHRAE 135 requires uniqueness per device/object pair; gateways often forget)
→ COV subscription leaks under network partition (UDP has no TCP-like timeout; subscriptions don't auto-expire)

Free tier. ASHRAE 135 + IETF RFC 768 cited on the page.

#BACnet #BuildingAutomation #HVAC #DCIM
