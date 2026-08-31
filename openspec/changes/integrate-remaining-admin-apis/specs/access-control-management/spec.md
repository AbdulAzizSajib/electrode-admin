## Purpose

Covers how the admin panel administers roles, permissions, and staff user accounts against the real backend access-control API, including the owner-only restriction that governs the privilege system itself.

## ADDED Requirements

### Requirement: Owner-Only Access to Role and Permission Administration
Role and permission administration SHALL be reachable only by a signed-in user whose role is Owner. The system SHALL hide its navigation entry and block its route for any other role, rather than presenting a page whose every request fails authorization.

#### Scenario: Owner opens roles and permissions
- **WHEN** a signed-in Owner navigates to roles and permissions
- **THEN** the page loads and the role list is fetched

#### Scenario: Non-owner attempts to reach roles and permissions
- **WHEN** a signed-in Admin or Staff user attempts to navigate to roles and permissions
- **THEN** the system does not show the navigation entry and blocks the route instead of issuing requests that would be rejected

### Requirement: Role Management
The system SHALL create, list, update, and delete roles against the backend, sending each role's name and optional description, and SHALL surface the backend's rejection reason — for example, a role still assigned to users — instead of a generic failure message when a delete request fails.

#### Scenario: Create a role
- **WHEN** the Owner submits the new-role form with a name
- **THEN** the system sends the role to the backend, and on success the new role appears in the role list

#### Scenario: Delete a role that is still assigned
- **WHEN** the Owner confirms deleting a role that is still assigned to users and the backend rejects the request
- **THEN** the system shows the backend's error message and the role remains in the list

### Requirement: Permission Listing
The system SHALL list the available permissions from the backend, displaying each permission's name and description as an ungrouped list.

#### Scenario: View available permissions
- **WHEN** the Owner opens roles and permissions
- **THEN** the system requests the permission list and displays every permission with its name and description

### Requirement: Granting and Revoking Role Permissions
The system SHALL grant a permission to a role and revoke a permission from a role as two distinct backend operations, and SHALL refresh the role's permissions from the backend after each so the displayed grant state reflects what the server stored rather than an optimistic local guess.

#### Scenario: Grant a permission to a role
- **WHEN** the Owner enables a permission that the role does not currently have
- **THEN** the system sends a grant request for that role and permission, and on success the permission shows as granted

#### Scenario: Revoke a permission from a role
- **WHEN** the Owner disables a permission that the role currently has
- **THEN** the system sends a revoke request for that role and permission, and on success the permission shows as not granted

#### Scenario: Grant rejected by the backend
- **WHEN** a grant request is rejected by the backend
- **THEN** the system shows the backend's error message and the permission's displayed grant state matches the server's, not the attempted change

### Requirement: Staff User Listing
The system SHALL list staff users from the backend with server-side pagination and search, showing each user's name, email, assigned role, status, and last sign-in time, and SHALL allow filtering by role and by status.

#### Scenario: Search for a staff user
- **WHEN** the user types a search term into the staff user list
- **THEN** the system re-requests the list with that search term and displays only matching users, paginated by the backend

#### Scenario: Filter staff users by role
- **WHEN** the user filters the staff list to a single role
- **THEN** the system re-requests the list with that role filter and displays only matching users

#### Scenario: User who has never signed in
- **WHEN** the staff list contains a user with no recorded sign-in
- **THEN** the system displays an explicit never-signed-in indicator rather than a blank cell or an error

### Requirement: Staff Role and Status Assignment
The system SHALL change a staff user's assigned role and account status through the backend, and SHALL surface the backend's rejection reason — for example, an attempt made by a role not permitted to reassign roles — instead of a generic failure.

#### Scenario: Assign a different role to a staff user
- **WHEN** the Owner selects a different role for a staff user and saves
- **THEN** the system sends the new role to the backend, and the staff list reflects the change on success

#### Scenario: Deactivate a staff user
- **WHEN** the user changes a staff user's status to inactive and saves
- **THEN** the system sends the status change to the backend, and the staff list reflects it on success

#### Scenario: Role change rejected for insufficient privilege
- **WHEN** a user not permitted to reassign roles attempts a role change and the backend rejects it
- **THEN** the system shows the backend's rejection message and the staff user's role is unchanged
