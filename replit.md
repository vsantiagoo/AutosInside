# Inventory Management System

## Overview

This is a full-stack inventory management system built with React, Express, and SQLite. The application provides comprehensive tracking of products, stock transactions, and consumption records with role-based access control. It features a Material Design-inspired interface optimized for data-intensive productivity workflows.

The system enables users to manage product catalogs organized by sectors, track stock movements (additions and removals), monitor consumption by employees, and generate reports. Admin users have additional capabilities for managing users and organizational sectors.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System**
- **React 18** with TypeScript for the user interface
- **Vite** as the build tool and development server
- **React Router** for client-side routing with separate login pages
- **TanStack Query (React Query)** for server state management, caching, and data synchronization

**Routing Architecture**
- Separate login pages for different user types:
  - `/` - User login (matricula only, no password)
  - `/admin-login` - Admin login (matricula + password required)
- Auth-driven routing: Login pages don't manually navigate; auth state updates trigger automatic route switching
- `AppRouter` component separates unauthenticated and authenticated route trees to avoid race conditions
- `ProtectedRoute` component guards admin-only routes (users management, sectors management)
- After successful login, auth context update causes automatic redirect to `/dashboard`

**UI Component System**
- **Shadcn/ui** components built on Radix UI primitives
- **Tailwind CSS** for styling with a custom Material Design-inspired theme
- **Class Variance Authority (CVA)** for component variant management
- Typography uses **Roboto** font family loaded from Google Fonts CDN

**State Management Pattern**
- Server state managed by React Query with query invalidation
- Authentication state maintained in React Context (`AuthProvider`)
- Form state managed by React Hook Form with Zod validation
- No global client state management library (Redux, Zustand, etc.)

**Design System**
- Material Design principles focused on information density and efficiency
- Custom color system using HSL CSS variables for theme flexibility
- Elevation system using subtle shadows and overlays (`--elevate-1`, `--elevate-2`)
- Responsive grid layouts with mobile-first breakpoints

### Backend Architecture

**Server Framework**
- **Express.js** running on Node.js with TypeScript
- ESM module system (`"type": "module"` in package.json)
- Custom middleware for request logging and JSON response capture
- Cookie-based session management with JWT authentication

**API Design**
- RESTful endpoints under `/api` prefix
- Endpoint groups: `/auth`, `/users`, `/sectors`, `/products`, `/stock-transactions`, `/consumptions`, `/dashboard`
- File upload support via Multer for product photos (5MB limit, images only)
- Excel export functionality using ExcelJS library

**Authentication & Authorization**
- **Dual-mode authentication system**:
  - Regular users: Login with matricula only (no password required)
  - Admin users: Login with matricula + password (both required)
- JWT tokens stored in HTTP-only cookies
- Password hashing with bcrypt (10 salt rounds)
- Role-based access control: `admin` and `user` roles
- Protected routes check authentication middleware
- Admin-only endpoints for user and sector management
- Password enforcement: Admin role requires password (validated on creation and role promotion)

**Request/Response Flow**
- Request validation using Zod schemas (shared between client and server)
- Centralized error handling with appropriate HTTP status codes
- JSON response format with captured logging for debugging
- CORS handled implicitly through Vite proxy in development

### Data Storage

**Database**
- **better-sqlite3** for SQLite database operations
- Write-Ahead Logging (WAL) mode enabled for better concurrency
- Database file: `data.db` in project root
- File-based storage in `uploads/` directory for product photos

**Schema Design**
- **users**: Authentication, roles (admin/user), matricula (employee ID)
- **sectors**: Product categorization/organization
- **products**: Inventory items with SKU, pricing, stock levels, photos, and aggregated transaction totals
- **stock_transactions**: Record of all stock movements (in/out) with timestamps and reasons
- **consumptions**: Employee consumption records linking users and products with quantities

**Data Access Pattern**
- Storage abstraction layer (`IStorage` interface in `storage-sqlite.ts`)
- Synchronous SQLite operations (better-sqlite3 is synchronous by design)
- Type-safe queries with TypeScript interfaces derived from Zod schemas
- Aggregate fields (`total_in`, `total_out`, `total_consumed`) maintained on products table

**Migrations**
- SQL migrations in `server/migrations.sql` executed on startup
- Schema defined in `shared/schema.ts` using Zod for validation
- Drizzle Kit configured but not actively used (configuration points to PostgreSQL, but app uses SQLite)
- Database seeding: Default admin user (`admin`/`admin123`) and sample sectors created on first run

### External Dependencies

**Key Third-Party Libraries**
- **@radix-ui/***: Headless UI primitives for accessible components
- **date-fns**: Date formatting and manipulation
- **exceljs**: Excel file generation for reports
- **jsonwebtoken**: JWT token creation and verification
- **multer**: Multipart form data handling for file uploads
- **zod**: Runtime type validation and schema definition

**Development Tools**
- **tsx**: TypeScript execution for development server
- **esbuild**: Production build bundling for server code
- **@replit/vite-plugin-***: Replit-specific development enhancements

**Build & Deployment**
- Development: `npm run dev` - Vite dev server with HMR and tsx for backend
- Production build: `npm run build` - Vite builds frontend, esbuild bundles backend
- Production start: `npm start` - Runs compiled server from `dist/` directory
- Database operations: `npm run db:push` - Drizzle Kit schema push (configured but unused)

**Environment Requirements**
- `DATABASE_URL` environment variable (configured for PostgreSQL via Drizzle but not used)
- `SESSION_SECRET` for JWT signing
- Node.js with ESM support
- File system access for SQLite database and uploads directory

**Note on Database Configuration**
The application has a hybrid database configuration: Drizzle Kit is configured for PostgreSQL (`drizzle.config.ts`), but the actual implementation uses SQLite via better-sqlite3. This suggests the project may have originally used or planned to use PostgreSQL, but currently operates entirely on SQLite for simplicity.

## Recent Changes (November 2025)

### React Router Refactoring
- **Migrated from Wouter to React Router** for enhanced routing capabilities
- **Implemented separate login pages**:
  - User login at `/` (matricula only)
  - Admin login at `/admin-login` (matricula + password)
  - Navigation links between login pages for user convenience
- **Resolved authentication race conditions** by removing manual navigation from login forms
- **Auth-driven routing**: Login success updates auth context, which automatically triggers route switching to authenticated views
- Architecture now uses conditional rendering in `AppRouter`: unauthenticated users see login routes, authenticated users see app routes with sidebar
- All end-to-end tests passing for both user and admin login flows

### Login UX & Accessibility Enhancements
- **Password Visibility Toggle**: Admin login now features eye icon button to show/hide password (fully keyboard accessible)
- **Case-Insensitive Authentication**: Backend performs case-insensitive matricula lookups; users can enter any case variation
- **Smart Form Validation**: Matricula auto-converts to uppercase, password minimum length (3 chars), whitespace trimming
- **Enhanced Error Messages**: Specific feedback for different error types:
  - "User account not found" vs "Incorrect password"
  - "This is an admin account. Please use Admin Login" for role mismatch
  - Password field automatically cleared on failed admin login
- **Improved Accessibility**:
  - ARIA labels on all form inputs and buttons
  - Autocomplete attributes for better browser integration
  - Full keyboard navigation support (Tab through all form elements)
  - Password toggle accessible via keyboard (Tab + Enter/Space)
- **Auth State Reliability**: Query invalidation after login ensures immediate UI updates and automatic dashboard redirect
- **Security Maintained**: HTTP-only cookie authentication (more secure than localStorage-based approaches)

### Food Station Feature (November 2025)
- **New Quick Consumption Page**: Added `/food-station` route for rapid consumption tracking
- **Streamlined UX**: Card-based product selection interface with increment/decrement controls
- **Product Photos**: Each product card displays product photo (if available) with 16:9 aspect ratio, or placeholder icon
- **Multi-Product Selection**: Users can select multiple products with custom quantities in a single session
- **Real-Time Summary**: Alert banner displays total items selected and total value
- **Auto-Logout Flow**: "End Session" button records all consumptions and automatically logs out user after 1.5 seconds
- **Stock Awareness**: Only displays products with available stock (stock_quantity > 0)
- **Query Integration**: Proper cache invalidation for consumptions, products, and dashboard stats after session completion
- **Accessible UI**: Full keyboard navigation, disabled states, and comprehensive test IDs for all interactive elements

### Brazilian Portuguese Localization (November 2025)
- **Complete Translation**: Entire system translated to Brazilian Portuguese including all user-facing text
- **Translated Pages**:
  - Login pages (user and admin login) with all form labels, placeholders, and error messages
  - Sidebar navigation and application header
  - Dashboard page with stats cards, alerts, and consumption history
  - Products page with filters, forms, dialogs, empty states, and table headers
  - Stock Transactions page with forms, dialogs, and transaction history
  - Consumptions page with recording forms and export functionality
  - Food Station page with all buttons, labels, and toast notifications
  - Admin Users page with user management forms and dialogs
  - Admin Sectors page with sector management forms and dialogs
- **Currency Formatting**: Changed from $ to R$ (Brazilian Real) throughout the application
- **Date Formatting**: Updated from MMM dd, yyyy to dd/MM/yyyy HH:mm (Brazilian standard)
- **Localized Messages**: All toast notifications, validation messages, error messages, success messages, and form descriptions translated
- **Consistent Terminology**: Maintained consistent Portuguese terminology across all features (e.g., "Matrícula" for employee ID, "Setor" for sector, "Estoque" for stock)
- **User Experience**: All user-facing text including buttons, labels, placeholders, dialog titles, empty states, and help text fully localized