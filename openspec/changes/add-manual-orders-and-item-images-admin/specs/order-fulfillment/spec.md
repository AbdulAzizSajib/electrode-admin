## Purpose

Covers how the admin panel views and manages customer orders against the real backend, and specifically what an order's lines and provenance look like on the list and detail surfaces — the product image beside each line, the channel the order came through, and who created it.

## ADDED Requirements

### Requirement: Order lines show the product's image

Wherever the panel names what an order bought — the orders list and the order detail page — each line SHALL show the product's image beside its name. A line naming a variant SHALL show that variant's image where it has one.

An operator packing a parcel or answering a call about an order is matching a picture against a shelf. Every other catalog surface in the panel shows a thumbnail; these are the two where it matters most.

The image SHALL be obtained from the order read the surface already performs. Neither surface SHALL make a request per row or per line to fetch it.

#### Scenario: Images on the orders list

- **WHEN** the user views the orders list
- **THEN** each line in an order's Items column shows the product's image beside the quantity and name

#### Scenario: Images on order detail

- **WHEN** the user opens an order
- **THEN** each row of its items table shows the product's image beside the product name and SKU

#### Scenario: A variant line

- **WHEN** an order line names a variant that has its own image
- **THEN** that variant's image is shown rather than the product's

### Requirement: A line with no usable image degrades to a placeholder

A line whose product has no image, or whose image fails to load, SHALL show a neutral placeholder of the same size and shape as a loaded image. It SHALL NOT show a browser broken-image icon, an empty gap, or a row whose height differs from its neighbours.

Order lines fall back to a placeholder image on the storefront today, so a missing picture is a normal state rather than an error, and a table that reflows when one line lacks one is harder to read than one that does not.

#### Scenario: A product with no images

- **WHEN** an order line's product has no image
- **THEN** a placeholder occupies the image position and the row's height matches every other row

#### Scenario: An image that fails to load

- **WHEN** a line's image URL cannot be loaded
- **THEN** the same placeholder is shown rather than a broken image

#### Scenario: Images do not push the text out

- **WHEN** an order has several lines with long product names
- **THEN** adding images does not cause the list's columns to overflow horizontally or truncate the name beyond what it already truncated

### Requirement: The orders list shows and filters by the channel an order came through

The orders list SHALL show, per order, the channel the customer reached the shop through, distinguishing a storefront order from one taken over WhatsApp, Messenger, a phone call or in person. The list SHALL be filterable by channel, and that filtering SHALL be performed by the backend rather than over the current page.

A storefront order SHALL be presented as such without implying a person took it.

#### Scenario: Filtering by channel

- **WHEN** the user filters the orders list to WhatsApp
- **THEN** the list re-requests orders with that channel filter and shows only orders recorded against it

#### Scenario: A storefront order

- **WHEN** the list shows an order placed by a customer on the storefront
- **THEN** it is presented as a storefront order and names no staff member

#### Scenario: Channel and status filters combine

- **WHEN** the user filters by both a status and a channel
- **THEN** both are sent to the backend and only orders matching both are shown

### Requirement: Order detail names who created a manual order and why a discount was given

An order's detail page SHALL name the staff member who created it, when one did, and SHALL show the reason recorded for a discount, when one was given.

A discount with no stated reason is an unexplained hole in the day's takings; the reason is the only thing that makes it auditable after the conversation that produced it is gone.

#### Scenario: A manually created order

- **WHEN** the user opens an order created by staff
- **THEN** the page names the staff member who created it and the channel it came through

#### Scenario: A storefront order

- **WHEN** the user opens an order placed by a customer themselves
- **THEN** no creator is named, rather than an empty or placeholder value

#### Scenario: A discounted order

- **WHEN** the user opens an order carrying a discount with a recorded reason
- **THEN** the reason is shown beside the discount in the order's money summary
