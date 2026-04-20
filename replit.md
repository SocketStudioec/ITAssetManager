# TechAssets Pro - Project Documentation

## Overview

TechAssets Pro is a comprehensive IT asset management system designed for Small and Medium-sized Enterprises (SMEs). It enables organizations to track, manage, and optimize their IT resources, including physical assets, software applications, contracts, licenses, and maintenance records. The full-stack web application provides an intuitive dashboard for cost monitoring, report generation, and compliance management across all IT assets.

## User Preferences

**Preferred communication style:** Simple, everyday language, avoiding excessive technical jargon.

**Deployment requirements:** Clean and fast deployment optimized for AlmaLinux 9, no dependencies on Docker, Neon, or other external services.

**Database:** PostgreSQL 17 with native SQL queries (no ORM).

## System Architecture

### Separation Frontend/Backend

The project is clearly separated into two parts:

#### FRONTEND (`/client`)

**Technologies:** React 18 + TypeScript, Vite, Tailwind CSS + shadcn/ui, TanStack Query (React Query v5), Wouter, React Hook Form + Zod, Recharts.

**Features:** Single Page Application (SPA), REST API communication, state management with TanStack Query, accessible UI with Radix UI primitives.

#### BACKEND (`/server`)

**Technologies:** Node.js 18+ + TypeScript, Express.js, `pg` (node-postgres), bcrypt, express-session, connect-pg-simple.

**Features:** REST API with JSON, native SQL queries (no ORM), prepared statements, optimized connection pooling, session-based authentication.

#### SHARED (`/shared`)

**Purpose:** Contains shared TypeScript types and Zod validation schemas for consistency across frontend and backend.

### Authentication and Authorization

**Provider:** Email/Password authentication.
**Security:** bcrypt hashing (10 salt rounds) for passwords, Express sessions with PostgreSQL store (connect-pg-simple).
**Roles:** `super_admin`, `manager_owner`, `technical_admin`, `technician` with distinct permissions.
**Environment Variable:** `SESSION_SECRET` required for production.

### Data Layer

**Database:** PostgreSQL 17.
**Queries:** Native SQL using `pg` driver.
**Pattern:** Repository Pattern in `server/storage.ts`.
**Validation:** Zod schemas for runtime validation.
**Data Mapping:** Helper functions to convert `snake_case` (PostgreSQL) to `camelCase` (TypeScript).

### Database Design

Multi-tenant architecture with core entities: `users`, `companies`, `user_companies`, `assets`, `contracts`, `licenses`, `maintenance_records`, `activity_log`, `sessions`.

**Database Features:**
- PostgreSQL 17 (compatible with 15-16).
- Native SQL queries with prepared statements.
- Optimized connection pooling.
- ENUM types for various statuses and roles.
- Optimized indices and foreign keys with CASCADE for data integrity.

### Implemented Design Patterns

- **Repository Pattern:** Abstraction of data access logic (`server/storage.ts`).
- **MVC Pattern:** `Models` (`shared/schema.ts`), `Views` (`client/src/`), `Controllers` (`server/routes.ts`).
- **Session-Based Authentication:** Persistent sessions in PostgreSQL, bcrypt hashing, reusable authentication middleware, httpOnly cookies.
- **Component Composition (Frontend):** Reusable UI components, shared layouts, custom hooks.

### Security Measures

**Backend:** Prepared statements, bcrypt hashing, secure sessions, Zod data validation, multi-tenancy, audit logging.
**Frontend:** HTTPS (production), security headers, client-side validation, no exposure of secrets.
**Database:** Connection pooling limits, timeouts, robust constraints, optimized indices.

### Data Flow

The system follows a classic client-server model: Frontend (React) communicates via HTTP/REST (JSON) with the Backend (Express), which then interacts with PostgreSQL 17 via SQL queries. TanStack Query manages frontend state, while the backend utilizes a Storage Layer (Repository Pattern) for data access.

### Production Deployment Strategy (AlmaLinux 9)

**Stack:** AlmaLinux 9, Node.js 18 LTS, PostgreSQL 17, PM2, Nginx, Let's Encrypt.
**Process:** Involves PostgreSQL setup, dependency installation, application build, PM2 configuration, Nginx as a reverse proxy, SSL certification, and firewall setup.

## External Dependencies

### Database Services
- **PostgreSQL 17:** Local or remote PostgreSQL server.
- **Connection Pooling:** Integrated with native `pg` driver.

### UI Libraries and Components
- **Radix UI:** Headless UI primitives for accessibility.
- **shadcn/ui:** Pre-built component library based on Radix.
- **Lucide React:** Icon library.
- **Recharts:** Charting library for data visualization.

### Development Tools
- **Replit Platform:** Integrated development environment.
- **Vite Plugins:** For enhanced development experience.
- **PostCSS:** CSS processing with Tailwind and Autoprefixer.
- **date-fns:** Date manipulation and formatting library.

### Session Management and Storage
- **connect-pg-simple:** PostgreSQL session store for Express.
- **memoizee:** Function memoization for performance optimization.

### Forms and Validation
- **React Hook Form:** Form state management.
- **Zod:** Schema validation for forms and API data.
- **@hookform/resolvers:** Integration with React Hook Form.