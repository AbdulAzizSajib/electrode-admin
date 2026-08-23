## Purpose

Covers how the admin panel manages warehouses, suppliers, stock levels, and the purchase-order procurement cycle against the real backend inventory API, replacing the earlier mock in-memory data.

## ADDED Requirements

### Requirement: Warehouse Management
The system SHALL create, list, update, and delete warehouses against the backend, and SHALL surface the backend's rejection reason (for example, a warehouse that still has stock or stock-movement records) instead of a generic failure message when a delete request fails.

#### Scenario: Create a warehouse
- **WHEN** the user submits the new-warehouse form with a name and code
- **THEN** the system sends the warehouse fields to the backend, and on success the new warehouse appears in the warehouse list

#### Scenario: Delete a warehouse that still has stock
- **WHEN** the user confirms deleting a warehouse that still has stock records and the backend rejects the request
- **THEN** the system shows the backend's error message and the warehouse remains in the list

### Requirement: Supplier Management
The system SHALL create, list, update, and delete suppliers against the backend, including the supplier's active/inactive status, and SHALL surface the backend's rejection reason instead of a generic failure message when a delete request fails.

#### Scenario: Deactivate a supplier
- **WHEN** the user turns a supplier's active toggle off and saves
- **THEN** the system sends the updated status to the backend, and the supplier list reflects the change on success

### Requirement: Stock Visibility and Manual Adjustment
The system SHALL display stock quantity per product/variant per warehouse, and SHALL adjust a stock record only by sending a signed quantity delta and a reason to the backend — never by computing or sending an absolute new quantity — so the backend can pair every change with its own audit-trail entry.

#### Scenario: Filter stock by warehouse
- **WHEN** the user filters the stock list to one warehouse
- **THEN** the system re-requests stock with that warehouse filter and displays only matching records

#### Scenario: Adjust stock downward past zero
- **WHEN** the user submits a negative adjustment larger than the current quantity
- **THEN** the system shows the backend's rejection message and the stock quantity is unchanged

### Requirement: Stock Movement History
The system SHALL display the stock movement audit trail (product, warehouse, movement type, quantity change, note, date) fetched from the backend, filterable by product, warehouse, and movement type.

#### Scenario: Filter movements by type
- **WHEN** the user filters stock movements to a specific type (for example, Adjustment)
- **THEN** the system re-requests the movement list with that type filter and displays only matching entries

### Requirement: Purchase Order Creation
The system SHALL create a purchase order by sending a supplier, one or more line items (product, quantity, unit cost), and optional shipping cost, tax amount, and notes to the backend — without a warehouse, since the real backend only asks for a warehouse when a receipt is recorded, not at creation.

#### Scenario: Create a purchase order with two line items
- **WHEN** the user submits the new-purchase-order form with a supplier and two line items
- **THEN** the system sends the supplier and items to the backend, and on success the new purchase order (with its server-computed subtotal and total) appears in the purchase order list with status Draft

### Requirement: Purchase Order Editing and Status Transitions
The system SHALL allow editing a purchase order's shipping cost, tax amount, notes, ordered-at date, and status (Draft, Ordered, or Cancelled) only while it has not yet received any stock, and SHALL block editing — showing the backend's rejection reason — once it has (Partially Received or Received).

#### Scenario: Attempt to edit a partially received purchase order
- **WHEN** the user attempts to edit a purchase order that already has a partial receipt
- **THEN** the system shows the backend's rejection message and does not apply the edit

#### Scenario: Mark a draft purchase order as ordered
- **WHEN** the user changes a Draft purchase order's status to Ordered and saves
- **THEN** the system sends the status change to the backend, and the purchase order list/detail reflect the new status on success

### Requirement: Purchase Order Receiving
The system SHALL record a receipt against one or more of a purchase order's line items by sending the destination warehouse and, for each line item being received, that line item's own identifier and the quantity received — supporting partial receipt of any line item — and SHALL refresh the purchase order, its stock, and the stock movement list after a successful receipt.

#### Scenario: Fully receive a purchase order
- **WHEN** the user receives the full remaining quantity of every line item on an Ordered purchase order
- **THEN** the system sends the receipt to the backend, and on success the purchase order's status becomes Received and the received quantities are reflected in stock

#### Scenario: Partially receive a purchase order
- **WHEN** the user receives less than the full remaining quantity of at least one line item
- **THEN** the system sends the partial receipt to the backend, and on success the purchase order's status becomes Partially Received, with each item's remaining-to-receive quantity reduced accordingly

#### Scenario: Attempt to receive more than remains on a line item
- **WHEN** the user submits a receive quantity greater than what remains unreceived for a line item
- **THEN** the system shows the backend's rejection message and does not record the receipt

### Requirement: Purchase Order Deletion
The system SHALL request deletion of a purchase order from the backend only while it has not received any stock, and SHALL surface the backend's rejection reason when a delete request fails.

#### Scenario: Attempt to delete a purchase order with received stock
- **WHEN** the user confirms deleting a purchase order that has already received stock and the backend rejects the request
- **THEN** the system shows the backend's error message and the purchase order remains in the list
