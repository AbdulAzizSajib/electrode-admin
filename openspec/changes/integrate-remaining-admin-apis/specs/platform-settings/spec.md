## Purpose

Covers how the admin panel reads and edits store-wide settings, reviews the read-only audit trail, and surfaces per-user notifications against the real backend, replacing the earlier mock in-memory data.

## ADDED Requirements

### Requirement: Store Settings Retrieval and Update
The system SHALL fetch the store settings from the backend and SHALL save edits back to it, covering the store name, currency and its symbol, default tax rate, free-shipping threshold, contact email, contact phone, address, logo, and the guest and cash-on-delivery order limits.

#### Scenario: Edit the store's tax rate
- **WHEN** the user changes the default tax rate and saves
- **THEN** the system sends the updated settings to the backend, and the form reflects the saved values on success

#### Scenario: Clear the free-shipping threshold
- **WHEN** the user clears the free-shipping threshold and saves
- **THEN** the system sends the setting as unset and free shipping by order value no longer applies

#### Scenario: Rejected settings update
- **WHEN** the user saves settings the backend rejects as invalid
- **THEN** the system shows the backend's validation message and the stored settings are unchanged

### Requirement: Preservation of Unedited Settings
The system SHALL preserve the store settings it does not present for editing — including the navigation, footer, social link, announcement bar, and newsletter configuration blocks — so that saving from the settings page never erases configuration the page does not expose.

#### Scenario: Save settings while unexposed configuration exists
- **WHEN** the user saves the settings form on a store whose navigation and footer configuration is populated
- **THEN** that configuration remains intact after the save

### Requirement: Audit Log Review
The system SHALL display the audit trail fetched from the backend, showing each entry's acting user, action, affected entity and entity identifier, and timestamp, and SHALL allow filtering by action, by entity, and by date range. The audit log SHALL be read-only: the system SHALL provide no way to create, edit, or delete an entry.

A date range SHALL be applied by the backend rather than narrowed after the fact in the admin panel, and a range whose start and end fall on the same day SHALL include that whole day.

#### Scenario: Filter the audit log by action
- **WHEN** the user filters the audit log to a single action
- **THEN** the system re-requests the log with that action filter and displays only matching entries

#### Scenario: Filter the audit log by entity
- **WHEN** the user filters the audit log to a single entity type
- **THEN** the system re-requests the log with that entity filter and displays only matching entries

#### Scenario: Filter the audit log by date range
- **WHEN** the user selects a start and end date
- **THEN** the system re-requests the log bounded to that range and displays only entries within it, including entries recorded at any time on the end date

#### Scenario: Entry whose acting user was removed
- **WHEN** the audit log contains an entry whose acting user no longer exists
- **THEN** the system displays the entry with an unknown-user label rather than omitting it or failing to render

### Requirement: Audit Entry Change Detail
The system SHALL let the user inspect the recorded before and after state of an audit entry when the backend provides them.

#### Scenario: Inspect what an update changed
- **WHEN** the user expands an audit entry recorded for an update
- **THEN** the system displays the entry's recorded previous and new state

#### Scenario: Entry with no recorded state
- **WHEN** the user expands an audit entry that has no recorded before or after state
- **THEN** the system indicates that no change detail was recorded rather than showing an empty panel or an error

### Requirement: Audit Entries Are Recorded Server-Side
The admin panel SHALL NOT write audit entries. Every audit entry displayed SHALL originate from the backend's own record of the action.

#### Scenario: Perform an audited action
- **WHEN** the user performs an action the backend audits, such as updating a coupon
- **THEN** the admin panel issues only the action's own request, and the resulting audit entry comes from the backend when the log is next fetched

### Requirement: Notification Listing
The system SHALL list the signed-in user's own notifications from the backend, showing each notification's title, message, type, priority, read state, and time, and SHALL allow filtering by read state.

#### Scenario: View notifications
- **WHEN** the user opens the notifications page
- **THEN** the system requests the signed-in user's notifications and displays them newest first

#### Scenario: Filter to unread notifications
- **WHEN** the user filters to unread notifications
- **THEN** the system displays only notifications that have not been read

### Requirement: Notification Read State
The system SHALL mark a single notification as read and SHALL mark all of the signed-in user's notifications as read, through the backend, refreshing the unread indicator after each so it reflects the server's state.

#### Scenario: Mark one notification as read
- **WHEN** the user opens an unread notification
- **THEN** the system marks it read through the backend and the unread count decreases on success

#### Scenario: Mark all notifications as read
- **WHEN** the user chooses to mark all as read
- **THEN** the system sends a single mark-all request and the unread indicator clears on success

### Requirement: Unread Notification Indicator
The system SHALL display an unread notification count in the application header, derived from the signed-in user's notifications, and SHALL show no count when there are none unread.

#### Scenario: Unread notifications exist
- **WHEN** the signed-in user has unread notifications
- **THEN** the header displays the unread count

#### Scenario: No unread notifications
- **WHEN** the signed-in user has no unread notifications
- **THEN** the header displays no count badge
