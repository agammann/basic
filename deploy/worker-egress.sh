#!/bin/sh
# Run once on the Linux Docker host before starting the production worker.
# Dedicated Basic subnet only. Do not change the source CIDR without reviewing Compose.
set -eu
iptables -N BASIC_EGRESS 2>/dev/null || true
iptables -F BASIC_EGRESS
iptables -A BASIC_EGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
for cidr in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.168.0.0/16 192.0.0.0/24 192.0.2.0/24 198.18.0.0/15 198.51.100.0/24 203.0.113.0/24 224.0.0.0/4 240.0.0.0/4; do
  iptables -A BASIC_EGRESS -d "$cidr" -j REJECT
done
iptables -A BASIC_EGRESS -p tcp --dport 443 -j ACCEPT
iptables -A BASIC_EGRESS -j REJECT
iptables -C DOCKER-USER -s 172.30.89.10/32 -j BASIC_EGRESS 2>/dev/null || iptables -I DOCKER-USER 1 -s 172.30.89.10/32 -j BASIC_EGRESS
# Docker's embedded DNS and the separate internal PostgreSQL interface are unaffected.
