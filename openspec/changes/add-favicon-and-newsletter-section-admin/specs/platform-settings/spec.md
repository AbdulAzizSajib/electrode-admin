## ADDED Requirements

### Requirement: Browser Tab Icon Editor

The system SHALL let an administrator supply the image a browser shows as the storefront's tab icon, from the same branding editor that already administers the header and footer logos.

The administrator SHALL be able to upload an image file, see the image that is currently set, and clear it. A cleared icon SHALL mean "the storefront falls back to its own icon", not "the storefront shows a blank icon", and the editor SHALL say so rather than leaving the administrator to guess what clearing does.

The editor SHALL state what the image is used for and what shape it should be, because a tab icon is rendered very small and artwork chosen for a header will not read at that size.

While an upload is in flight the editor SHALL show that it is working, and a failed upload SHALL report the reason and leave the previously set icon in place.

Saving the icon SHALL leave every other setting as it was, including both logos, the brand display modes, the theme, and every setting administered from another screen.

#### Scenario: Administrator uploads a tab icon

- **WHEN** the administrator picks an image file for the tab icon and saves
- **THEN** the image is uploaded, the field previews it, and the address is sent to the backend
- **AND** both logos, the brand display modes and the theme are unchanged

#### Scenario: Administrator clears the tab icon

- **WHEN** the administrator clears the tab icon and saves
- **THEN** the setting is cleared
- **AND** the editor has told the administrator that the storefront will fall back to its own icon

#### Scenario: Upload fails

- **WHEN** the upload of a tab icon fails
- **THEN** the administrator is shown the reason
- **AND** the icon that was set before the attempt is still set

#### Scenario: Saved state is shown on load

- **WHEN** the administrator opens the branding editor for a store that has a tab icon set
- **THEN** that image is previewed rather than an empty slot

### Requirement: Newsletter Is Administered From The Home Sections Editor

The newsletter signup SHALL appear in the home sections editor as one of the sections the home page is built from, so an administrator can switch it on, switch it off and place it anywhere in the order — the same controls every other section has.

Its wording — the heading, the supporting text, the input placeholder and the button label — SHALL be editable in that same editor, beside the switch that decides whether it is shown. Wording the administrator has entered SHALL be preserved when the section is switched off, and SHALL be unchanged when it is switched back on.

The wording fields SHALL be usable by keyboard and mouse in the ordinary way, and MUST NOT be made hard to edit by the row's drag-to-reorder behaviour.

Saving from this editor SHALL persist the section list and the newsletter wording together, and SHALL leave every other setting as it was — including the header links, footer link columns, social links, contact details, theme, checkout configuration and catalog display features, none of which this editor presents.

A newsletter section returned by the backend MUST NOT be discarded by the editor as unrecognised. An administrator's saved order and switch states MUST survive a save made from this editor unchanged, except where the administrator changed them.

#### Scenario: Administrator switches the newsletter off

- **WHEN** the administrator switches the newsletter section off and saves
- **THEN** the change is sent to the backend and the editor reflects the saved state on success
- **AND** the wording the administrator had entered is still there when the section is switched back on

#### Scenario: Administrator edits the wording

- **WHEN** the administrator edits the newsletter heading and saves
- **THEN** the new heading is sent to the backend together with the section list
- **AND** the footer link columns, social links and contact details are unchanged

#### Scenario: Administrator reorders the newsletter

- **WHEN** the administrator moves the newsletter above another section, by dragging it or by using its move controls, and saves
- **THEN** the saved order places it where the administrator put it

#### Scenario: The newsletter survives a save made from this editor

- **WHEN** the administrator opens the editor for a store whose configuration includes the newsletter, changes an unrelated section, and saves
- **THEN** the newsletter is still in the saved configuration, in its position, with its switch state and wording unchanged

#### Scenario: Rejected save

- **WHEN** the backend rejects the save
- **THEN** the system shows the backend's message and every entered value — the ordering, the switches and the wording — is preserved rather than discarded

### Requirement: Footer Editor No Longer Administers The Newsletter

The footer editor SHALL NOT present the newsletter's wording, and saving from it MUST NOT write the newsletter's wording. Exactly one editor SHALL own that value, so that two screens cannot overwrite each other's copy of it.

The footer editor SHALL continue to administer its link columns, social links, about text and contact details, unchanged.

#### Scenario: Administrator saves the footer

- **WHEN** the administrator changes a footer link column and saves
- **THEN** the newsletter wording is left exactly as it was, whoever set it and whenever

#### Scenario: Administrator looks for the newsletter in the footer editor

- **WHEN** the administrator opens the footer editor
- **THEN** no newsletter wording fields are presented there
