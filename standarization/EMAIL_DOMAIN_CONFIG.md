# Email & Domain Configuration — ResistanceZero

> **Version**: 1.0 | **Updated**: 2026-03-20

---

## Domain Registration

| Field | Value |
|-------|-------|
| Domain | `resistancezero.com` |
| Registrar | **Hostinger** (hpanel.hostinger.com) |
| Login Email | `bagusdpermana7@gmail.com` |
| Status | Active |
| Expiration | 2029-02-07 |
| Auto-renewal | Off |

---

## DNS Management — Cloudflare

| Field | Value |
|-------|-------|
| Provider | **Cloudflare** (dash.cloudflare.com) |
| Login Email | `resistancezero0us@gmail.com` |
| Plan | Free |
| Zone ID | `dc7836829de37eaa023f440ea2d06814` |
| Account ID | `157a190c84790147f2403dda6f126fc4` |
| DNS Setup | Full |

### Nameservers (set in Hostinger)

| Nameserver | Value |
|------------|-------|
| NS1 | `elliot.ns.cloudflare.com` |
| NS2 | `poppy.ns.cloudflare.com` |

Previous (replaced): `ns1.dns-parking.com`, `ns2.dns-parking.com`

### DNS Records (auto-imported)

| Type | Name | Value | Proxy |
|------|------|-------|-------|
| A (x4) | resistancezero.com | 216.239.32.21, .36.21, .34.21, .38.21 | Proxied |
| AAAA (x4) | resistancezero.com | 2001:4860:4802:36::15, :32::15, etc. | Proxied |
| CNAME | www | resistancezero.com | Proxied |
| CAA (x12) | various | certificate authority records | — |
| TXT | resistancezero.com | SPF record (v=spf1 ...) | — |
| TXT | cf2024-1._domainkey | DKIM record | — |
| MX (x3) | resistancezero.com | route*.mx.cloudflare.net (pri 19, 49, 49) | — |

---

## Email Routing — Cloudflare

| Field | Value |
|-------|-------|
| Service | Cloudflare Email Routing (Free) |
| Custom Address | `contact@resistancezero.com` |
| Destination | `resistancezero0us@gmail.com` |
| Routing Status | Syncing (pending nameserver propagation) |
| DNS Records | Configured (MX + SPF + DKIM auto-added) |

### How it works
- Emails sent to `contact@resistancezero.com` are forwarded to `resistancezero0us@gmail.com`
- No email storage on Cloudflare — forwarding only
- MX records point to Cloudflare's mail servers
- SPF + DKIM records ensure deliverability

---

## Gmail "Send As" Configuration

Allows replying FROM `contact@resistancezero.com` via Gmail.

| Field | Value |
|-------|-------|
| Gmail Account | `resistancezero0us@gmail.com` |
| Send As Address | `contact@resistancezero.com` |
| Display Name | Bagus Dwi Permana |
| Treat as alias | No (unchecked) |
| SMTP Server | `smtp.gmail.com` |
| Port | 587 |
| Username | `resistancezero0us@gmail.com` |
| Password | App Password (16-digit, generated from Google) |
| Security | TLS |

### App Password Setup

1. Go to https://myaccount.google.com/apppasswords
2. Login: `resistancezero0us@gmail.com`
3. Prerequisite: 2-Step Verification must be ON
4. Create app password with name: `Cloudflare Email`
5. Copy 16-digit password → use in Gmail SMTP settings
6. App name used: `Cloudflare Email`
7. **Never share or commit this password**
8. Status: App Password generated on 2026-03-20, verified and working
9. Gmail "Send As" default set to `contact@resistancezero.com`
10. Reply setting: "Always reply from default address"
11. Sender info: "Show this address only (contact@resistancezero.com)"

### Gmail Settings Path

Settings (gear) → See all settings → Accounts and Import → Send mail as → Add another email address

---

## Website Hosting

| Field | Value |
|-------|-------|
| Hosting | **GitHub Pages** |
| Repository | `baguspermana7-cpu/bfrfranco.github.io` |
| Custom Domain | `resistancezero.com` (via A/AAAA records → GitHub IPs, now proxied through Cloudflare) |
| SSL | Cloudflare Universal SSL (free) |

---

## Account Summary

| Service | Login Email | Purpose |
|---------|-------------|---------|
| Hostinger | `bagusdpermana7@gmail.com` | Domain registrar |
| Cloudflare | `resistancezero0us@gmail.com` | DNS + Email Routing + CDN |
| Gmail | `resistancezero0us@gmail.com` | Email inbox + Send As |
| GitHub | `baguspermana7-cpu` | Website hosting |

---

## Troubleshooting

### Email not forwarding
1. Check Cloudflare zone is active (Overview → should say "Active")
2. Check Email Routing status (Email → Email Routing → should say "Active")
3. Verify destination email is confirmed
4. Check spam folder in Gmail

### Website not loading after Cloudflare
1. Verify A/AAAA records match GitHub Pages IPs
2. SSL/TLS mode should be "Full" or "Flexible"
3. Check GitHub repo Settings → Pages → Custom domain = `resistancezero.com`

### Cannot send as contact@resistancezero.com
1. Verify App Password is correct (regenerate if needed)
2. Check SMTP settings: smtp.gmail.com, port 587, TLS
3. Verify the confirmation code from Gmail
