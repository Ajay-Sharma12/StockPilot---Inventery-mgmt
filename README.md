# STOCKPILOT — Multi-Tenant Inventory & Operations SaaS Platform

> **Phases 1, 2, 3, 4 & 5 Complete**: Single-Application Multi-Tenant Architecture, Centralized Inventory Ledger Engine, Complete Procurement & Purchase Management, End-to-End Sales & Order-to-Cash (OTC), and Full Production & Manufacturing Lifecycle with Advanced Reporting, Operational Analytics, and AI Readiness.

STOCKPILOT is an enterprise-grade multi-tenant inventory and operations SaaS platform built with the MERN stack and TypeScript.

---

## 🏛️ Core Architectural Principle: Single Application

There is **strictly one application**:
- **One React Frontend**: All personas (Super Admin, Tenant Admin, Operations Manager, Purchase Officer, Store Clerk, Sales Rep, Production Supervisor, QC Inspector, Auditor) operate within the same unified React client.
- **One Backend REST API**: Powered by Express.js, TypeScript, and MongoDB.
- **One Authentication System**: Dual-token JWT architecture (15-minute access tokens paired with rotating 7-day refresh tokens).
- **One Centralized Inventory Service**: The sole source of truth for stock balance mutations and ledger records across the entire platform. Direct database balance mutations are strictly prohibited.
- **One Universal Routing & Gate System**: Dynamic RBAC, ABAC facility scopes, financial approval thresholds, and subscription entitlement tiers.

---

## 🏗️ Architectural Phases & Capabilities

### 🔐 Phase 1: Multi-Tenant Core & Security Shell
- **Data Isolation**: Strict multi-tenant isolation with tenant-scoped query constraints on every document.
- **Role-Based Access Control (RBAC)**: Fine-grained resource verbs (`inventory:read`, `purchase:write`, `production:manage`, etc.).
- **Attribute-Based Access Control (ABAC)**: Warehouse facility restrictions (e.g. `['WH-NORTH', 'WH-CENTRAL']`) and financial approval limits (e.g. `$50,000`).
- **Subscription Entitlements**: Quotas and feature flags evaluated per plan tier (`Free`, `Starter`, `Growth`, `Enterprise`).
- **Audit Logging**: Immutable audit journal capturing authentication events, configuration changes, and entity mutations.

### 📦 Phase 2: Master Data & Centralized Inventory Engine
- **Master Data & Hierarchy**: Categorization, subcategories, Units of Measure (UOM) with direct/inverse conversions, and multi-level warehouse hierarchy (Warehouse $\rightarrow$ Zone $\rightarrow$ Rack $\rightarrow$ Bin).
- **Entity Directories**: Suppliers, Customers, Departments, Tax Codes, Payment Terms, Currencies, and Reason Codes.
- **Centralized Inventory Service**: Unified ledger engine for stock receipts, issues, transfers, and adjustments.
- **Weighted Average Costing (WAC)**: Dynamically calculated upon every inbound receipt.
- **Immutable Ledger Journal**: Tamper-evident transaction logs (`TXN-xxxxx`) for 100% balance auditability.
- **Operational Workflows**: Inter-warehouse stock transfers, physical cycle count variance reconciliations, and scrap/wastage processing.

### 🛍️ Phase 3: Procurement & Purchase Management Lifecycle
- **Purchase Requisitions (PR)**: Departmental demand creation, budget checking, and manager approvals.
- **Requests for Quotation (RFQ)**: Multi-supplier bidding invitations and deadline enforcement.
- **Supplier Quotations**: Line-item pricing, discounts, lead times, and side-by-side comparison matrix.
- **Purchase Orders (PO)**: Tiered ABAC financial approval gates and dispatch to suppliers.
- **Goods Receipt Notes (GRN)**: Split-receipt support, receiving dock staging, and automated QC queue dispatch.
- **Purchase Quality Control (QC)**: Parameterized checklist inspections, partial acceptance/rejection, and automated ledger postings for accepted units only.

### 💼 Phase 4: Sales & Order-to-Cash (OTC) Full Lifecycle
- **Sales Orders (SO)**: Customer quotes, order confirmation, and atomic inventory stock reservation.
- **Packaging Queue**: Physical packing verification with strict anti-over-packaging guards.
- **Outbound Dispatches**: Fulfillment tracking, carrier assignment, and atomic stock issuance from reserved inventory.
- **Security Gate Passes**: Vehicle registration, driver verification, security sign-off, and gate-out tracking.
- **Commercial Invoicing**: Automatic tax calculation, discount processing, and payment term due date scheduling.
- **Payments & Receivables**: Partial and full payments, overpayment guards, payment reversals, and receivables aging.
- **Bi-Directional Lineage DAG**: Complete traceability traversing Customer $\leftrightarrow$ SO $\leftrightarrow$ Package $\leftrightarrow$ Dispatch $\leftrightarrow$ Gate Pass $\leftrightarrow$ Invoice $\leftrightarrow$ Payment.

### 🏭 Phase 5: Production, QC, Reporting, Analytics & AI
- **Bill of Materials (BOM)**: Multi-level BOM versioning with circular dependency cycle detection DAG checks.
- **Material Requirements Planning (MRP)**: Gross vs net demand calculation with component scrap factor allowances.
- **Production Work Orders**: Full lifecycle (`PLANNED` $\rightarrow$ `APPROVED` $\rightarrow$ `RELEASED` with atomic stock reservation $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED`).
- **Material Consumption Tracking**: Controlled consumption from reserved stock with configurable over-consumption tolerance guardrails.
- **Batch Registry & Auto-Spawned QC**: Batch tracking (`BAT-xxxxx`) and automatic creation of production inspection tickets (`QCP-xxxxx`).
- **Strict QC Disposition Gating**: Only dispositioned, approved units enter available stock with updated WAC; rejected units are quarantined.
- **Production Costing & Variance Analysis**: Planned vs actual material, labor, and overhead cost comparison.
- **Enterprise Reporting Engine**: Dynamic queries with ABAC filtering, summary aggregation, and RFC-4180 CSV export generation.
- **Operational Analytics Dashboard**: Real-time KPI calculations across Yield Rate, Scrap Rate, Inventory Turnover, and Order Cycle Times.
- **AI Intelligence & Copilot Readiness**: Structured context extraction across domains, operational anomaly detection, optimization recommendations, and immutable `AIAudit` logging.

---

## 🚀 Quick Start

### 1. Start Development Servers
```bash
npm run dev
```
- **Frontend SPA**: `http://localhost:5173`
- **Backend API**: `http://localhost:5000/api/v1`
- **Health Check**: `http://localhost:5000/api/v1/system/health`

*(Note: If a local MongoDB instance is not detected, the server automatically starts an embedded In-Memory MongoDB with full enterprise seed data across Phases 1 through 5).*

---

## 🧪 Automated Acceptance Test Suites

Run each acceptance suite from the `server` directory to verify full multi-tenant isolation, balance integrity, and end-to-end workflows:

```bash
# Phase 1: Multi-Tenant Architecture, Auth & Security Verification
cd server && npx ts-node src/scripts/test_phase1.ts

# Phase 2: Master Data & Centralized Inventory Engine
cd server && npx ts-node src/scripts/testPhase2.ts

# Phase 3: Procurement & Purchase Management Lifecycle
cd server && npx ts-node src/scripts/testPhase3.ts

# Phase 4: Sales & Order-to-Cash (OTC) Full Lifecycle & Traceability DAG
cd server && npx ts-node src/scripts/testPhase4.ts

# Phase 5: Production, QC, Reporting, Analytics & AI Acceptance Suite
cd server && npx ts-node src/scripts/testPhase5.ts
```

All 5 acceptance test suites execute against local or embedded In-Memory MongoDB with **100% pass rates**.

---

## 👥 Pre-Seeded Personas for Testing

All accounts are pre-configured with the default development password: `Password123!`

| Persona | Role | Department | Special Scope / Threshold |
| :--- | :--- | :--- | :--- |
| **Sarah Connor** (`admin@apexlogistics.com`) | Tenant Admin | Executive | Full Organizational Authority ($1M Limit) |
| **David Miller** (`operations@apexlogistics.com`) | Operations Manager | Operations | Operational Oversight ($100k Limit) |
| **Elena Rostova** (`purchase@apexlogistics.com`) | Purchase Officer | Procurement | Approval Limit: **$50,000 USD** |
| **Marcus Vance** (`store@apexlogistics.com`) | Warehouse Clerk | Warehousing | Facilities: **`[WH-NORTH, WH-CENTRAL]`** |
| **Jessica Reynolds** (`sales@apexlogistics.com`) | Sales Representative | Sales | Commercial Orders & Dispatch ($10,000 Limit) |
| **Viktor Alvarez** (`production@apexlogistics.com`) | Production Supervisor | Plant 1 | BOM & Batch Manufacturing |
| **Dr. Mei Chen** (`qc@apexlogistics.com`) | QC Inspector | Quality Assurance | Incoming Shipments & Lot Release |
| **Arthur Davies** (`auditor@apexlogistics.com`) | Compliance Auditor | Internal Audit | Read-Only Compliance & System Logs |
| **Platform Super Admin** (`superadmin@stockpilot.io`) | Super Administrator | Governance | Global Cross-Tenant Management |
