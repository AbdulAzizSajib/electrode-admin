## Purpose

Covers the operator-facing courier workflow in the admin panel — selecting packed orders, previewing which of them the courier will accept, dispatching them in bulk, reading the per-order outcome, and seeing consignment and delivery state on an order. Credentials and the dispatch rules themselves belong to the server; this capability covers what the operator sees and can do.

## ADDED Requirements

### Requirement: Orders can be selected in bulk from the list
The orders list SHALL allow selecting individual rows and selecting every row on the current page, and SHALL show how many orders are currently selected. Selection SHALL be available only on this list; every other list using the shared table SHALL be unaffected.

#### Scenario: Selecting individual orders
- **WHEN** the user checks the boxes on three order rows
- **THEN** the list reports three orders selected and offers the courier dispatch action

#### Scenario: Selecting a whole page
- **WHEN** the user checks the header checkbox
- **THEN** every order on the current page is selected and the count reflects that

#### Scenario: Other lists are unchanged
- **WHEN** the user opens any list other than orders
- **THEN** no checkbox column appears and the list behaves exactly as it did before

#### Scenario: Selection does not survive a page change
- **WHEN** the user selects orders and then moves to another page or changes the filter
- **THEN** the selection is cleared rather than silently retaining rows no longer visible

### Requirement: Row selection does not interfere with opening an order
Clicking a row's checkbox SHALL toggle selection without navigating; clicking elsewhere on the row SHALL continue to open that order.

#### Scenario: Checkbox does not navigate
- **WHEN** the user clicks a row's checkbox
- **THEN** the row's selection toggles and the order detail page does not open

#### Scenario: Row click still opens the order
- **WHEN** the user clicks a row outside its checkbox
- **THEN** the order detail page opens as before

### Requirement: Dispatch is previewed before it is sent
Choosing to dispatch a selection SHALL first present, per order, whether it will be sent and — when it will not — the specific reason. Nothing SHALL be sent to the courier until the user confirms from this preview.

An operator dispatching forty parcels cannot discover an unusable address by watching them fail one at a time.

#### Scenario: Preview lists eligible and ineligible orders separately
- **WHEN** the user dispatches a selection containing both eligible and ineligible orders
- **THEN** the preview shows which orders will be sent and lists each excluded order with its reason

#### Scenario: Confirming sends only the eligible orders
- **WHEN** the user confirms a preview in which some orders were excluded
- **THEN** only the eligible orders are sent and the excluded ones are left untouched

#### Scenario: Nothing eligible
- **WHEN** every order in the selection is ineligible
- **THEN** the preview says so, explains why per order, and offers no confirm action

### Requirement: Every dispatched order's outcome is reported individually
After dispatch the panel SHALL report each order as dispatched, ineligible, failed, or unconfirmed, with a reason for anything that is not dispatched. A partial success SHALL be presented as such, never as a single overall failure.

#### Scenario: Mixed outcome
- **WHEN** a dispatch of twenty orders returns eighteen dispatched and two failed
- **THEN** the result names all twenty with their individual outcomes, and the eighteen show their tracking codes

#### Scenario: Failed orders can be retried
- **WHEN** the result contains orders that definitely failed
- **THEN** the user can retry just those orders without re-selecting them

#### Scenario: Unconfirmed orders are not offered a retry
- **WHEN** the result contains orders whose outcome is unconfirmed
- **THEN** they are shown distinctly from failures, explained as possibly-sent, and no retry action is offered for them

### Requirement: A dispatch in progress cannot be started twice
While a dispatch request is in flight the panel SHALL prevent a second dispatch of the same selection.

#### Scenario: Repeated confirm clicks
- **WHEN** the user clicks confirm on the dispatch preview more than once
- **THEN** only one dispatch request is issued

### Requirement: An order shows its courier state
The order detail page SHALL display an order's consignment id, tracking code, the courier's reported status and when that status was last synced. An order with no consignment SHALL show that it has not been dispatched.

#### Scenario: A dispatched order shows consignment detail
- **WHEN** the user opens an order that has been dispatched
- **THEN** its consignment id, tracking code, courier status and last-synced time are shown

#### Scenario: An undispatched order says so
- **WHEN** the user opens an order with no consignment
- **THEN** the courier section states it has not been dispatched rather than showing empty fields

### Requirement: A single order can be dispatched from its detail page
An order eligible for dispatch SHALL be dispatchable individually from its own page, reporting the same outcomes as a bulk dispatch.

#### Scenario: Dispatching one order
- **WHEN** the user dispatches a single packed order from its detail page
- **THEN** the order is sent, and on success its consignment detail and new status appear without a manual refresh

#### Scenario: An ineligible order offers no dispatch action
- **WHEN** the user opens an order that is not packed, or one already dispatched
- **THEN** no dispatch action is offered and the reason is stated

### Requirement: Courier-owned shipment fields are not presented as editable
When an order's shipment carries a consignment, the manual shipment form SHALL NOT offer its tracking number, carrier, status or timestamps for editing, and SHALL state that the courier is the source of those values. A shipment with no consignment SHALL remain fully editable.

The server refuses these writes. Offering an input the server will reject teaches the operator that saving does not work.

#### Scenario: Courier-owned shipment is read-only
- **WHEN** the user opens the shipment form for an order carrying a consignment
- **THEN** the tracking number, carrier, status and timestamp fields are not editable and the courier is named as their source

#### Scenario: Manual shipment stays editable
- **WHEN** the user opens the shipment form for an order with no consignment
- **THEN** every field remains editable and saving behaves as it does today

### Requirement: The orders list shows courier state at a glance
The orders list SHALL show, per row, whether the order has been dispatched and what the courier's current status is.

#### Scenario: Courier state is visible without opening an order
- **WHEN** the user views the orders list
- **THEN** each row indicates whether it has been dispatched and, if so, the courier's reported status

### Requirement: A courier cancellation is surfaced for the operator to resolve
An order whose consignment the courier has cancelled or returned SHALL be visibly flagged as needing attention. The panel SHALL NOT cancel the order, return stock, or issue a refund automatically; it SHALL direct the operator to the existing cancellation and return flows.

#### Scenario: A cancelled consignment is flagged
- **WHEN** the courier reports an order's consignment as cancelled
- **THEN** the order is marked as needing attention in the list and on its detail page, with its order status unchanged

#### Scenario: Resolving uses the existing flows
- **WHEN** the user acts on an order flagged for a courier cancellation
- **THEN** they are directed to the existing order-cancellation and return handling, which behave unchanged

### Requirement: A courier return can be raised from an order
A dispatched order SHALL allow raising a courier return request with an optional reason, and SHALL show the result.

#### Scenario: Raising a return
- **WHEN** the user raises a courier return for a dispatched order with a reason
- **THEN** the request is sent and its outcome is reported

#### Scenario: Return unavailable without a consignment
- **WHEN** the user opens an order with no consignment
- **THEN** no courier return action is offered

### Requirement: The courier account balance is visible
The panel SHALL display the current Steadfast balance on demand, and SHALL report a failure to read it as such rather than showing zero.

#### Scenario: Balance is shown
- **WHEN** the user views the courier balance
- **THEN** the current balance reported by the courier is displayed

#### Scenario: Balance unavailable
- **WHEN** the balance cannot be retrieved
- **THEN** the panel says it is unavailable and does not display a figure

### Requirement: Courier misconfiguration is reported plainly
When the server reports the courier as unconfigured, the panel SHALL say so and SHALL NOT present dispatch as available.

#### Scenario: Courier not configured
- **WHEN** the server reports missing courier credentials
- **THEN** the panel states the courier is not configured and offers no dispatch action

### Requirement: Courier actions respect role
Courier actions SHALL be offered only to roles the backend permits, and a refused request SHALL surface the backend's own message.

#### Scenario: A refused dispatch shows the reason
- **WHEN** a courier request is refused by the backend
- **THEN** the backend's message is shown rather than a generic failure
