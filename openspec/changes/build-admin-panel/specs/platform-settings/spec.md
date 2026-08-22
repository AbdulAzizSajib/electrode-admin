## Purpose

Lets store owners/admins configure store-wide settings, manage roles and granular permissions, and review an audit trail of admin actions.

## ADDED Requirements

### Requirement: Store Settings Form
The system SHALL provide a form for store-wide settings — store name, contact email, currency, tax rate, and free-shipping threshold — matching the fields exposed by the `/settings` endpoint, restricted to OWNER/ADMIN roles.

#### Scenario: Save settings
- **WHEN** the user submits valid changes to the store settings form
- **THEN** the mock settings record updates and a success toast confirms the save

#### Scenario: Non-privileged role cannot access
- **WHEN** a STAFF-role mock session attempts to open Store Settings
- **THEN** access is denied per the admin-shell role-aware navigation/guarding behavior

### Requirement: Roles and Permissions Management
The system SHALL provide list, create, and edit UI for roles (name, description, assigned permissions) and a read/manage view for the permission catalog, and SHALL allow assigning or removing permissions on a role, restricted to the OWNER role.

#### Scenario: Assign a permission to a role
- **WHEN** the OWNER user adds a permission to a role
- **THEN** the mock role-permission association is created and reflected in the role's detail view

#### Scenario: Remove a permission from a role
- **WHEN** the OWNER user removes a permission from a role
- **THEN** the mock association is deleted and no longer listed on the role

#### Scenario: Delete a role in use
- **WHEN** the OWNER user attempts to delete a role currently assigned to a mock user
- **THEN** the system blocks the deletion with an explanatory message

### Requirement: Audit Log Viewer
The system SHALL display a read-only, paginated, filterable (by actor, action type, and date range) audit log listing actor, action, affected resource, and timestamp, sourced from mock audit entries generated as other actions occur in the app.

#### Scenario: Filter by actor
- **WHEN** the user filters the audit log by a specific staff user
- **THEN** only mock audit entries attributed to that user are shown

#### Scenario: Action generates audit entry
- **WHEN** a tracked mutation occurs elsewhere in the app (e.g. a product edit or role change)
- **THEN** a corresponding mock audit log entry is appended, visible in this viewer
