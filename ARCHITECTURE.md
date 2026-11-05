# StockPilot Architecture & Folder Structure Guide

## 1. Executive Summary

StockPilot is structured as a **Modular Monolith Multi-Tenant SaaS Platform**. This architecture aligns with modern enterprise engineering practices (similar to NestJS, Shopify, and Linear), balancing speed of development with clean modular separation for long-term scalability.

---

## 2. High-Level Project Structure

```
StockPilot/
├── client/                     # Frontend Application (React 18 + Vite + TypeScript)
│   ├── src/
│   │   ├── api/                # Typed API client layer (domain-partitioned)
│   │   │   └── index.ts        # Barrel export for clean @/api imports
│   │   ├── components/         # Reusable Component Hierarchy
│   │   │   ├── layout/         # AppLayout, Sidebar, Navbar
│   │   │   ├── common/         # Domain-generic widgets (ErrorBoundary, ProtectedRoute)
│   │   │   └── ui/             # Primitive Atomic Design System (Select, Button, Modal, etc.)
│   │   │       └── index.ts    # Barrel export for clean @/components/ui imports
│   │   ├── context/            # Global React state (AuthContext, ToastContext, etc.)
│   │   ├── hooks/              # Custom reactive hooks (usePermissions, useAuth, etc.)
│   │   ├── pages/              # Feature-Driven Page Modules
│   │   │   ├── auth/           # Login, Registration, Password recovery
│   │   │   ├── dashboard/      # Executive KPIs & real-time metrics
│   │   │   ├── inventory/      # Balances, adjustments, ledger, counts, wastage
│   │   │   ├── purchase/       # Requisitions, RFQs, Quotes, POs, GRN, QC, Suppliers
│   │   │   ├── production/     # BOMs, Orders, Planning, QC, Outputs
│   │   │   ├── sales/          # Orders, Invoices, Packaging, Shipments, GatePass
│   │   │   ├── analytics/      # Business intelligence dashboards
│   │   │   ├── reports/        # Custom report generation engine
│   │   │   ├── ai/             # AI Insights & forecasting engine
│   │   │   ├── tenant/         # Company profile, multi-org settings
│   │   │   └── roles/          # Fine-grained RBAC configuration
│   │   ├── routes/             # AppRoutes, navigation definitions
│   │   ├── types/              # Client-side TypeScript interfaces & DTOs
│   │   └── utils/              # Pure utility helpers (cn, formatters, date utils)
│   ├── vite.config.ts          # Vite configuration with @/ path alias
│   └── tsconfig.json           # Strict TypeScript config with @/* path mapping
│
├── server/                     # Backend Application (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── app.ts              # Express application setup & middleware pipeline
│   │   ├── server.ts           # Server bootstrap, MongoDB lifecycle & graceful shutdown
│   │   ├── config/             # Environment configs & permission matrix
│   │   ├── core/               # Enterprise core utilities (AppError, logger, responses)
│   │   ├── middleware/         # Pipeline middlewares (auth, tenantContext, rbac, validate)
│   │   ├── jobs/               # Background schedulers, cron tasks, and alert jobs
│   │   │
│   │   ├── models/             # Core Shared Data Models (Mongoose Schemas)
│   │   │   ├── user.model.ts
│   │   │   ├── tenant.model.ts
│   │   │   ├── item.model.ts
│   │   │   ├── warehouse.model.ts
│   │   │   ├── supplier.model.ts
│   │   │   ├── customer.model.ts
│   │   │   └── inventoryTransaction.model.ts
│   │   │
│   │   ├── modules/            # Vertical Slice Feature Modules (Self-contained domains)
│   │   │   ├── procurement/    # Purchase requisitions, RFQs, quotes, POs, GRN, QC
│   │   │   │   ├── controllers/
│   │   │   │   ├── models/
│   │   │   │   ├── routes/
│   │   │   │   ├── services/
│   │   │   │   └── validators/
│   │   │   ├── production/     # BOMs, work orders, planning, outputs, QC
│   │   │   ├── sales/          # Sales orders, shipments, invoices, payments
│   │   │   ├── analytics/      # Data aggregation & KPI calculation
│   │   │   ├── reporting/      # Report templates, export formats
│   │   │   └── ai/             # LLM/forecasting micro-services
│   │   │
│   │   ├── controllers/        # Core entity controllers (auth, inventory, warehouse)
│   │   ├── services/           # Core entity business logic & document numbering
│   │   ├── routes/             # Core API route registry
│   │   ├── validators/         # Zod request validation schemas
│   │   └── repositories/       # Audit & specialized data-access layers
│   ├── tsconfig.json           # Strict TypeScript server config with @/* path mapping
│   └── package.json            # Server dependencies & tsx runtime
│
├── package.json                # Root workspace orchestration (concurrently dev runner)
└── docker-compose.yml          # Containerized development & production deployment
```

---

## 3. Why This Architecture Matches the Modern Market

| Architectural Standard | StockPilot Implementation | Industry Benchmark |
| :--- | :--- | :--- |
| **Separation of Concerns** | Client, Server, and Core/Feature modules are cleanly partitioned | Clean Architecture / DDD |
| **Multi-Tenancy Isolation** | Automatic tenant scoping enforced at middleware level (`tenantContext.middleware.ts`) | B2B Enterprise SaaS |
| **Vertical Slice Modules** | Complex enterprise domains (`procurement`, `production`, `sales`) encapsulate their own routes, services, models, and validators in `server/src/modules/` | Modern Modular Monolith |
| **Atomic UI System** | Primitives in `@/components/ui` (`Select`, `Button`, `Modal`, `Badge`) provide consistent design tokens and dark mode styling | Shadcn UI / Radix pattern |
| **Type Safety** | End-to-end TypeScript compilation with Zod schema validation (returning clean 422 errors) | Full-stack TypeScript |
| **Import Cleanliness** | Path aliases (`@/...`) configured in both Client and Server `tsconfig.json` + Barrel exports | Zero relative path hell |

---

## 4. Developer Conventions

1. **Importing UI Components**:
   ```typescript
   // Recommended (Clean Barrel Import):
   import { Button, Select, Badge, Card, Modal } from '@/components/ui';

   // Also supported:
   import { Select } from '@/components/ui/Select';
   ```

2. **Importing API Services**:
   ```typescript
   // Recommended:
   import { masterDataApi, procurementApi, inventoryApi } from '@/api';
   ```

3. **Adding New Feature Modules**:
   - For complex business domains, place the domain inside `server/src/modules/<new-module>/` containing its own `controllers`, `services`, `routes`, and `validators`.
   - For simple master data entities, leverage the existing `server/src/models/` and `server/src/controllers/masterData.controller.ts`.
