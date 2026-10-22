#! /usr/bin/env bash

# Network rules for sandboxed tool runs, applied in the worker's own network
# namespace before the worker starts. See app/sandbox.py and container/*.conf.
#
# With SANDBOX_NETWORK=internet the sandbox gets a network namespace of its own
# (the "internet" CNI network, subnet 10.99.0.0/24 - keep this in sync with
# subnet below), masqueraded out of the worker for internet access, while every
# private destination is dropped. That includes the database, redis and nats.
#
# The rules only match traffic coming from the sandbox subnet, so the worker
# itself keeps its access to the database, redis and nats while a run is in
# progress.

set -euo pipefail

mode="${SANDBOX_NETWORK:-none}"
ready_file="/run/sandbox-network-ready"
rm -f "$ready_file"
if [ "$mode" != "internet" ]; then
    echo "Sandbox network mode '$mode': no network rules to apply."
    exit 0
fi

subnet="10.99.0.0/24"
dns="${SANDBOX_DNS:-1.1.1.1}"
chain="SANDBOX-INTERNET"

if ! command -v iptables >/dev/null; then
    echo "iptables is required for SANDBOX_NETWORK=internet" >&2
    exit 1
fi

# Rebuild the chain so that restarts are idempotent.
iptables -N "$chain" 2>/dev/null || iptables -F "$chain"
iptables -C FORWARD -s "$subnet" -j "$chain" 2>/dev/null ||
    iptables -I FORWARD 1 -s "$subnet" -j "$chain"

# The resolver may live on a private address, it is allowed before the drops.
iptables -A "$chain" -d "$dns" -j ACCEPT
for private in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 169.254.0.0/16 127.0.0.0/8; do
    iptables -A "$chain" -d "$private" -j DROP
done
iptables -A "$chain" -j ACCEPT

# Give the sandbox subnet its own source address on the way out.
iptables -t nat -C POSTROUTING -s "$subnet" -j MASQUERADE 2>/dev/null ||
    iptables -t nat -A POSTROUTING -s "$subnet" -j MASQUERADE

echo "Sandbox runs get internet access, private networks are blocked (resolver $dns)."
touch "$ready_file"
