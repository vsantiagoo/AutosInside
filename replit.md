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
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints, ensuring full responsiveness across various devices (375px to 1440px+).
- **Navigation Structure**: 
  - **Reports Hub**: Centralized reports page (`/reports`) provides access to all reports via clickable cards (Relatório FoodStation, Coffee Machine, General Inventory, Sector Management)
  - **User Menu**: Regular users maintain access to "Estação de Alimentos" in main menu

### Backend Architecture
- **Server**: Express.js on Node.js with TypeScript (ESM).
- **API**: RESTful endpoints under `/api`, supporting file uploads (Multer) and Excel export (ExcelJS).
- **Authentication**: Dual-mode (matricula only for users, matricula + password for admins), JWT tokens in HTTP-only cookies, bcrypt for password hashing.
- **Authorization**: Role-based access control (`admin`, `user`).
- **Request/Response**: Zod for validation, centralized error handling, JSON responses, CORS.

### Data Storage
- **Database**: `better-sqlite3` for SQLite (`data.db`) with WAL mode. File-based storage for product photos (`uploads/`).
- **Schema**: `users`, `sectors`, `products`, `stock_transactions`, `consumptions` tables. Products table includes aggregated transaction totals and expanded fields for comprehensive product tracking. Stock transactions include user tracking, transaction types, and document origin.
- **Data Access**: Storage abstraction layer (`IStorage`), synchronous SQLite operations, type-safe queries with TypeScript interfaces, Zod for schema validation.
- **Migrations**: SQL migrations in `server/migrations.sql` executed on startup. Database seeding for default admin and sample sectors.
- **Financial Data Model**: Distinguishes between `unit_price` (acquisition cost for internal accounting) and `sale_price` (user-facing, for revenue tracking).

### Feature Specifications
- **Login UX**: Password visibility toggle, case-insensitive matricula lookup, smart form validation, enhanced error messages, improved accessibility.
- **Food Station**: Quick consumption tracking with inline list view, checkbox-based selection, real-time summary, and auto-logout. Records consumption timestamps in America/Sao_Paulo timezone.
- **Enhanced Dashboard** (Admin-only): Comprehensive real-time dashboard at `/dashboard` with sector-based filtering, KPI cards (Total Products, Low Stock Alerts, Monthly Consumptions, Total Inventory Value), Low Stock Alerts, Top Consumed Items, and Recent Consumptions. Auto-refreshes data every 10-30 seconds.
- **Inventory Management**: `/inventory` route (admin-only) displays comprehensive KPIs by sector, including total products, total inventory value, low stock count, and out-of-stock count, with Excel export functionality.
- **Sector Reports**: Admin users can generate and download comprehensive Excel reports for each sector, including summary, products, stock transactions, and consumption records.
- **Localization**: Complete Brazilian Portuguese translation for all user-facing text, currency (R$), and date formatting.
- **Product Forms**: Unified ProductForm component with 15+ fields covering Basic Info, Financial Data, Inventory Control, Supplier/Assets, Dates, and Photo Upload. Includes product visibility control.
- **Sector Details Page**: Comprehensive sector management at `/sector/:id` (admin-only) with real-time KPIs, performance indicators, product management (creation/editing via dialog), and transaction history. Auto-refreshes data every 15-30 seconds.
- **Monthly Consumption Limits**: Users can configure monthly spending limits with real-time tracking, progress bars, and automatic validation in FoodStation.
- **Consumption Reporting**: Users can view personal consumption history with date filtering and monthly totals.
- **Product Visibility Control**: Admins can hide products from regular users' FoodStation view while maintaining full reporting integrity. The feature uses **inverted checkbox logic**: when "Ocultar do FoodStation" is **checked**, the product is **hidden** (`visible_to_users=false`); when **unchecked**, it is **visible** (`visible_to_users=true`). The default is unchecked (visible). Hidden products are excluded from `/api/products` for regular users but always included for admins. All reports intentionally exclude visibility filtering for accurate analytics. React Query cache invalidation uses predicate matching to synchronize product changes across all screens (Products, Sectors, Inventory, Dashboard).
- **Advanced Reporting Module** (Admin-only):
  - **Relatório FoodStation** (`/foodstation-consumption-control`): Detailed consumption tracking with user filtering (all users or individual), date range selection, KPIs (total items, total value, period coverage, record count), comprehensive table showing matricula, user name, product details, quantities, unit prices, and consumption timestamps, monthly totals visualization (top 3 users in highlight cards + remaining users in scrollable table), and **consolidated Excel export** generating one row per user with 4 fixed columns: Matrícula, Nome Completo, Valor Total Mensal (numeric currency cells with BRL formatting), and Período (DD/MM/YYYY a DD/MM/YYYY format). Export inherits applied filters. Excel cells use numeric values with proper currency formatting (`numFmt: "R$ "#,##0.00`) enabling sorting and aggregations. **Bug Fix (Nov 11, 2025)**: Backend route now correctly extracts filters from nested `filters` object (`exportOptions.filters.userId` instead of `exportOptions.userId`), ensuring user and date range filters are properly applied to exports. Auto-refresh every 30 seconds.
  - **Coffee Machine Report** (`/coffee-machine-report`): Weekly/biweekly monitoring with consumption frequency analysis, KPIs (total products, exits, value, high-frequency items, weekly average), product table with stock levels and suggested reorder cadence, and bar chart visualization of top consumed products. Auto-refresh every 30 seconds.
  - **General Inventory Report** (`/general-inventory`): Consolidated view of all products across all sectors with filtering by sector/keyword, KPIs (total products/sectors/value, low/out-of-stock items), pie chart showing value distribution by sector, horizontal bar chart of sector totals, comprehensive product table, and Excel/PDF export capabilities. Auto-refresh every 30 seconds.
  - **Sector Management Report** (`/sector-management-report`): Generic product management report for all 5 sectors (FoodStation, Limpeza, Materiais de Escritório, Máquina de Café, Máquinas e Equipamentos). Features sector selection, period filtering (15/30/60/90 days), KPIs (total products, entries, exits, inventory value, reorder value), top 5 products visualization with progress bars, and detailed table with stock predictions including average daily consumption, days until stockout, recommended reorder quantity, next order date, and status badges. Auto-refresh every 30 seconds.
  - **FoodStation Consumptions Report** (API): Customizable detailed consumption report with support for grouping by user/product/date and field selection via `/api/reports/foodstation/consumptions`.
  - **Cleaning Sector Report** (API): Bimonthly control report with opening/closing stock snapshots, purchase calculations, and month-over-month comparison via `/api/reports/sector/cleaning`.

## External Dependencies
- **Third-Party Libraries**:
    - `@radix-ui/*`: Headless UI primitives.
    - `date-fns`: Date formatting and manipulation.
    - `exceljs`: Excel file generation.
    - `jsonwebtoken`: JWT token management.
    - `multer`: Multipart form data handling.
    - `zod`: Runtime type validation and schema definition.
    - `bcrypt`: Password hashing.
    - `better-sqlite3`: SQLite database driver.
- **Development Tools**:
    - `tsx`: TypeScript execution for development.
    - `esbuild`: Production bundling for backend.
    - `@replit/vite-plugin-*`: Replit-specific enhancements.
- **Environment Requirements**: `SESSION_SECRET` for JWT signing, Node.js with ESM support, file system access for SQLite and uploads.