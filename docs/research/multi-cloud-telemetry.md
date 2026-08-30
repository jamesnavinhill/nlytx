# Multi-Cloud Telemetry & Zero Trust Monitoring Research

## 1. Cloudflare Zero Trust & Cloudflared Architecture
- **QUIC / HTTP/3 Tunnels**: Cloudflared establishes outbound-only tunnels across multiple Anycast edge PoPs (e.g., IAD, EWR, ORD) without opening firewall ingress ports.
- **Worker Isolates**: Cloudflare Workers run on V8 isolates with sub-millisecond cold starts. Telemetry focuses on requests per second, p50/p99 CPU time, and subrequest concurrency.

## 2. AWS EC2 & CloudWatch Integration
- CloudWatch metric aggregation for `CPUUtilization`, `NetworkIn`/`NetworkOut`, and `DiskReadOps`/`DiskWriteOps`.
- Instance state checks (`StatusCheckFailed_System`, `StatusCheckFailed_Instance`).

## 3. Oracle Cloud Infrastructure (OCI) Compute
- Flex shapes (Ampere A1 ARM with custom OCPU and memory allocations; AMD EPYC VM.Standard3).
- Paravirtualized and dense NVMe block storage IOPS monitoring.
