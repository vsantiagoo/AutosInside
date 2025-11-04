# Design Guidelines: Inventory Management System

## Design Approach: Material Design System
This is a data-intensive productivity application requiring efficient information display and data entry. Material Design provides the ideal framework with its emphasis on information hierarchy, clear interaction patterns, and proven form/table components.

**Core Principles:**
- Efficiency over aesthetics: Prioritize quick task completion
- Information density: Display maximum relevant data without clutter
- Consistent patterns: Users learn once, apply everywhere
- Clear visual hierarchy: Guide users through complex workflows

## Typography System

**Font Family:** Roboto (via Google Fonts CDN)
- Primary: Roboto (400, 500, 700 weights)
- Monospace: Roboto Mono for SKU/matricula display

**Type Scale:**
- Page Headers: text-3xl font-bold (30px)
- Section Headers: text-xl font-semibold (20px)
- Card/Module Titles: text-lg font-medium (18px)
- Body Text: text-base (16px)
- Labels/Secondary: text-sm (14px)
- Captions/Metadata: text-xs (12px)

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, and 8
- Component padding: p-4 to p-6
- Section margins: mb-6 to mb-8
- Card spacing: gap-4 to gap-6
- Form field spacing: space-y-4

**Grid Structure:**
- Main container: max-w-7xl mx-auto px-4
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6
- Data tables: Full-width within container
- Form layouts: max-w-2xl for single-column forms

**Application Shell:**
- Fixed sidebar navigation (w-64) with collapsible mobile drawer
- Top app bar with breadcrumbs, user info, notifications
- Main content area with consistent p-6 to p-8 padding
- Sticky header for tables when scrolling

## Component Library

### Navigation Components
**Sidebar Navigation:**
- Full-height fixed sidebar (desktop)
- Grouped menu items by function (Products, Stock, Consumptions, Reports, Admin)
- Active state indication with subtle background
- Icon + label pattern (using Material Icons CDN)
- Role-based menu item visibility

**Top App Bar:**
- Height: h-16
- Breadcrumb navigation showing current location
- Right-aligned: Search, Export buttons, User menu dropdown
- Elevation shadow for depth separation

### Data Display Components

**Data Tables:**
- Sticky header row with sortable columns
- Alternating row backgrounds for readability (subtle)
- Inline action buttons (edit, delete, view) in last column
- Pagination controls at bottom (items per page selector + page numbers)
- Empty state illustrations with "Add First Item" CTA
- Responsive: Stack to cards on mobile (<md breakpoint)

**Statistics Cards:**
- Compact card design with rounded-lg borders
- Icon in top-left, metric value prominent (text-3xl font-bold)
- Label below value (text-sm)
- Trend indicator if applicable (arrow + percentage)
- Grid layout: 3-4 cards per row on desktop

**Product Cards:**
- Image thumbnail (aspect-square, object-cover)
- Product name (text-lg font-semibold)
- SKU and sector as metadata
- Stock status indicator (badge component)
- Price display (text-xl font-bold)
- Quick action buttons at bottom

### Form Components

**Form Layout:**
- Vertical label-above-input pattern
- Input groups with consistent spacing-y-4
- Field sets with section headers for complex forms
- Required field indicators (asterisk)
- Inline validation messages below inputs

**Input Fields:**
- Height: h-11 for text inputs
- Border: border rounded-md
- Focus states with ring treatment
- Disabled state with reduced opacity
- Helper text below inputs (text-sm)

**Form Actions:**
- Right-aligned button group
- Primary action (solid background)
- Secondary actions (outline style)
- Cancel/back buttons (text style)
- Loading states during submission

### Modal Dialogs
- Max width: max-w-2xl for forms, max-w-4xl for data views
- Overlay with backdrop blur
- Header with title and close button
- Content area with appropriate padding (p-6)
- Footer with action buttons (right-aligned)

### Product Photo Upload
- Large dropzone area with dashed border
- Preview thumbnail after selection
- Remove/replace functionality
- File type and size restrictions displayed
- Drag-and-drop support with visual feedback

## Module-Specific Layouts

### Dashboard (Home)
- Statistics cards grid at top (Total Products, Low Stock Alerts, Monthly Consumptions, Total Value)
- Recent consumption transactions table
- Quick actions section with prominent buttons
- Charts/graphs section (consumption trends if applicable)

### Product Management
- Header with search bar, filter dropdowns (sector), and "Add Product" button
- Product grid or table view toggle
- Bulk actions toolbar when items selected
- Product detail modal with image gallery, full specifications, stock history

### Stock Management
- Real-time stock level indicators
- Transaction history table with filtering (date range, product, reason)
- Stock adjustment form with reason field
- Low stock alerts prominently displayed
- Export to Excel button in header

### Consumption Tracking
- User autocomplete/search for associating consumption
- Product selector with current stock display
- Quantity input with stock validation
- Automatic price calculation display
- Consumption history table with user names, products, dates

### Admin Panel
- Tabbed interface (Users, Sectors, System Settings)
- User management table with role badges
- Add/edit user modal with matricula and full name
- Sector CRUD with simple list interface
- System configuration options

## Icons
**Library:** Material Icons (via CDN)
- Navigation: dashboard, inventory, assessment, people, settings
- Actions: add, edit, delete, download, upload, search
- Status: check_circle, warning, error, info
- Products: category, barcode_scanner, photo_camera

## Responsive Behavior
- **Desktop (lg:):** Full sidebar, multi-column layouts, data-dense tables
- **Tablet (md:):** Collapsible sidebar, 2-column grids, tables remain tabular
- **Mobile (base):** Hidden sidebar with menu button, single-column stacks, tables convert to card format

## Interaction Patterns
- Loading states: Skeleton screens for tables, spinners for actions
- Success notifications: Toast messages (top-right corner)
- Confirmation dialogs: For destructive actions (delete, stock adjustments)
- Keyboard shortcuts: For power users (Ctrl+K for search, Ctrl+N for new item)
- Optimistic updates: Immediate UI feedback, rollback on error

**Professional, functional, and efficient - designed for daily operational use by warehouse staff and administrators.**