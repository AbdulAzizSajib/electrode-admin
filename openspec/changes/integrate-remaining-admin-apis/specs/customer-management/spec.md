## Purpose

Covers how the admin panel lists customers and displays a single customer's profile, addresses, and purchase history, backed by new admin-only customer endpoints that did not previously exist.

## ADDED Requirements

### Requirement: Admin Customer Listing
The system SHALL provide an admin-only customer list backed by the backend, with server-side pagination and search across name, email, and phone, and filterable by customer status. The list SHALL show each customer's name, email, phone, status, and join date.

#### Scenario: Search for a customer by email
- **WHEN** the user types an email fragment into the customer list search
- **THEN** the system re-requests the list with that search term and displays only matching customers, paginated by the backend

#### Scenario: Search for a customer by phone
- **WHEN** the user searches by a phone number fragment
- **THEN** the system displays only customers whose phone matches

#### Scenario: Filter customers by status
- **WHEN** the user filters the customer list to blocked customers
- **THEN** the system re-requests the list with that status filter and displays only matching customers

#### Scenario: Customer with no email or phone
- **WHEN** the customer list contains a customer who has neither an email nor a phone recorded
- **THEN** the system renders the row with explicit empty indicators rather than failing

#### Scenario: Non-admin attempts to reach the customer list
- **WHEN** a signed-in user whose role may not view customers attempts to load the customer list and the backend rejects the request
- **THEN** the system shows the backend's rejection message rather than an empty list

### Requirement: Customer Detail
The system SHALL display a single customer's profile — name, email, phone, status, and join date — fetched from the backend.

#### Scenario: Open a customer
- **WHEN** the user opens a customer from the list
- **THEN** the system requests that customer and displays their profile

#### Scenario: Customer not found
- **WHEN** the user opens a customer identifier the backend does not recognize
- **THEN** the system shows a not-found state rather than a blank page

### Requirement: Customer Addresses
The system SHALL display a customer's saved addresses as returned with the customer detail, indicating which address is the default.

#### Scenario: View a customer's addresses
- **WHEN** the user opens a customer who has saved addresses
- **THEN** the system displays each address and marks the default one

#### Scenario: Customer with no addresses
- **WHEN** the user opens a customer who has no saved addresses
- **THEN** the system shows an empty address state rather than an error

### Requirement: Customer Purchase Summary
The system SHALL display a customer's order count and total amount spent as reported by the backend, rather than computing those figures in the admin panel from a partial order list.

#### Scenario: View a customer's purchase totals
- **WHEN** the user opens a customer who has placed orders
- **THEN** the system displays the backend-reported order count and total spent

#### Scenario: Customer who has never ordered
- **WHEN** the user opens a customer with no orders
- **THEN** the system displays a zero order count and zero total spent
