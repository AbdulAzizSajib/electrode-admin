## Purpose

Alerts staff the moment a customer places an order, so orders are noticed without anyone watching the screen. Covers the on-screen and audible alert, the staff member's control over the sound, and the rules that keep alerts from firing spuriously or repeatedly.

## ADDED Requirements

### Requirement: A newly placed order alerts staff

When the panel detects an order newer than the most recent one it has already shown, it SHALL raise an on-screen alert identifying the order, and SHALL play an alert sound unless the sound is muted.

#### Scenario: Order arrives while staff are viewing the panel

- **WHEN** a customer places an order and the panel detects it
- **THEN** an on-screen alert naming the order appears
- **AND** the alert sound plays if it is not muted

#### Scenario: Alert leads to the order

- **WHEN** the staff member acts on the on-screen alert
- **THEN** they are taken to that order's details

### Requirement: Only genuinely new orders raise an alert

An alert SHALL be raised only for an order placed after the panel established its baseline. Opening or reloading the panel MUST NOT alert for orders that already existed.

#### Scenario: Panel is opened with existing orders present

- **WHEN** a staff member opens the panel and prior orders already exist
- **THEN** no alert is raised for them
- **AND** the most recent existing order becomes the baseline for future alerts

#### Scenario: Panel is reloaded after an alert

- **WHEN** the panel is reloaded after an order has already alerted
- **THEN** that order does not alert again

### Requirement: Several orders at once raise a single alert

When one refresh reveals more than one new order, the panel SHALL raise a single alert conveying how many arrived, and MUST play the sound only once.

#### Scenario: Three orders arrive between refreshes

- **WHEN** a refresh reveals three orders placed since the previous one
- **THEN** one alert is raised indicating that three orders arrived
- **AND** the sound plays once, not three times

### Requirement: Staff can mute the alert sound

The panel SHALL offer a control to mute and unmute the alert sound. The setting MUST persist across reloads and new sessions on that browser, and MUST show its current state. Muting affects only the sound — the on-screen alert continues regardless.

#### Scenario: Sound is muted

- **WHEN** a staff member mutes the alert sound and an order then arrives
- **THEN** no sound plays
- **AND** the on-screen alert still appears

#### Scenario: Muted panel is reopened later

- **WHEN** a staff member who muted the sound reloads or reopens the panel
- **THEN** the sound is still muted
- **AND** the control shows that it is muted

#### Scenario: Sound is unmuted again

- **WHEN** a staff member unmutes the sound and an order then arrives
- **THEN** the sound plays

### Requirement: A blocked sound never costs the alert

Browsers suppress audio until the user has interacted with the page. The panel MUST treat a blocked or failed sound as a non-event: the on-screen alert is still raised, no error is shown, and later alerts are still attempted.

#### Scenario: Order arrives before any user interaction

- **WHEN** an order arrives and the browser blocks the sound because the user has not yet interacted with the page
- **THEN** the on-screen alert still appears
- **AND** no error message is shown

#### Scenario: Sound plays once interaction has occurred

- **WHEN** the staff member has interacted with the page and an order then arrives with the sound unmuted
- **THEN** the sound plays

#### Scenario: Audio is unavailable in the browser

- **WHEN** the browser cannot play the alert sound at all
- **THEN** the on-screen alert still appears
- **AND** the panel continues to operate normally
