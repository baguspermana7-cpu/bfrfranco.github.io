# LinkedIn — Modbus TCP topic

**Char target**: ~900.

---

Modbus TCP is Modbus RTU wrapped in a 7-byte MBAP header, shipped over TCP/IP instead of RS-485.

The visualisation makes the overhead visible: the MBAP header chip renders larger than the payload chip. Click play and you see the protocol cost without reading a spec table.

resistancezero.com/network/industrial-ot/modbus-tcp.html

Four engineering pitfalls documented openly:
→ Transaction ID reuse causing response correlation failure
→ TCP port 502 blocked by "unknown industrial" firewall defaults
→ Keepalive timeout shorter than poll interval = silent connection death
→ Unit ID gateway routing (0=broadcast, 255=gateway itself, 1-247=downstream serial)

Compare mode lets you put Modbus RTU next to Modbus TCP and see the difference in both audio (modem-V21 vs sine) and visual (square chip on thin wire vs rect chip on Ethernet). The instrument chip strip below shows the throughput delta numerically.

Free tier. CompTIA Net+ N10-009 §2.1 aligned.

#Modbus #ModbusTCP #IndustrialNetworks #DCIM
