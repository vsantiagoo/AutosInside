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
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints (sm: 640px, md: 768px, lg: 1024px). All screens fully responsive for mobile portrait/landscape, tablet portrait/landscape, and desktop. Typography scales (text-2xl → text-3xl), buttons adapt (w-full → w-auto), layouts flex/stack (flex-col → flex-row), grids collapse (grid-cols-1 → grid-cols-2/3/4). Tested across viewports 375px to 1440px+.

### Backend Architecture
- **Server**: Express.js on Node.js with TypeScript (ESM).
- **API**: RESTful endpoints under `/api`, supporting file uploads (Multer) and Excel export (ExcelJS).
- **Authentication**: Dual-mode (matricula only for users, matricula + password for admins), JWT tokens in HTTP-only cookies, bcrypt for password hashing (10 salt rounds).
- **Authorization**: Role-based access control (`admin`, `user`).
- **Request/Response**: Zod for validation, centralized error handling, JSON responses, CORS via Vite proxy in development.

### Data Storage
- **Database**: `better-sqlite3` for SQLite (`data.db`) with WAL mode. File-based storage for product photos (`uploads/`).
- **Schema**: `users`, `sectors`, `products`, `stock_transactions`, `consumptions` tables. Products table includes aggregated transaction totals and expanded fields for comprehensive product tracking (category, unit_measure, sale_price, supplier, last_purchase_date, expiry_date, warranty_date, asset_number, status, min/max quantities). Stock transactions table includes user tracking, transaction types, and document origin for full traceability.
- **Data Access**: Storage abstraction layer (`IStorage`), synchronous SQLite operations, type-safe queries with TypeScript interfaces, Zod for schema validation. New storage methods: getProductsBySector, getSectorPerformanceIndicators, getStockTransactionsBySector for sector-specific operations.
- **Migrations**: SQL migrations in `server/migrations.sql` executed on startup. Database seeding for default admin and sample sectors.

### Feature Specifications
- **Login UX**: Password visibility toggle, case-insensitive matricula lookup, smart form validation (matricula auto-uppercase, password length), enhanced error messages, improved accessibility (ARIA labels, autocomplete, keyboard navigation).
- **Food Station**: New `/food-station` route for quick consumption tracking with an inline list view, checkbox-based selection, real-time summary, and auto-logout. Displays products with available stock from the "FoodStation" sector. Records consumption timestamps in America/Sao_Paulo timezone. Fully responsive with stacked mobile layout and optimized desktop view.
- **Enhanced Dashboard** (Admin-only): Comprehensive real-time dashboard with sector-based filtering at `/dashboard`. Features include:
  - **Sector Filter**: Dropdown to filter Total Inventory Value and Low Stock Alerts by sector
  - **KPI Cards**: Total Products, Low Stock Alerts, Monthly Consumptions, Total Inventory Value (all with BRL formatting)
  - **Low Stock Alerts**: Real-time alerts for products below threshold, filterable by sector with product details
  - **Top Consumed Items**: Ranked list of most consumed products with quantity, value, and consumption count
  - **Recent Consumptions**: Grid layout of latest consumption records with user, product, and timestamp
  - **Auto-Refresh**: All data auto-updates every 10-30 seconds via React Query refetchInterval
- **Inventory Management**: New `/inventory` route (admin-only) displays comprehensive KPIs by sector including total products, total inventory value, low stock count, and out-of-stock count. API endpoint `/api/inventory/kpis` aggregates metrics across all sectors using SQL queries. Responsive grid layout (1 column mobile, 2 on tablet, 3 on desktop) with Material Design cards and Brazilian Real currency formatting. Each sector card includes an "Exportar" button to download detailed Excel reports.
- **Sector Reports**: Admin users can generate and download comprehensive Excel reports for each sector via `/api/sectors/:id/export`. Reports include four sheets: Resumo (summary with KPIs), Produtos (all products with stock and financial data), Movimentações de Estoque (all stock transactions with user tracking), and Consumos (all consumption records). All data is formatted in Brazilian Portuguese with Real currency and localized dates. Automatic stock updates occur in real-time for all transactions (FoodStation consumptions and stock movements).
- **Localization**: Complete Brazilian Portuguese translation for all user-facing text, currency (R$), and date formatting (dd/MM/yyyy HH:mm).
- **Product Forms**: SKU field is nullable, full localization, enhanced error messages for product deletion (e.g., when products have related consumptions). Product schema expanded with 15+ new fields including category, unit of measure, financial data (sale price), supplier information, validity/warranty dates, asset tracking, and status management.
- **Sector Details Page**: Comprehensive sector management at `/sector/:id` (admin-only) featuring:
  - **KPI Cards**: Real-time metrics for total products, inventory value, low stock alerts, and out-of-stock items
  - **Performance Indicators**: Stock turnover rate, coverage days, and stockout frequency with 30-day calculations
  - **Product Management**: Full product listing with expanded details (SKU, category, unit measure, pricing, stock status, supplier). Inline product registration form with all fields (basic info, financial data, stock control, supplier/patrimony, dates, photo upload)
  - **Transaction History**: Complete stock movement tracking with user attribution, transaction types, reasons, and document origins
  - **Navigation**: Accessible from both Inventory page (via "Ver Detalhes" button) and Admin Sectors page (via eye icon)
  - **Auto-Refresh**: All data refreshes every 15-30 seconds via React Query refetchInterval
- **Monthly Consumption Limits**: Users can configure monthly spending limits with real-time tracking, progress bars, and automatic validation in FoodStation. Limits stored per user with enable/disable toggle.
- **Consumption Reporting**: Users can view personal consumption history with date filtering (by month, custom range, or today). Monthly totals displayed with auto-applied current month filter.

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