# Inventory Management System

## Overview
This is a full-stack inventory management system for tracking products, stock transactions, and consumption with role-based access control. It features a Material Design-inspired interface, optimized for data-intensive productivity workflows. Users can manage product catalogs, track stock movements, monitor employee consumption, and generate reports. The system supports dual-mode authentication (user via matricula, admin via matricula + password) and is fully localized in Brazilian Portuguese, including currency and date formatting. The business vision is to provide a comprehensive, efficient, and user-friendly solution for inventory management, improving operational efficiency and providing actionable insights for stock control and consumption patterns.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend Architecture
- **Frameworks**: React 18 with TypeScript, Vite, React Router, TanStack Query.
- **UI/UX**: Shadcn/ui components on Radix UI, Tailwind CSS with a custom Material Design-inspired theme, Class Variance Authority (CVA), Roboto font. Material Design principles, HSL CSS variables for theming, elevation system, responsive grid layouts.
- **State Management**: React Query for server state, React Context for authentication, React Hook Form with Zod for form state.
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints.
- **Navigation Structure**: Reports Hub (`/reports`), User Menu access to "Estação de Alimentos".

### Backend Architecture
- **Server**: Express.js on Node.js with TypeScript (ESM).
- **API**: RESTful endpoints under `/api`, supporting file uploads (Multer) and Excel export (ExcelJS).
- **Authentication**: Dual-mode (matricula only for users, matricula + password for admins), JWT tokens in HTTP-only cookies, bcrypt for password hashing.
- **Authorization**: Role-based access control (`admin`, `user`).
- **Request/Response**: Zod for validation, centralized error handling, JSON responses.

### Security Features
- **Helmet.js**: Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
- **Rate Limiting**: Login attempts (20 per 15 mins/IP), General API (200 requests per min/IP).
- **Password Requirements**: Minimum 8 characters with uppercase, lowercase, and number.
- **SQL Injection Prevention**: Parameterized statements.
- **XSS Prevention**: Content Security Policy, input validation.
- **CSRF Protection**: HTTP-only cookies with SameSite.
- **File Upload Security**: Type validation, size limits (5MB images, 10MB imports).
- **Request Body Limits**: Maximum 10MB.

### Data Storage
- **Database**: PostgreSQL (Neon-backed) with Drizzle ORM.
- **ORM Configuration**: `server/db.ts` (connection pool), `drizzle.config.ts` (CLI config).
- **Schema Definition**: `shared/schema.ts` using Drizzle `pgTable` with proper types (serial, text, integer, real, boolean, timestamp).
- **File Storage**: Product photos (`uploads/`).
- **Tables**: `users`, `sectors`, `products`, `stock_transactions`, `consumptions` with foreign key relations.
- **Data Access**: Storage abstraction layer (`IStorage`) in `server/storage.ts`, async Drizzle queries, type-safe with parameterized statements.
- **Migrations**: Use `npm run db:push` for schema changes (never write manual SQL migrations).
- **Financial Data Model**: `unit_price` (acquisition cost) and `sale_price` (user-facing).
- **Development Seeding**: `seedDatabase()` in `server/storage.ts` creates sample data on startup in dev mode.

### Feature Specifications
- **Login UX**: Password visibility toggle, case-insensitive matricula lookup, smart form validation, enhanced error messages, improved accessibility.
- **Food Station**: Quick consumption tracking with inline list view, checkbox-based selection, real-time summary, auto-logout, and consumption timestamp recording.
- **Enhanced Dashboard** (Admin-only): Comprehensive real-time dashboard at `/dashboard` with sector-based filtering, KPI cards (Total Products, Low Stock Alerts, Monthly Consumptions, Total Inventory Value), Low Stock Alerts, Top Consumed Items, and Recent Consumptions.
- **Inventory Management**: `/inventory` route (admin-only) displays comprehensive KPIs by sector, with Excel export functionality.
- **Sector Reports**: Admin users can generate and download comprehensive Excel reports for each sector.
- **Localization**: Complete Brazilian Portuguese translation for all user-facing text, currency (R$), and date formatting.
- **Product Forms**: Unified ProductForm component with 15+ fields covering Basic Info, Financial Data, Inventory Control, Supplier/Assets, Dates, and Photo Upload, including product visibility control (inverted checkbox logic for `visible_to_users`).
- **Sector Details Page**: Comprehensive sector management at `/sector/:id` (admin-only) with real-time KPIs, product management, and transaction history.
- **Monthly Consumption Limits**: Users can configure and track monthly spending limits.
- **Consumption Reporting**: Users can view personal consumption history with date filtering and monthly totals.
- **Stock Movements Management** (`/stock`) (Admin-only): Comprehensive stock movement tracking interface with multi-criteria filtering, transaction creation, and detailed history. Features include advanced filters, a transaction creation form with real-time stock validation, a paginated transaction history table, client-side pagination, and context-aware empty states. Cache invalidation ensures real-time updates across related views.
- **Advanced Reporting Module** (Admin-only):
    - **Relatório FoodStation**: Detailed consumption tracking with user filtering, date range selection, KPIs, comprehensive table, monthly totals visualization, and dual-format Excel export (Consolidado and Detalhado).
    - **Coffee Machine Report**: Weekly/biweekly monitoring with consumption frequency analysis, KPIs, product table, and bar chart visualization.
    - **General Inventory Report**: Consolidated view of all products across all sectors with filtering, KPIs, pie/bar charts, comprehensive product table, and Excel/PDF export.
    - **Sector Management Report**: Generic product management report for all 5 sectors with sector selection, period filtering, KPIs, top 5 products visualization, and detailed table with stock predictions.
    - **FoodStation Consumptions Report (API)**: Customizable detailed consumption report.
    - **Cleaning Sector Report (API)**: Bimonthly control report.
- **Stock Management System with Automatic Updates**: Implemented comprehensive stock movement tracking with automatic propagation to Inventory, Products, and Reports. Backend includes `StockSnapshot` type, `StockMovementFilters`, new storage methods, and API endpoints for stock movements, snapshots, and purchase recommendations. Atomic updates ensure data consistency. Purchase recommendations are prioritized based on stock levels.

## External Dependencies
- **Third-Party Libraries**:
    - `@radix-ui/*`: Headless UI primitives.
    - `date-fns`: Date formatting and manipulation.
    - `exceljs`: Excel file generation.
    - `jsonwebtoken`: JWT token management.
    - `multer`: Multipart form data handling.
    - `zod`: Runtime type validation and schema definition.
    - `bcrypt`: Password hashing.
- **Development Tools**:
    - `tsx`: TypeScript execution for development.
    - `esbuild`: Production bundling for backend.
    - `@replit/vite-plugin-*`: Replit-specific enhancements.
- **Environment Requirements**: `SESSION_SECRET` for JWT signing, Node.js with ESM support, file system access for uploads.