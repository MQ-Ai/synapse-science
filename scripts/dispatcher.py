"""
Synapse Ecosystem — B2B Enterprise Telemetry Dispatcher
========================================================
Reads candidate sandbox metrics from test_payload.json,
anonymises the candidate identity via SHA-256 (Privacy Shield),
signs the payload with HMAC-SHA256 (Security Signature),
and routes it to an enterprise webhook endpoint (Webhook Pipe).

Zero external dependencies — stdlib only.

Usage:
    python dispatcher.py [--payload PATH] [--dry-run] [--env PATH]

.env variables:
    WEBHOOK_SECRET_KEY   HMAC signing secret (required)
    ENTERPRISE_ENDPOINT  Target webhook URL  (required)
    DISPATCHER_TIMEOUT   HTTP timeout seconds (default: 15)
"""

from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import logging
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# ── Logging ──────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
)
log = logging.getLogger("synapse.dispatcher")


# ── Minimal .env Loader ───────────────────────────────────────────────────────

def load_dotenv(path: Path = Path(".env")) -> None:
    """
    Parses KEY=VALUE pairs from a .env file into os.environ.
    Skips comments (#) and blank lines. Strips surrounding quotes.
    Does NOT override variables already set in the shell environment.
    """
    if not path.is_file():
        log.debug(".env not found at %s — using shell environment.", path)
        return

    with path.open(encoding="utf-8") as fh:
        for lineno, line in enumerate(fh, 1):
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, raw = line.partition("=")
            key = key.strip()
            val = raw.strip()
            # Strip matching surrounding quotes
            if len(val) >= 2 and val[0] in ('"', "'") and val[0] == val[-1]:
                val = val[1:-1]
            if key and key not in os.environ:
                os.environ[key] = val
                log.debug("Loaded %s from .env line %d", key, lineno)


# ── Privacy Shield: SHA-256 Anonymisation ────────────────────────────────────

def anonymise_email(raw_email: str) -> str:
    """
    Converts a candidate's raw email to an irreversible 64-char hex token.

    Normalisation (lowercase + strip) ensures that 'Alice@Example.com'
    and 'alice@example.com' produce the same token, preventing duplicate
    candidate records across case variants.

    Returns:
        64-character lowercase hex digest (SHA-256).

    Raises:
        ValueError: if raw_email is empty or not a string.
    """
    if not isinstance(raw_email, str) or not raw_email.strip():
        raise ValueError("candidate_raw_email must be a non-empty string.")

    normalised = raw_email.strip().lower().encode("utf-8")
    token = hashlib.sha256(normalised).hexdigest()
    log.info("Privacy shield: email → token %s…", token[:14])
    return token


# ── Payload Validator & Sanitiser ────────────────────────────────────────────

REQUIRED_FIELDS: frozenset[str] = frozenset({
    "candidate_raw_email",
    "session_id",
    "question_id",
    "score",
    "causal_chain_completeness",
    "time_to_answer_seconds",
    "socratic_turns",
})


def sanitise(raw: dict[str, Any]) -> dict[str, Any]:
    """
    Validates raw payload fields, removes PII, and returns an anonymised
    payload dict ready for signing and dispatch.

    Raises:
        KeyError:   if a required field is absent.
        ValueError: if a field value fails its type/range constraint.
    """
    missing = REQUIRED_FIELDS - raw.keys()
    if missing:
        raise KeyError(f"Missing required fields: {sorted(missing)}")

    # Numeric range checks
    score = float(raw["score"])
    if not (0.0 <= score <= 1.0):
        raise ValueError(f"score must be in [0.0, 1.0], got {score}")

    completeness = float(raw.get("causal_chain_completeness", 0.0))
    if not (0.0 <= completeness <= 1.0):
        raise ValueError(f"causal_chain_completeness must be in [0.0, 1.0], got {completeness}")

    turns = int(raw["socratic_turns"])
    if turns < 0:
        raise ValueError(f"socratic_turns must be >= 0, got {turns}")

    elapsed = float(raw["time_to_answer_seconds"])
    if elapsed < 0:
        raise ValueError(f"time_to_answer_seconds must be >= 0, got {elapsed}")

    # Anonymise PII — the raw email is deliberately NOT forwarded
    token = anonymise_email(raw["candidate_raw_email"])

    clean: dict[str, Any] = {
        "candidate_token": token,           # replaces candidate_raw_email
        "session_id": str(raw["session_id"]),
        "question_id": str(raw["question_id"]),
        "score": score,
        "causal_chain_completeness": completeness,
        "time_to_answer_seconds": elapsed,
        "socratic_turns": turns,
        # Dispatcher-injected envelope
        "dispatched_at": datetime.now(tz=timezone.utc).isoformat(),
        "schema_version": "1.0",
    }

    # Forward optional non-PII extension fields (skip internal _ fields)
    for k, v in raw.items():
        if k not in REQUIRED_FIELDS and not k.startswith("_"):
            clean[k] = v

    return clean


# ── Security Signature: HMAC-SHA256 ──────────────────────────────────────────

def sign(payload_bytes: bytes, secret: str) -> str:
    """
    Produces an HMAC-SHA256 signature over the exact bytes being transmitted,
    prefixed with 'sha256=' following the industry convention.

    The signature covers the serialised payload body, so any tampering in
    transit invalidates it on the receiver's side.

    Returns:
        'sha256=<64-char lowercase hex digest>'
    """
    key = secret.encode("utf-8")
    digest = hmac.new(key, payload_bytes, hashlib.sha256).hexdigest()
    sig = f"sha256={digest}"
    log.info("Payload signed — prefix: %s…", sig[:22])
    return sig


# ── Webhook Pipe: HTTP Dispatch ───────────────────────────────────────────────

def dispatch(
    payload: dict[str, Any],
    endpoint: str,
    secret: str,
    timeout: int = 15,
    dry_run: bool = False,
) -> dict[str, Any]:
    """
    Serialises the payload to compact JSON, signs it, and POSTs it to the
    enterprise endpoint with the appropriate security headers.

    Custom headers:
        Content-Type:           application/json; charset=utf-8
        X-Telemetry-Signature:  sha256=<hmac_hex>
        X-Dispatcher-Version:   1.0
        User-Agent:             Synapse-Dispatcher/1.0

    Returns:
        dict with keys: status_code (int), response_body (str), success (bool)
    """
    # Deterministic compact serialisation — separator choice eliminates
    # whitespace so the byte sequence is stable for signature verification.
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    signature = sign(body, secret)

    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "X-Telemetry-Signature": signature,
        "X-Dispatcher-Version": "1.0",
        "User-Agent": "Synapse-Dispatcher/1.0",
    }

    if dry_run:
        log.info("[DRY RUN] Endpoint : %s", endpoint)
        log.info("[DRY RUN] Headers  : %s", headers)
        log.info("[DRY RUN] Body (%d B):\n%s", len(body), body.decode())
        return {"status_code": 0, "response_body": "(dry run)", "success": True}

    req = urllib.request.Request(
        url=endpoint,
        data=body,
        headers=headers,
        method="POST",
    )

    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            latency = time.perf_counter() - t0
            resp_body = resp.read().decode("utf-8", errors="replace")
            log.info(
                "Dispatch OK — status=%d  latency=%.3fs  endpoint=%s",
                resp.status, latency, endpoint,
            )
            return {"status_code": resp.status, "response_body": resp_body, "success": True}

    except urllib.error.HTTPError as exc:
        latency = time.perf_counter() - t0
        resp_body = exc.read().decode("utf-8", errors="replace")
        log.error(
            "Dispatch HTTP error — status=%d  latency=%.3fs\n%s",
            exc.code, latency, resp_body[:500],
        )
        return {"status_code": exc.code, "response_body": resp_body, "success": False}

    except urllib.error.URLError as exc:
        log.error("Dispatch network error: %s", exc.reason)
        return {"status_code": 0, "response_body": str(exc.reason), "success": False}

    except TimeoutError:
        log.error("Dispatch timed out after %ds — endpoint=%s", timeout, endpoint)
        return {"status_code": 0, "response_body": "timeout", "success": False}


# ── CLI ───────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="dispatcher.py",
        description="Synapse B2B Enterprise Telemetry Dispatcher",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument(
        "--payload",
        type=Path,
        default=Path("test_payload.json"),
        help="Path to candidate metrics JSON (default: test_payload.json)",
    )
    p.add_argument(
        "--dry-run",
        action="store_true",
        help="Build, validate and sign but do NOT send the request.",
    )
    p.add_argument(
        "--env",
        type=Path,
        default=Path(".env"),
        help="Path to .env file (default: .env in CWD)",
    )
    return p


# ── Entry Point ───────────────────────────────────────────────────────────────

def main() -> int:
    args = build_parser().parse_args()
    load_dotenv(args.env)

    secret = os.environ.get("WEBHOOK_SECRET_KEY", "").strip()
    endpoint = os.environ.get("ENTERPRISE_ENDPOINT", "").strip()
    timeout = int(os.environ.get("DISPATCHER_TIMEOUT", "15"))

    errors: list[str] = []
    if not secret:
        errors.append("WEBHOOK_SECRET_KEY is not set or empty.")
    if not endpoint:
        errors.append("ENTERPRISE_ENDPOINT is not set or empty.")
    if errors:
        for e in errors:
            log.error("Environment error: %s", e)
        return 1

    payload_path: Path = args.payload
    if not payload_path.is_file():
        log.error("Payload file not found: %s", payload_path.resolve())
        return 1

    try:
        raw: dict[str, Any] = json.loads(payload_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        log.error("Failed to parse payload JSON: %s", exc)
        return 1

    log.info("Payload loaded: %s", payload_path.resolve())

    try:
        clean = sanitise(raw)
    except (KeyError, ValueError) as exc:
        log.error("Payload validation failed: %s", exc)
        return 1

    result = dispatch(
        payload=clean,
        endpoint=endpoint,
        secret=secret,
        timeout=timeout,
        dry_run=args.dry_run,
    )

    if result["success"]:
        log.info("Dispatcher completed successfully.")
        return 0
    else:
        log.error("Dispatcher completed with errors.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
