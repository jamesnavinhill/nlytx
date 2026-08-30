# Multi-Cloud Infrastructure & Analytics Telemetry Roadmap

## Architecture Overview
A high-throughput, low-latency monitoring plane for hybrid cloud analytics (Vercel, Cloudflare, GA4) and multi-cloud infrastructure (AWS EC2, Cloudflare Zero Trust Tunnels & Workers, Oracle Cloud OCI Compute).

## Completed Milestones
- [x] Secure server-side credential vault with isolated in-memory stores for analytics and infrastructure tokens.
- [x] AWS EC2 telemetry collector with instance state lifecycle management (start, stop, reboot).
- [x] Cloudflare Zero Trust tunnel monitor with connector status, edge PoP colo breakdown, and Serverless Worker RPS/p50 CPU analytics.
- [x] Oracle OCI Compute telemetry with Ampere ARM/AMD shape tracking and NVMe IOPS.
- [x] Collapsible dual-category sidebar with provider sub-account tree expansion.
- [x] Clean, spacious header with breadcrumb navigation and profile system matrix.

## Future Milestones
- [ ] Kubernetes cluster node & pod telemetry collector (EKS, GKE, OKE).
- [ ] Automated anomaly detection on worker latency and tunnel packet drop rates.
- [ ] Webhook alerts for CloudWatch and Cloudflare Gateway incident notifications.
