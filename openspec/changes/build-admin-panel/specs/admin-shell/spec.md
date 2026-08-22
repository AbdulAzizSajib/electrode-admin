## Purpose

Provides the application shell every other capability renders inside: routing, the authenticated layout (sidebar + topbar), the auth layout, the global navigation menu, the shared design system, and the mock session/auth guard.

## ADDED Requirements

### Requirement: Authenticated Layout Shell
The system SHALL render an authenticated layout consisting of a collapsible left sidebar, a topbar (search, notifications entry point, account menu), a breadcrumb trail, and a main content area, for every route under the admin area.

#### Scenario: Sidebar collapse
- **WHEN** the user toggles the sidebar collapse control
- **THEN** the sidebar switches between expanded (labeled items) and collapsed (icon-only) states and the choice persists across navigation within the session

#### Scenario: Breadcrumb reflects location
- **WHEN** the user navigates to a nested page (e.g. a product's edit view)
- **THEN** the breadcrumb trail shows each ancestor segment (e.g. Catalog / Products / Edit Product) with links to the parent list pages

### Requirement: Global Navigation Menu
The system SHALL provide a sidebar navigation menu grouped into sections — Dashboard, Catalog, Inventory, Sales, Marketing, Customers, Support, Notifications, and Settings — each expandable to its child items, with the active item highlighted based on the current route.

#### Scenario: Active item highlight
- **WHEN** the current route is a child of a navigation section (e.g. Sales / Orders)
- **THEN** the parent section is expanded and the matching child item is visually marked as active

#### Scenario: Role-aware visibility
- **WHEN** the current mock session's role does not include access to a section (e.g. a STAFF role without Settings access)
- **THEN** that section is hidden from the navigation menu and its routes are not reachable via direct navigation

### Requirement: Auth Layout and Mock Session Guard
The system SHALL provide a standalone auth layout (no sidebar/topbar) for the login and forgot-password pages, and SHALL guard every authenticated route behind a mock session check.

#### Scenario: Unauthenticated access redirected
- **WHEN** a visitor without an active mock session requests any authenticated route
- **THEN** the system redirects to the login page

#### Scenario: Login establishes mock session
- **WHEN** the user submits the login form with any well-formed credentials
- **THEN** the system establishes a mock session (with a role: OWNER, ADMIN, or STAFF) and redirects to the Dashboard

#### Scenario: Logout clears session
- **WHEN** the user selects Logout from the account menu
- **THEN** the mock session is cleared and the user is redirected to the login page

### Requirement: Design System Primitives
The system SHALL provide a shared set of UI primitives (button, input, select, table, dialog, drawer, dropdown menu, badge, tabs, toast, card, pagination, form field) used consistently across every capability, styled with compact spacing (reduced padding/margin relative to each primitive's un-customized default) and without gradient fills on any surface, border, or text.

#### Scenario: Consistent primitive reuse
- **WHEN** any capability renders a list, form, or dialog
- **THEN** it composes the shared primitives rather than introducing one-off styled elements for the same purpose

#### Scenario: No gradients anywhere
- **WHEN** any surface, button, badge, chart, or background in the admin panel is inspected
- **THEN** it uses solid colors only — no linear/radial gradient fills are present

### Requirement: Data Table Pattern
The system SHALL provide a reusable data table pattern supporting column sorting, per-column or global search/filtering, server-shaped pagination (page/limit), row selection, and empty/loading/error states, used by every resource list page.

#### Scenario: Empty state
- **WHEN** a list page's filtered result set has zero rows
- **THEN** the table shows an empty state message instead of an empty grid

#### Scenario: Pagination controls
- **WHEN** a resource has more rows than the current page size
- **THEN** the table shows pagination controls (page number, page size, total count) and changing page or page size updates the visible rows accordingly

### Requirement: Responsive Layout
The system SHALL remain usable on viewport widths from 1280px down to common tablet widths (~768px), collapsing the sidebar to an overlay/off-canvas pattern below a defined breakpoint.

#### Scenario: Narrow viewport collapses sidebar
- **WHEN** the viewport width is below the responsive breakpoint
- **THEN** the sidebar is hidden by default and can be opened as an overlay via a menu toggle in the topbar
