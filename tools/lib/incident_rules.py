"""Shared incident-dossier rules (PRD-Q09 owns this module and the field `sourcing.state`, coordinator decision D12).

Stage 1 (2026-11-13, for PRD-Q03 RV12): the dossier state only. A dossier carries `sourcing.state` once Q09 T-2 has
migrated it; until then the state is derived from the one-time migration rule (PRD-Q18 F1, PRD-Q09 §5): a
`lastVerified` holding the seed marker is a seed. V15 (field agrees with the record) lands with Q09 T-2.
"""

STATES = ("seed", "legacy", "verified")


def derived_state(dossier: dict) -> str:
    """The state the record implies: seed marker, else a verification stamp, else legacy."""
    src = dossier.get("sourcing") or {}
    if "seed" in str(src.get("lastVerified", "")).lower():
        return "seed"
    ver = src.get("verification")
    if isinstance(ver, dict) and ver.get("date") and ver.get("date") == src.get("lastVerified"):
        return "verified"
    return "legacy"


def state(dossier: dict) -> str:
    """`sourcing.state` when present (Q09), else the derived state."""
    s = (dossier.get("sourcing") or {}).get("state")
    return s if s in STATES else derived_state(dossier)


def is_seed(dossier: dict) -> bool:
    return state(dossier) == "seed"
