## Purpose

Covers the operator-facing flow for recording an order a customer placed off the storefront — over WhatsApp, Messenger, a phone call or in person. Defines how the customer and the lines are identified, how price is shown and negotiated, what the operator can see before committing, and how a refused or repeated save behaves. The pricing, stock and payment rules themselves belong to the server; this capability covers what the operator sees and can do.

## ADDED Requirements

### Requirement: Staff can record an order taken off-site

The panel SHALL offer staff a way to create an order from the orders list, reachable in one action from it. The created order SHALL appear in the orders list and behave identically to a storefront order in every fulfilment surface — status changes, payments, shipments, documents and returns.

Only a role the backend permits to create orders SHALL see the action. The panel's own role check is presentation; the backend re-checks every request.

#### Scenario: Reaching the form

- **WHEN** a permitted user opens the orders list
- **THEN** a create action is offered and leads to the manual order form

#### Scenario: A role without permission

- **WHEN** a user whose role may not create orders opens the orders list
- **THEN** the create action is not shown

#### Scenario: The created order is an ordinary order

- **WHEN** an order is created through the form
- **THEN** it appears in the orders list, opens on the standard order detail page, and offers the same status, payment, shipment and document actions any other order offers

### Requirement: The form identifies the customer by phone number

The form SHALL collect the customer's phone number and name, and SHALL state that the phone number is how the customer is identified — an existing customer with that number is reused rather than duplicated.

A delivery address SHALL be collected for an order being delivered. The phone number SHALL be required; the form SHALL NOT allow submission without one.

#### Scenario: Recording a customer

- **WHEN** the operator enters a phone number, a name and a delivery address
- **THEN** the form accepts them and the created order is placed against the customer holding that number

#### Scenario: Submitting without a phone number

- **WHEN** the operator submits with the phone number empty
- **THEN** the form refuses, names the missing field, and no request is sent

#### Scenario: A phone number the backend rejects

- **WHEN** the backend refuses the submitted phone number as invalid
- **THEN** the reason is shown above the form and every value the operator entered is still there

### Requirement: Lines are chosen from the catalog and priced by the catalog

The form SHALL let the operator add one or more lines, each choosing a product — and, where the product has variants, a variant — by searching the catalog rather than typing an identifier. Each line SHALL take a quantity.

Each line's unit price SHALL be shown, read from the catalog, and SHALL NOT be editable. The operator SHALL be able to see what each line costs and what the lines cost together before committing.

A line SHALL NOT be submittable without a product, and a product with variants SHALL NOT be submittable without a variant chosen.

#### Scenario: Adding a line

- **WHEN** the operator searches for a product and selects it with a quantity
- **THEN** the line shows the catalog unit price and the resulting line total

#### Scenario: A product with variants

- **WHEN** the operator selects a product that has variants
- **THEN** a variant must be chosen before the order can be submitted, and the chosen variant's price is the one shown

#### Scenario: Prices cannot be edited

- **WHEN** the operator views a line
- **THEN** its unit price is displayed as text, with no control offering to change it

#### Scenario: Submitting with no lines

- **WHEN** the operator submits an order with no lines, or with a line naming no product
- **THEN** the form refuses, names what is missing, and no request is sent

### Requirement: A negotiated price is entered once, as a discount with a reason

The form SHALL offer a single order-level discount amount rather than per-line price entry. A discount SHALL require a reason, and the form SHALL NOT allow a discount to be submitted without one.

The discount SHALL NOT exceed the order's subtotal, and the form SHALL say so before the request is sent rather than relying on the backend's refusal.

#### Scenario: Recording a negotiated price

- **WHEN** the operator enters a discount amount and a reason
- **THEN** the running total falls by that amount and both are sent with the order

#### Scenario: A discount without a reason

- **WHEN** the operator enters a discount amount and leaves the reason empty
- **THEN** the form refuses and names the missing reason

#### Scenario: A discount larger than the order

- **WHEN** the operator enters a discount exceeding the subtotal
- **THEN** the form refuses and says so, without sending the request

### Requirement: The operator sees the total before committing

The form SHALL show a running summary — subtotal, discount, delivery charge, tax and total — that updates as lines, the delivery option and the discount change, so the operator can read the final figure back to the customer while still in the conversation.

The delivery charge SHALL come from the store's configured delivery options, chosen by the operator, not typed.

The figure shown SHALL be the figure the order is created with. Where the panel cannot compute a charge itself, it SHALL obtain it from the backend rather than estimating one.

#### Scenario: The total updates as the order is built

- **WHEN** the operator adds a line, changes a quantity, picks a delivery option or enters a discount
- **THEN** the summary updates to reflect it

#### Scenario: The shown total matches the created order

- **WHEN** an order is created from the form
- **THEN** the created order's total is the total the form displayed at submission

#### Scenario: Delivery is chosen, not typed

- **WHEN** the operator sets the delivery charge
- **THEN** they choose from the store's configured delivery options and no free-text charge field is offered

### Requirement: The channel the customer came through is recorded

The form SHALL require the operator to state where the customer reached them — at minimum WhatsApp, Messenger, phone and in person, plus an other. The choice SHALL be sent with the order.

#### Scenario: Recording the channel

- **WHEN** the operator selects WhatsApp and creates the order
- **THEN** the created order records the WhatsApp channel

#### Scenario: Submitting without a channel

- **WHEN** the operator submits without choosing a channel
- **THEN** the form refuses and names the missing field

### Requirement: A refused save loses nothing the operator entered

When the backend refuses a manual order — insufficient stock, an invalid phone number, a discount over the subtotal, a price disagreement, a lost session — the panel SHALL show the backend's own reason above the form and SHALL leave every entered value, including every line, exactly as it was.

An operator who has just taken ten minutes of details from a customer on the phone cannot be made to take them again because one line was out of stock.

#### Scenario: Stock ran out between quoting and saving

- **WHEN** the backend refuses the order because a line exceeds available stock
- **THEN** the reason naming the short line is shown above the form, and every entered value and line is retained

#### Scenario: Any other refusal

- **WHEN** the backend refuses the order for any other reason
- **THEN** its message is shown above the form and nothing the operator entered is cleared

### Requirement: A double submission does not create two orders

The form SHALL send an idempotency key with each submission attempt, and SHALL keep that key across retries of the same order so that a repeated submission returns the order already created rather than creating a second one. The submit control SHALL be disabled while a submission is in flight.

An operator on a slow connection clicking twice must not send the customer two parcels, and unlike a shopper there is nobody at the other end to notice a duplicate confirmation.

#### Scenario: Clicking submit twice

- **WHEN** the operator clicks submit twice before the first request returns
- **THEN** one order is created and the operator is taken to it

#### Scenario: Retrying after a failure

- **WHEN** a submission fails and the operator submits the same order again without changing it
- **THEN** the retry carries the same idempotency key

#### Scenario: A genuinely new order after a success

- **WHEN** the operator creates one order and then starts another
- **THEN** the second order carries a different idempotency key

### Requirement: A created order leads straight to itself

On success the panel SHALL navigate to the created order's detail page and confirm the creation, rather than returning to the list — confirming, printing an invoice or dispatching is nearly always the operator's next action.

#### Scenario: After a successful save

- **WHEN** an order is created
- **THEN** the created order's detail page opens and the creation is confirmed

#### Scenario: The list reflects the new order

- **WHEN** the operator returns to the orders list after creating an order
- **THEN** the new order is present without a manual refresh
