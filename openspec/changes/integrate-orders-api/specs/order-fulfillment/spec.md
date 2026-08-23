## Purpose

Covers how the admin panel views and manages customer orders — status, payments, and shipment tracking — against the real backend, replacing the earlier mock in-memory data. Order creation is explicitly out of scope: the real backend only creates orders through customer checkout, which this admin panel does not perform.

## ADDED Requirements

### Requirement: Order List and Filtering
The system SHALL fetch orders from the backend, passing page, page size, order-number search, and status filter as query parameters, and SHALL render each row's customer and status without a separate per-order lookup.

#### Scenario: Filter by status
- **WHEN** the user filters the order list to a specific status
- **THEN** the system re-requests the order list with that status filter and displays only matching orders

#### Scenario: Search by order number
- **WHEN** the user searches for an order number
- **THEN** the system re-requests the order list with that search term and displays only matching orders

### Requirement: Order Status Management
The system SHALL allow an admin to set an order to any of the backend's order statuses, with an optional note, and SHALL NOT restrict the choice to a fixed forward sequence, since the backend itself does not enforce one.

#### Scenario: Change an order's status
- **WHEN** the user selects a new status for an order and confirms
- **THEN** the system sends the status change to the backend, and the order detail reflects the new status and an appended status-history entry on success

#### Scenario: Cancel an order
- **WHEN** the user sets an order's status to Cancelled
- **THEN** the system sends that status change through the same status-update mechanism as any other status change — not a separate customer-only cancel action

### Requirement: Payment Recording
The system SHALL record a payment against an order by sending an amount, method, and status to the backend, and SHALL display the order's recorded payments and computed balance due.

#### Scenario: Record a payment
- **WHEN** the user records a payment for an order with an amount and method
- **THEN** the system sends the payment to the backend, and on success the payment appears in the order's payment list and the balance due updates accordingly

### Requirement: Shipment Tracking
The system SHALL create a shipment for an order that doesn't have one, and update the existing shipment for an order that does — never attempting to create a second shipment for the same order.

#### Scenario: Create a shipment for an order with none
- **WHEN** the user submits carrier and tracking details for an order that has no shipment yet
- **THEN** the system creates a new shipment via the backend, and it appears on the order detail on success

#### Scenario: Update an existing shipment
- **WHEN** the user submits updated carrier or tracking details for an order that already has a shipment
- **THEN** the system updates that existing shipment via the backend rather than attempting to create another one

### Requirement: Shipping Method Management
The system SHALL create, list, update, and delete shipping methods against the backend, including their price and optional estimated delivery days.

#### Scenario: Create a shipping method
- **WHEN** the user submits the new-shipping-method form with a name and price
- **THEN** the system sends the fields to the backend, and on success the new shipping method appears in the list
