# replit.md

## Overview

This is a multi-tenant, enterprise-grade Student Consulting CRM SaaS application built with a modern full-stack architecture. The system provides comprehensive CRM functionality for student consulting firms, including lead management, application tracking, university database integration, and payment processing. It features nested sub-account capabilities similar to GoHighLevel, allowing agencies to manage multiple branches, franchises, or agent accounts with complete data isolation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite for build tooling
- **UI Library**: Shadcn/ui components with Radix UI primitives for accessibility
- **Styling**: Tailwind CSS with CSS variables for theming and dark mode support
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing with protected routes
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy using session-based auth
- **Session Storage**: PostgreSQL session store for production scalability
- **Password Security**: Scrypt-based password hashing with salt

### Data Storage
- **Primary Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon serverless PostgreSQL for cloud deployment
- **Schema Management**: Drizzle Kit for migrations and schema management
- **Multi-tenancy**: Row-level security with tenant and sub-account isolation

### Authentication & Authorization
- **Strategy**: Session-based authentication with express-session
- **Role-Based Access Control**: Four-tier system (tenant_admin, sub_account_admin, agent, student)
- **Security**: HTTPS enforcement, secure session cookies, CSRF protection ready

### External Dependencies

- **Payment Processing**: Stripe integration for subscription billing and payment processing
- **AI Services**: OpenAI GPT-5 for lead scoring and intelligent assistance
- **University Data**: External APIs including universities.hipolabs.com and College Scorecard API
- **Email Services**: Ready for integration (infrastructure in place)
- **Cloud Storage**: Prepared for document management (schema includes document handling)
- **WebSocket Support**: Configured for real-time features via Neon serverless
- **Development Tools**: Replit-specific plugins for development environment integration

The application follows a domain-driven design with clear separation between tenant, sub-account, and user contexts, ensuring complete data isolation and scalable multi-tenancy.