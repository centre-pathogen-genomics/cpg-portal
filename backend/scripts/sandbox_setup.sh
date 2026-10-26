#! /usr/bin/env bash

# Worker-side plumbing for sandboxed tool runs, applied in the worker's own
# namespaces before it starts. See app/sandbox.py and app/scheduling.py.
#
# 1. CPU limits: every run gets `apptainer exec --cpus N`, and apptainer manages
#    those cgroups itself because the worker container has no systemd (see
#    "systemd cgroups" in apptainer.conf, set when the image is built). That
#    requires the container's cgroup root to delegate its controllers to
#    children and to hold no processes of its own.
# 2. Network: with SANDBOX_NETWORK=internet the sandbox gets a network namespace
#    of its own, masqueraded out of the worker for internet access, while every
#    private destination - the database, redis, nats - is dropped.
#
# The rules only match traffic from the sandbox subnet, so the worker itself
# keeps its access to the database, redis and nats while a run is in progress.

set -euo pipefail

if [ "${SANDBOX_ENABLED:-true}" != "true" ]; then
    echo "Sandbox disabled: no sandbox rules to apply."
    exit 0
fi

cgroup_root=/sys/fs/cgroup
cgroup_ready=/run/sandbox-cgroups-ready
rm -f "$cgroup_ready"

if [ -w "$cgroup_root/cgroup.subtree_control" ]; then
    # A cgroup cannot have processes and delegate controllers at the same time,
    # so park the worker's own processes in a child cgroup first.
    mkdir -p "$cgroup_root/worker"
    for pid in $(cat "$cgroup_root/cgroup.procs"); do
        echo "$pid" > "$cgroup_root/worker/cgroup.procs" 2>/dev/null || true
    done
    controllers=" $(cat "$cgroup_root/cgroup.controllers" 2>/dev/null) "
    for controller in cpu cpuset memory pids; do
        case "$controllers" in
            *" $controller "*) echo "+$controller" > "$cgroup_root/cgroup.subtree_control" ;;
        esac
    done
    echo "cgroup subtree_control: $(cat "$cgroup_root/cgroup.subtree_control")"
    touch "$cgroup_ready"
else
    echo "cgroup v2 is not writable, runs cannot be limited to their CPUs" >&2
fi

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
