## Purpose

Lets store staff manage the order lifecycle — orders, payments, shipments, returns, refunds, and the shipping methods offered at checkout.

## ADDED Requirements

### Requirement: Order List and Filtering
The system SHALL display a paginated, searchable, filterable (by status, date range, and customer) list of orders showing order number, customer, item count, total, payment status, fulfillment status, and placed date.

#### Scenario: Filter by status
- **WHEN** the user selects an order status filter (e.g. pending, processing, shipped, delivered, cancelled)
- **THEN** the list shows only mock orders in that status

### Requirement: Order Detail View
The system SHALL show an order detail page with line items, pricing breakdown (subtotal, discount, shipping, tax, total), customer and shipping address, payment records, shipment record, and a status history timeline.

#### Scenario: View linked payments and shipment
- **WHEN** the user opens an order that has mock payment and shipment records
- **THEN** the detail page shows those records inline (payment method/amount/status; shipment carrier/tracking/status)

### Requirement: Order Status Update and Cancellation
The system SHALL allow updating an order's fulfillment status through a defined sequence and allow cancelling an order that has not yet shipped, each requiring confirmation.

#### Scenario: Valid status transition
- **WHEN** the user advances an order from one valid status to the next (e.g. processing → shipped)
- **THEN** the mock order record updates and the change appears in the status history timeline

#### Scenario: Cancel blocked after shipment
- **WHEN** the user attempts to cancel an order already marked shipped or delivered
- **THEN** the system disables the cancel action and explains why

### Requirement: Payments View
The system SHALL show, per order, the list of mock payment records (method, amount, status, transaction reference, timestamp) and allow recording a new manual payment against the order.

#### Scenario: Record manual payment
- **WHEN** the user records a payment amount and method for an order with an outstanding balance
- **THEN** a new mock payment record is added and the order's payment status recalculates (e.g. unpaid → partially paid → paid)

### Requirement: Shipments View
The system SHALL show, per order, the shipment record (carrier, tracking number, status) and allow creating or updating it.

#### Scenario: Create shipment
- **WHEN** the user creates a shipment for an order with carrier and tracking number
- **THEN** the mock shipment record is created, linked to the order, and the order's fulfillment status advances to "shipped"

### Requirement: Returns and Refunds
The system SHALL provide a list and detail view for return requests (linked order, items, reason, status) with an admin action to update return status, and a list and detail view for refunds (linked order, amount, method, status). Completing a return SHALL restock the returned items.

#### Scenario: Complete a return restocks inventory
- **WHEN** the user marks a return as "completed" and selects a warehouse
- **THEN** the returned items' quantities are added back to that warehouse's mock stock, a stock movement is recorded, and the return status updates

#### Scenario: Issue a refund
- **WHEN** the user creates a refund for an order with an amount and method
- **THEN** a new mock refund record is created and linked to the order

### Requirement: Shipping Methods Management
The system SHALL provide list, create, edit, and delete UI for shipping methods, covering name, description, price, and active status.

#### Scenario: Deactivate instead of delete when in use
- **WHEN** the user attempts to delete a shipping method referenced by an existing mock order
- **THEN** the system blocks the deletion and suggests deactivating it instead
