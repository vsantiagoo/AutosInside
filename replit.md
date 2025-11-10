# Inventory Management System

## Overview
This is a full-stack inventory management system built with React, Express, and SQLite. It provides comprehensive tracking of products, stock transactions, and consumption records with role-based access control. The system features a Material Design-inspired interface optimized for data-intensive productivity workflows. Users can manage product catalogs, track stock movements, monitor employee consumption, and generate reports. The system supports a dual-mode authentication system for regular users (matricula only) and admin users (matricula + password), with role-based access control for managing users and organizational sectors. The application is fully localized in Brazilian Portuguese, including currency and date formatting.

## Recent Changes
- **2025-11-10**: Reorganized admin sidebar navigation - Moved "Relatórios" from main Inventário section to Administração section, placing it below "Usuários" and "Setores" for better logical grouping of administrative functions.
- **2025-11-10**: Implemented complete Reports Module (Setor de Relatórios) with predictive analytics and Excel exports. Added 4 report types: (1) FoodStation Restock Prediction with 15-day rolling average analysis, trend detection, confidence scoring, and automatic reorder recommendations with 20% safety buffer; (2) User Consumption Report with daily totals and monthly aggregates; (3) Sector Monthly/Weekly/Biweekly Reports with purchase recommendations and frequency analysis; (4) General Inventory Overview (placeholder). Backend includes `server/services/reporting.ts` with predictive algorithms (linear regression for trend, variance-based confidence, stockout risk assessment), 4 new IStorage methods, and 7 API routes under `/api/reports/*` with Excel export endpoints using ExcelJS. Frontend features `/reports` page (admin-only) with 4 tabs, responsive tables with horizontal scroll on mobile, real-time badges (risk, confidence, priority), product photo thumbnails, sector/cadence filters, and auto-refresh every 60 seconds. All reports fully localized in Brazilian Portuguese with R$ currency formatting.
- **2025-11-10**: Fixed consumption limit input to accept low values (R$ 10, R$ 15, etc.) - Changed input step from "0.01" to "any" to allow arbitrary decimal precision. Updated validation from limit <= 0 to limit < 0.01 with clearer error messages. Added storage-layer boolean normalization via `normalizeUser()` helper to convert SQLite integers (0/1) to TypeScript booleans for `limit_enabled` field, preventing Zod validation failures when frontend sends data back to backend. Applied normalization across all User retrieval methods (getUser, getUserByMatricula, getAllUsers). Users can now set any value >= R$ 0.01 without input restrictions.
- **2025-11-10**: Fixed photo upload functionality - Resolved root cause where file input was using React Hook Form's controlled pattern (with `{...field}`), causing File objects to be converted to string paths (e.g., "C:\fakepath\file.png"). Solution: Removed field spread from file input to make it uncontrolled, allowing handlePhotoChange to manually store File objects via form.setValue(). Frontend now correctly appends File to FormData, apiRequest detects FormData instances and skips JSON headers, backend Multer receives multipart requests properly. Photo uploads now work end-to-end with photos saved to uploads/ directory and paths stored as "/uploads/{filename}" in database.
- **2025-11-09**: Implemented product photo display across all application pages. Photos now appear in Dashboard (Low Stock Alerts, Top Consumed Items, Recent Consumptions), Sector Details products table, Stock Transactions page, and Consumptions page. All views use consistent 48x48px or 64x64px photo thumbnails with Package icon fallback for products without images. Updated backend queries (getAllStockTransactions, getStockTransactionsBySector, getAllConsumptions, getRecentConsumptions, getUserConsumptions, getTopConsumedItems) to include photo_path in results. Added photo_path to ConsumptionWithDetails, StockTransactionWithProduct, and TopConsumedItem types.

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
- **Data Access**: Storage abstraction layer (`IStorage`), synchronous SQLite operations, type-safe queries with TypeScript interfaces, Zod for schema validation. Storage methods (createProduct, bulkCreateProducts, updateProduct) handle complete 21-column Product schema including all expanded fields. getProductsBySector, getSectorPerformanceIndicators, getStockTransactionsBySector for sector-specific operations. Inventory valuation uses `unit_price` (acquisition cost) per GAAP/IFRS accounting standards.
- **Migrations**: SQL migrations in `server/migrations.sql` executed on startup. Database seeding for default admin and sample sectors. Manual schema evolution via ALTER TABLE for columns added post-initial-deployment (expiry_date, warranty_date).
- **Financial Data Model**: System distinguishes between `unit_price` (acquisition/purchase cost from supplier) and `sale_price` (selling price/revenue). **Critical**: sale_price is user-facing validated value displayed in FoodStation, Products page, and consumption tracking. unit_price used for internal accounting and inventory valuation per GAAP/IFRS standards. Frontend/backend fully support sale_price persistence via POST/PUT /api/products endpoints with partial update safety (absent fields preserved).

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
- **Product Forms**: Unified ProductForm component shared across Products and Sector Details pages with context-aware behavior (defaultSectorId, showSectorSelector, additionalQueryKeys props). SKU field is nullable, full localization, enhanced error messages for product deletion (e.g., when products have related consumptions). Product schema expanded with 15+ fields organized in 6 sections: Basic Info (name, description, SKU, category, unit_measure), Financial Data (unit_price as acquisition cost, sale_price as revenue), Inventory Control (stock_quantity, min/max quantities, low_stock_threshold), Supplier/Assets (supplier, asset_number), Dates (purchase, expiry, warranty), and Photo Upload. Form uses nullish coalescing (`??`) to preserve legitimate zero values for numeric fields. Both named and default exports for compatibility.
- **Sector Details Page**: Comprehensive sector management at `/sector/:id` (admin-only) featuring:
  - **KPI Cards**: Real-time metrics for total products, inventory value, low stock alerts, and out-of-stock items
  - **Performance Indicators**: Stock turnover rate, coverage days, and stockout frequency with 30-day calculations
  - **Product Management**: Full product listing with expanded details (SKU, category, unit measure, pricing, stock status, supplier). Dialog-driven product creation/editing via shared ProductForm component with all 15+ fields. Edit button (pencil icon) in Actions column of products table. Dialog titles adapt dynamically ("Novo Produto" vs "Editar Produto")
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