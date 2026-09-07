## Purpose

Keeps the admin panel's dashboard figures, pending-order badge, and notification count current while a staff member has the panel open, without anyone pressing refresh. Defines what data stays live, how often it updates, and how the panel behaves when the tab is hidden, the network fails, or the session ends.

## ADDED Requirements

### Requirement: Dashboard data refreshes without manual reload

While a staff member has the admin panel open and visible, the panel SHALL refresh its live figures on a recurring interval without any user action. A newly placed order MUST become visible in the panel within one interval of being placed.

The live figures covered by this requirement are: the most recent order, the total order count, the count of orders awaiting action, the unread notification count, and the count of stock items below their low-stock threshold.

#### Scenario: An order is placed while the dashboard is open

- **WHEN** a customer places an order while a staff member is viewing the dashboard
- **THEN** the panel reflects the new order within one refresh interval
- **AND** the staff member does not have to reload the page to see it

#### Scenario: Figures change while the panel sits idle

- **WHEN** order counts or stock levels change and nobody interacts with the panel
- **THEN** the displayed figures update on their own
- **AND** the update does not disturb what the user is reading or interacting with

#### Scenario: Nothing has changed since the last refresh

- **WHEN** a refresh finds no change since the previous one
- **THEN** the panel leaves its displayed data as it is
- **AND** the heavier dashboard reports are not re-fetched

### Requirement: Refreshing costs one request per interval

However many parts of the panel display live figures, the panel MUST issue at most one refresh request per interval. Individual components MUST NOT poll independently.

#### Scenario: Several live elements are on screen at once

- **WHEN** the dashboard, the pending-order badge, and the notification count are all displayed together
- **THEN** a single refresh request serves all of them
- **AND** adding another live element to the screen does not add another request

### Requirement: Refreshing pauses while the tab is hidden

The panel SHALL stop refreshing while its browser tab is hidden, and resume when the tab becomes visible again. On resuming it MUST refresh immediately rather than waiting out the remainder of an interval.

#### Scenario: Staff member switches to another tab

- **WHEN** the admin panel's tab is hidden
- **THEN** no further refresh requests are issued until it is visible again

#### Scenario: Staff member returns to the panel

- **WHEN** a hidden tab becomes visible again
- **THEN** the panel refreshes immediately
- **AND** any change that occurred while the tab was hidden is reflected without a manual reload

### Requirement: Detected changes refresh the dashboard reports

The dashboard's heavier reports — revenue and order totals, order-status and payment breakdowns, top products, sales by category, and returns and refunds — SHALL be re-fetched when a refresh detects that underlying data has changed, and SHALL NOT be placed on their own recurring timers.

#### Scenario: New order changes the underlying figures

- **WHEN** a refresh detects a newly placed order
- **THEN** the dashboard's reports are re-fetched
- **AND** the revenue and order-count figures reflect the new order

#### Scenario: Reports are viewed for a specific date range

- **WHEN** the reports are being viewed for a selected date range and a change is detected
- **THEN** the re-fetched reports keep the selected range

### Requirement: Refresh failures are non-disruptive

A failed refresh MUST NOT clear displayed data, interrupt the user, or stop the refresh cycle. The panel SHALL retain the last successfully retrieved figures and continue refreshing on schedule.

#### Scenario: A refresh request fails

- **WHEN** a refresh fails because of a network or server error
- **THEN** the last known figures remain on screen
- **AND** no error is shown to the user for that failure alone

#### Scenario: Connectivity returns after repeated failures

- **WHEN** refreshes succeed again after a period of failure
- **THEN** the panel updates to current figures
- **AND** normal refreshing continues without a reload

### Requirement: Refreshing is confined to authenticated staff

Refreshing SHALL take place only where a staff member is signed in and viewing the authenticated panel. It MUST NOT run on sign-in or other unauthenticated screens, and MUST stop when the session ends.

#### Scenario: Signed-out user is on the sign-in screen

- **WHEN** nobody is signed in
- **THEN** no refresh requests are issued

#### Scenario: Session ends while the panel is open

- **WHEN** the staff member signs out, or the session expires and the panel returns to the sign-in screen
- **THEN** refreshing stops
- **AND** no repeated failing requests are issued afterwards

### Requirement: Live figures are restricted to permitted staff

The live figures MUST be served only to signed-in users holding a role permitted to view admin analytics. A request from an unauthenticated or unauthorised caller SHALL be rejected and MUST NOT disclose any figures.

#### Scenario: Unauthenticated caller requests live figures

- **WHEN** a caller with no valid session requests the live figures
- **THEN** the request is rejected
- **AND** no order, stock, or notification data is returned

#### Scenario: Signed-in user lacking analytics permission

- **WHEN** a signed-in user whose role may not view admin analytics requests the live figures
- **THEN** the request is rejected

### Requirement: Refresh interval is adjustable in one place

The refresh interval SHALL be defined as a single configurable value covering every live element. Changing it MUST change the cadence throughout the panel with no other edit. The interval ships at 10 seconds.

#### Scenario: Interval is changed

- **WHEN** the configured interval is changed to a different duration
- **THEN** every live element refreshes at the new cadence
- **AND** no other behavior described in this capability changes
