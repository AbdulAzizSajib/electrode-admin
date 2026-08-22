## Purpose

Lets store staff track and manage warehouses, stock levels, stock movement history, suppliers, and purchase orders used to replenish inventory.

## ADDED Requirements

### Requirement: Warehouse Management
The system SHALL provide list, create, edit, and delete UI for warehouses, covering name, code, address, and active status.

#### Scenario: Deactivate instead of delete when referenced
- **WHEN** the user attempts to delete a warehouse that has associated mock stock records
- **THEN** the system blocks deletion and suggests deactivating the warehouse instead

### Requirement: Stock List and Adjustment
The system SHALL display a paginated, filterable (by warehouse and product) stock list showing product, warehouse, quantity on hand, reserved quantity, and available quantity, and SHALL allow adjusting a stock record's quantity with a required reason.

#### Scenario: Filter stock by warehouse
- **WHEN** the user selects a warehouse filter on the Stock list
- **THEN** only mock stock records for that warehouse are shown

#### Scenario: Adjust stock quantity
- **WHEN** the user submits a stock adjustment with a delta quantity and reason
- **THEN** the mock stock record's quantity updates and a corresponding entry is added to Stock Movements

### Requirement: Stock Movements History
The system SHALL display a read-only, paginated, filterable (by product, warehouse, and movement type) audit list of stock movements, showing type (e.g. purchase receipt, adjustment, return restock, sale), quantity delta, resulting balance, and timestamp.

#### Scenario: Movement created by adjustment
- **WHEN** a stock adjustment or purchase-order receipt occurs elsewhere in the app
- **THEN** a new stock movement row reflecting that change appears in this list

### Requirement: Supplier Management
The system SHALL provide list, create, edit, and delete UI for suppliers, covering name, contact email, phone, and address.

#### Scenario: Supplier referenced by purchase order cannot be deleted
- **WHEN** the user attempts to delete a supplier referenced by an existing mock purchase order
- **THEN** the system blocks the deletion with an explanatory message

### Requirement: Purchase Order Lifecycle
The system SHALL provide list, create, edit, and detail UI for purchase orders (supplier, warehouse, line items with product/quantity/unit cost, status), and SHALL support a "Receive" action that records received quantities against a purchase order.

#### Scenario: Create purchase order with line items
- **WHEN** the user creates a purchase order and adds one or more product line items with quantity and unit cost
- **THEN** the system saves the purchase order with a computed total and an initial "pending" status

#### Scenario: Receive updates stock and status
- **WHEN** the user records a full or partial receipt against a purchase order
- **THEN** the received line items' quantities increase the corresponding mock stock records, a stock movement is recorded, and the purchase order status updates to "partially received" or "received" accordingly

#### Scenario: Delete only allowed before receipt
- **WHEN** the user attempts to delete a purchase order that has any received quantity
- **THEN** the system blocks the deletion
