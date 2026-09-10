## Purpose

How the panel lets a merchant author the catalogue — products, categories, brands, collections, attributes, tax rules and bundle deals — including the authoring pages' validation, reference pickers, and the guards that stop a save from destroying data the form never loaded.

## ADDED Requirements

### Requirement: An attribute's values are authored in the order shoppers see them

An attribute's values SHALL be arranged by the merchant and stored in the arranged order. Position SHALL come from that order alone, never from the label — "S, M, L, XL" is the merchant's sequence and must survive a save that alphabetical ordering would destroy.

The merchant SHALL be able to append a value, remove one, and move one up or down.

#### Scenario: Order survives a save

- **WHEN** the merchant arranges values as S, M, L, XL and saves
- **THEN** reopening the attribute shows them in that order, not alphabetically

#### Scenario: Reordering an existing attribute

- **WHEN** the merchant moves a value up and saves
- **THEN** the new order is stored and the values keep their identities, so products selling them are unaffected

#### Scenario: A blank row is not a value

- **WHEN** the merchant leaves a value row's label empty and saves
- **THEN** that row is discarded rather than stored as an unnamed value

### Requirement: Two attribute values that read as the same choice are refused

Two values on one attribute whose labels differ only by surrounding space or by letter case SHALL be refused before the request is sent, because a product selling both would make a shopper's selection ambiguous.

#### Scenario: Same label twice

- **WHEN** the merchant enters "Red" in two value rows and saves
- **THEN** the save is refused with a reason naming the collision, and both rows keep what was entered

#### Scenario: Same label in different case

- **WHEN** the merchant enters "Red" and "red" and saves
- **THEN** the save is refused for the same reason

#### Scenario: Distinct labels

- **WHEN** every value's label is distinct once trimmed and compared without regard to case
- **THEN** the save proceeds

### Requirement: An attribute keeps at least one value

An attribute with no values offers a product nothing to sell, so a save leaving none SHALL be refused before the request is sent.

#### Scenario: Every value removed

- **WHEN** the merchant clears or removes every value row and saves
- **THEN** the save is refused with a reason shown against the values list

#### Scenario: One value remains

- **WHEN** exactly one value carries a label
- **THEN** the save proceeds

### Requirement: A swatch is offered only for an attribute presented as swatches

An attribute declares how the storefront presents it. A colour swatch SHALL be collected only when the attribute is presented as swatches; when it is presented as labelled chips, no swatch control SHALL appear on a value row and no swatch SHALL be sent.

Switching the presentation SHALL take effect on the rows immediately, without a save.

#### Scenario: Swatch presentation

- **WHEN** the attribute is set to be presented as colour swatches
- **THEN** every value row offers a colour control

#### Scenario: Label presentation

- **WHEN** the attribute is set to be presented as labelled chips
- **THEN** no value row offers a colour control, and saving sends no swatch

#### Scenario: Switching presentation

- **WHEN** the merchant changes the presentation from chips to swatches
- **THEN** the colour controls appear on the existing rows without the page being saved or reloaded

### Requirement: Removing attribute values that products still sell is confirmed, not refused outright

When a save would remove values that products currently sell, the server refuses it and names what is affected. The panel SHALL present that refusal as a decision for the merchant rather than as a failure: it SHALL explain what is still selling the values and offer to proceed anyway.

Proceeding SHALL re-send what the merchant already arranged. Nothing entered SHALL have to be typed again.

#### Scenario: The removal is blocked

- **WHEN** a save would remove values products still sell
- **THEN** the page explains which are affected and offers to remove them anyway, instead of showing a plain save failure

#### Scenario: Confirming the removal

- **WHEN** the merchant chooses to remove them anyway
- **THEN** the same arrangement is re-sent and accepted, with no re-entry of any field

#### Scenario: Leaving the removal unconfirmed

- **WHEN** the merchant does not confirm
- **THEN** the form stays exactly as arranged, with the explanation still shown, and nothing is sent
