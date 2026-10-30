# Technical constraints for Copilot dev sessions

Use this file as the source of truth for data and behavior constraints when changing the dress-up app.

## Catalog data constraints (`sprite-catalog.js`)

1. `categories[*].id` values define valid outfit keys.  
   Every key in `outfits[*].items` must match an existing category ID.
2. `items[*].id` values are globally unique and are the only valid references in outfits.
3. For every outfit mapping (`{ category: itemId }`), the referenced item must exist and its `item.category` must equal the mapping key category.
4. Every outfit must include:
   - `hair` (mandatory), and
   - at least one clothing category among: `bodysuits`, `underwear`, `slips`, `tights`, `tops`, `dresses`, `pants`.
5. Outfit IDs and image filenames are independent. Do not infer item filenames from outfit IDs.
6. Keep shared item IDs reused across outfits instead of duplicating catalog items.

## Runtime/UI constraints (`app.js`)

1. Hair is mandatory in presets and user flows:
   - Presets without hair throw during startup (`createOutfitPresets` validation).
   - The Hair category does not render a `None` button, so users cannot remove hair interactively.
2. Mutual exclusivity rules when selecting an item manually:
   - `bodysuits` clears `tops`, `pants`, `dresses`
   - `tops` clears `bodysuits`
   - `pants` clears `bodysuits`, `dresses`
   - `dresses` clears `bodysuits`, `pants`
3. Layer draw order is fixed and must stay coherent with visual composition:
   `underwear → slips → tights → bodysuits → pants → tops → dresses → shoes → hair → hats → necklace → bracelets`.

## Change checklist

- When editing outfits, validate that each preset still includes `hair`.
- When adding categories/items, update both data and any logic that depends on category IDs.
- When changing exclusivity or draw order, update this document and verify behavior in the browser.
