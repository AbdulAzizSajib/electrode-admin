## Purpose

Lets store staff handle customer support tickets and manage the admin's own in-app notifications.

## ADDED Requirements

### Requirement: Support Ticket List and Detail
The system SHALL display a paginated, filterable (by status and priority) list of support tickets showing subject, customer, status, priority, and last updated time, and a detail view showing the ticket's full message thread.

#### Scenario: Open ticket shows thread
- **WHEN** the user opens a support ticket
- **THEN** the detail page lists all mock messages in chronological order, each attributed to customer or staff

#### Scenario: Reply to a ticket
- **WHEN** staff submits a reply message on a ticket
- **THEN** a new mock message is appended to the thread and the ticket's "last updated" time refreshes

### Requirement: Support Ticket Status Management
The system SHALL allow staff to update a support ticket's status (e.g. open, in progress, resolved, closed) and priority.

#### Scenario: Resolve a ticket
- **WHEN** staff sets a ticket's status to resolved
- **THEN** the mock ticket record updates and the ticket list reflects the new status

### Requirement: Notifications Center
The system SHALL display a paginated list of the current admin's mock notifications (type, message, read/unread state, timestamp), accessible from the topbar, and SHALL allow marking a single notification or all notifications as read.

#### Scenario: Unread count badge
- **WHEN** the current admin has one or more unread mock notifications
- **THEN** the topbar notifications entry shows an unread count badge

#### Scenario: Mark all as read
- **WHEN** the user selects "Mark all as read"
- **THEN** every mock notification for the current admin is set to read and the unread badge clears
