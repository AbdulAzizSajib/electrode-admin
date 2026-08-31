## Purpose

Covers how the admin panel triages customer support tickets and conducts the threaded message conversation against the real backend support API, replacing the earlier mock in-memory data.

## ADDED Requirements

### Requirement: Support Ticket Listing
The system SHALL list support tickets from the backend showing each ticket's ticket number, subject, requesting customer, status, priority, assignee, and last-updated time, and SHALL allow filtering the list by status and by priority.

#### Scenario: Filter tickets by status
- **WHEN** the user filters the ticket list to open tickets
- **THEN** the system re-requests the ticket list with that status filter and displays only matching tickets

#### Scenario: Ticket with no assignee
- **WHEN** the ticket list contains a ticket that has not been assigned to anyone
- **THEN** the system displays it with an explicit unassigned indicator rather than a blank cell or an error

### Requirement: Support Ticket Detail
The system SHALL display a single ticket's full detail — ticket number, subject, description, status, priority, requesting customer, and assignee — fetched from the backend.

#### Scenario: Open a ticket
- **WHEN** the user opens a ticket from the list
- **THEN** the system requests that ticket and displays its subject, description, status, priority, and customer

### Requirement: Ticket Message Thread
The system SHALL fetch a ticket's messages from the backend as a separate request from the ticket itself, and SHALL display each message with its author and timestamp, identifying messages whose sender is no longer present as being from an unknown sender rather than failing to render.

#### Scenario: View a ticket conversation
- **WHEN** the user opens a ticket that has messages
- **THEN** the system requests the ticket's messages and displays them in chronological order with each sender and time

#### Scenario: Message from a removed user
- **WHEN** a message's sender no longer exists
- **THEN** the system displays the message with an unknown-sender label and the thread still renders

#### Scenario: Ticket with no messages
- **WHEN** the user opens a ticket that has no messages yet
- **THEN** the system shows an empty conversation state rather than an error

### Requirement: Replying to a Ticket
The system SHALL post a staff reply to the ticket's message endpoint, and on success SHALL refresh the message thread so the new reply appears without a manual page reload.

#### Scenario: Send a reply
- **WHEN** the user types a reply and submits it
- **THEN** the system posts the message to the backend and the reply appears in the thread on success

#### Scenario: Reply rejected by the backend
- **WHEN** the user submits a reply the backend rejects
- **THEN** the system shows the backend's error message and the reply is not added to the thread

### Requirement: Ticket Triage
The system SHALL update a ticket's status and priority through the backend, and SHALL surface the backend's rejection reason when the signed-in user's role is not permitted to make the change instead of showing a generic failure.

#### Scenario: Resolve a ticket
- **WHEN** the user changes a ticket's status to resolved
- **THEN** the system sends the status change to the backend, and the ticket detail and list reflect it on success

#### Scenario: Raise a ticket's priority
- **WHEN** the user changes a ticket's priority to urgent
- **THEN** the system sends the priority change to the backend and the ticket reflects it on success

#### Scenario: Update rejected for insufficient role
- **WHEN** a user whose role may not triage tickets attempts a status change and the backend rejects it
- **THEN** the system shows the backend's rejection message and the ticket is unchanged
