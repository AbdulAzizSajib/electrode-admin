## Purpose

Covers how the admin panel views and manages what happens after an order — return requests, refunds, and review moderation — against the real backend, replacing the earlier mock in-memory data. Return creation and review content editing/deletion are explicitly out of scope: the real backend only lets customers create returns and reviews, and never lets an admin edit or delete review content.

## ADDED Requirements

### Requirement: Return Visibility and Status Management
The system SHALL fetch return requests from the backend and allow an admin to move a return through its status values, requiring a destination warehouse only when completing a return (which restocks the returned items).

#### Scenario: Approve a requested return
- **WHEN** the user approves a return request with status Requested
- **THEN** the system sends the status change to the backend, and the return's status reflects Approved on success

#### Scenario: Complete a return without a warehouse
- **WHEN** the user attempts to mark a return Completed without selecting a warehouse
- **THEN** the system blocks submission (or the backend rejects it) since a destination warehouse is required to restock

#### Scenario: Complete a return
- **WHEN** the user completes an approved return with a warehouse selected
- **THEN** the system sends the completion to the backend, and on success the return's status becomes Completed and its items are restocked into the selected warehouse

### Requirement: Refund Creation
The system SHALL create a refund against a specific order by sending an amount and, optionally, a reason, a specific payment, or a specific return request to link it to.

#### Scenario: Issue a refund linked to a return
- **WHEN** the user issues a refund for an order and links it to one of that order's return requests
- **THEN** the system sends the refund to the backend, and on success the refund appears in the refund list and the linked return moves toward a completed state

### Requirement: Review Moderation
The system SHALL allow an admin to set a review's status (Pending, Approved, Rejected, or Hidden) and to post or update an admin reply, and SHALL NOT expose any action to edit a review's own content or delete it, since the backend has no such endpoint.

#### Scenario: Approve a pending review
- **WHEN** the user approves a review with status Pending
- **THEN** the system sends the status change to the backend, and the review's status reflects Approved on success

#### Scenario: Reply to a review
- **WHEN** the user posts an admin reply to a review
- **THEN** the system sends the reply to the backend, and the reply appears on the review on success
