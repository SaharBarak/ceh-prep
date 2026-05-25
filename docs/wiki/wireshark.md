---
title: Wireshark
slug: wireshark
category: tools
summary: Wireshark is an open-source network protocol analyzer that captures and inspects packets traversing a network interface. It is the de-facto standard tool for packet-level analysis, taught in nearly every networking and security curriculum, and the canonical reference for understanding what a protocol actually looks like on the wire.
related: [tls, nmap, burp-suite]
aliases: [Wireshark, tshark, Ethereal]
updated: 2026-05-25
---

**Wireshark** is an open-source network protocol analyzer that captures and inspects packets traversing a network interface. It is the de-facto standard tool for packet-level analysis: every networking and security curriculum teaches it, every protocol-level vulnerability writeup includes Wireshark screenshots, and every "what does this protocol actually look like on the wire" question gets answered with it.

Wireshark started as **Ethereal** in 1998 (renamed in 2006 due to a trademark conflict). The command-line companion **tshark** ships with the same dissector library and is the right tool for scripted / headless captures.

## What Wireshark does

| Capability | What it surfaces |
|---|---|
| **Packet capture** | Read packets from a live interface or a saved `.pcap` / `.pcapng` file. |
| **Protocol dissection** | Decode 3000+ protocols — TCP/IP, HTTP, [TLS](/wiki/tls), DNS, [SMB](/wiki/smb), [Kerberos](/wiki/kerberos), [LDAP](/wiki/ldap), DHCP, etc. |
| **Display filtering** | Filter the visible packets by protocol, address, port, content. `tcp.port == 443 and http.host contains "example"`. |
| **Conversation reconstruction** | Reassemble TCP streams; follow an entire HTTP session, SMB transfer, or RDP login. |
| **Statistics** | Throughput graphs, IO graphs, top conversations, expert findings (retransmissions, duplicates). |
| **Coloring rules** | Visually highlight specific traffic patterns — DNS responses, TCP resets, malformed packets. |

## The capture itself

Wireshark requires raw packet access. On Linux/macOS this means `sudo` or `cap_net_raw` capability; on Windows it ships with **Npcap** as the capture driver.

Capture filters use **BPF (Berkeley Packet Filter)** syntax — they drop packets at kernel level *before* Wireshark sees them. Display filters use Wireshark's own language and apply *after* capture.

Common BPF capture filters:

```
host 10.0.0.5                # Only traffic to/from one IP
port 443                     # Only TLS-typical port
tcp port 80 and net 10.0.0.0/24
not (port 22 or port 53)     # Exclude SSH and DNS noise
```

Common Wireshark display filters:

```
http.request.method == "POST"
tls.handshake.type == 1                    # ClientHellos only
dns.qry.name contains "evil"
kerberos.msg_type == 11                    # AS-REP
smb.cmd                                    # All SMB commands
ip.addr == 10.0.0.5 and not arp
frame contains "password"                  # Cleartext credentials in any payload
```

## Reading a TLS handshake

A common use case — see whether [TLS](/wiki/tls) negotiated correctly:

1. Filter: `tls.handshake`.
2. Find the `ClientHello` (handshake type 1). Wireshark dissects the offered cipher suites, SNI host, ALPN protocols.
3. Find the matching `ServerHello` (handshake type 2). The chosen cipher and version are visible.
4. The `Certificate` message (handshake type 11) carries the server's certificate chain — expand it to see issuer, subject, SAN entries.

Once TLS 1.3 negotiation lands and the keys derive, the rest of the connection is encrypted. To decrypt for analysis (with proper authorization), you can:

- Provide the server's RSA private key (only works for TLS 1.2 with non-PFS cipher suites — rare in 2026).
- Configure the client browser to write a **TLS key log file** (`SSLKEYLOGFILE` environment variable) and load it in Wireshark's TLS preferences. Per-session pre-master secrets let Wireshark decrypt every connection. This is the standard approach.

## Following streams

`Right-click any packet → Follow → TCP Stream` reassembles the entire conversation. For HTTP that's the request and response bodies; for SMB it's the file transfer; for an interactive shell session it's everything that crossed the wire.

The Follow dialog shows the conversation in monospace with the two directions in different colors. Use it to read out passwords (on cleartext protocols) or to extract files from a transfer.

## Detection use cases

Real-world defender workflows:

- **Confirm exfiltration.** SIEM alert flags an outbound HTTPS connection to an unfamiliar IP. Pull the pcap; check the TLS SNI; check whether DNS resolved that IP from a known-malicious domain.
- **Investigate slowness.** "The app is slow." Capture; filter for TCP retransmits and zero-window events. The pcap shows whether the slowness is the client, the network, or the server.
- **Validate a security control.** "Did we actually disable LLMNR?" Capture during a `Responder` test from a different host; filter for `llmnr`. If you see queries, the control is broken.
- **Decode protocols a SIEM can't.** Industrial protocols, custom binary protocols, anything not in the SIEM's parser library — Wireshark's dissectors cover most of it.

## tshark — the command-line tool

For scripted analysis, `tshark` is the right tool. It uses the same dissector library and filter syntax as Wireshark:

```bash
# Capture 100 packets on eth0 to a file
tshark -i eth0 -c 100 -w capture.pcap

# Print HTTP host headers from a saved pcap
tshark -r sample.pcap -Y 'http.request' -T fields -e http.host -e http.request.uri

# Print TCP conversations sorted by byte count
tshark -r sample.pcap -q -z conv,tcp

# Extract every DNS query name
tshark -r sample.pcap -Y 'dns.qry.name' -T fields -e dns.qry.name | sort -u
```

`tshark` is what fits in CI pipelines, incident-response scripts, and the analysis half of a custom packet inspection workflow.

## Where Wireshark can't help

- **Encrypted payloads without keys.** TLS 1.3 connections without an `SSLKEYLOGFILE` are opaque past the handshake.
- **Switched networks without a tap.** A switch only forwards unicast traffic to the destination port — you'll only see broadcast and your own traffic without a SPAN port or a network TAP.
- **Cloud / VM internal traffic.** Without access to a tap point inside the VPC/VNET, packets between cloud workloads don't traverse anywhere you can capture.

The defender's pre-incident work is positioning capture points (or cloud-native equivalents like AWS VPC Traffic Mirroring) ahead of time.

## Further reading

- [Wireshark User's Guide](https://www.wireshark.org/docs/wsug_html_chunked/).
- [SANS Wireshark cheat sheet](https://www.sans.org/posters/wireshark-tcp-ip-cheat-sheet/).
- [Malware Traffic Analysis (Brad Duncan)](https://www.malware-traffic-analysis.net/) — free Wireshark capture exercises with answers.
