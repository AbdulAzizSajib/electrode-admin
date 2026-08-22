## Purpose

Gives store operators a single landing page summarizing store health — sales, orders, and inventory signals — using mock aggregate data.

## ADDED Requirements

### Requirement: KPI Summary Cards
The system SHALL display KPI summary cards on the Dashboard for total revenue, total orders, total customers, and low-stock item count, each showing the current mock value and a period-over-period trend indicator.

#### Scenario: Trend indicator direction
- **WHEN** a KPI's mock trend value is positive
- **THEN** the card shows an upward trend indicator; a negative value shows a downward indicator, using color (not gradient) to distinguish direction

### Requirement: Sales and Orders Charts
The system SHALL render a revenue-over-time chart and an orders-over-time chart on the Dashboard, driven by mock time-series data, with a selectable time range (e.g. 7 days / 30 days / 90 days).

#### Scenario: Change time range
- **WHEN** the user selects a different time range control
- **THEN** both charts re-render using the mock dataset filtered/aggregated to that range

### Requirement: Recent Orders and Low Stock Widgets
The system SHALL show a "Recent Orders" widget listing the most recent mock orders with status badges, and a "Low Stock" widget listing mock products/stock records at or below their reorder threshold, each linking to the corresponding resource's detail page.

#### Scenario: Navigate from widget
- **WHEN** the user clicks a row in the Recent Orders or Low Stock widget
- **THEN** the system navigates to that order's or product's detail page

#### Scenario: Empty widget state
- **WHEN** the mock dataset backing a widget has no qualifying records
- **THEN** the widget shows an empty state instead of an empty list
