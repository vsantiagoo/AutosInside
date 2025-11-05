# Inventory Management System

## Overview
This is a full-stack inventory management system built with React, Express, and SQLite. It provides comprehensive tracking of products, stock transactions, and consumption records with role-based access control. The system features a Material Design-inspired interface optimized for data-intensive productivity workflows. Users can manage product catalogs, track stock movements, monitor employee consumption, and generate reports. The system supports a dual-mode authentication system for regular users (matricula only) and admin users (matricula + password), with role-based access control for managing users and organizational sectors. The application is fully localized in Brazilian Portuguese, including currency and date formatting.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend Architecture
- **Frameworks**: React 18 with TypeScript, Vite, React Router, TanStack Query.
- **Routing**: Auth-driven routing with separate login pages (`/` for users, `/admin-login` for admins) and role-based post-login redirection. Protected routes for admin-only access.
- **UI/UX**: Shadcn/ui components on Radix UI, Tailwind CSS with a custom Material Design-inspired theme, Class Variance Authority (CVA), Roboto font.
- **State Management**: React Query for server state, React Context for authentication, React Hook Form with Zod for form state.
- **Design System**: Material Design principles, HSL CSS variables for theming, elevation system, responsive grid layouts.

### Backend Architecture
- **Server**: Express.js on Node.js with TypeScript (ESM).
- **API**: RESTful endpoints under `/api`, supporting file uploads (Multer) and Excel export (ExcelJS).
- **Authentication**: Dual-mode (matricula only for users, matricula + password for admins), JWT tokens in HTTP-only cookies, bcrypt for password hashing (10 salt rounds).
- **Authorization**: Role-based access control (`admin`, `user`).
- **Request/Response**: Zod for validation, centralized error handling, JSON responses, CORS via Vite proxy in development.

### Data Storage
- **Database**: `better-sqlite3` for SQLite (`data.db`) with WAL mode. File-based storage for product photos (`uploads/`).
- **Schema**: `users`, `sectors`, `products`, `stock_transactions`, `consumptions` tables. Products table includes aggregated transaction totals.
- **Data Access**: Storage abstraction layer (`IStorage`), synchronous SQLite operations, type-safe queries with TypeScript interfaces, Zod for schema validation.
- **Migrations**: SQL migrations in `server/migrations.sql` executed on startup. Database seeding for default admin and sample sectors.

### Feature Specifications
- **Login UX**: Password visibility toggle, case-insensitive matricula lookup, smart form validation (matricula auto-uppercase, password length), enhanced error messages, improved accessibility (ARIA labels, autocomplete, keyboard navigation).
- **Food Station**: New `/food-station` route for quick consumption tracking with an inline list view, checkbox-based selection, real-time summary, and auto-logout. Displays products with available stock from the "FoodStation" sector. Records consumption timestamps in America/Sao_Paulo timezone.
- **Localization**: Complete Brazilian Portuguese translation for all user-facing text, currency (R$), and date formatting (dd/MM/yyyy HH:mm).
- **Product Forms**: SKU field is nullable, full localization, enhanced error messages for product deletion (e.g., when products have related consumptions).

## External Dependencies
- **Third-Party Libraries**:
    - `@radix-ui/*`: Headless UI primitives.
    - `date-fns`: Date formatting and manipulation.
    - `exceljs`: Excel file generation.
    - `jsonwebtoken`: JWT token management.
    - `multer`: Multipart form data handling.
    - `zod`: Runtime type validation and schema definition.
- **Development Tools**:
    - `tsx`: TypeScript execution for development.
    - `esbuild`: Production bundling for backend.
    - `@replit/vite-plugin-*`: Replit-specific enhancements.
- **Environment Requirements**: `SESSION_SECRET` for JWT signing, Node.js with ESM support, file system access for SQLite and uploads.