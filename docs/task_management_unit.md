# Task Management Unit — Flavor Bible Explorer

## Overview

This document consolidates all user stories for the Flavor Bible Explorer into a single Task Management Unit. It serves as the development contract for the system — defining what must be built, for whom, and why.

**Product intent:** Build an interactive interface for home cooks to explore flavor relationships and find inspiration in their cooking, powered by the data and insights of *The Flavor Bible*.

**Primary persona:** Alex — a home cook with intermediate skills who wants to discover new flavor combinations quickly and feel confident making creative choices in the kitchen.

**Epics covered:**
1. Ingredient Exploration (Lens View)
2. Reference / Overview (Board View)
3. Filtering
4. Ingredient Detail
5. Search
6. Session Persistence

---

## All User Stories

### Epic 1: Ingredient Exploration (Lens View)

> As Alex, I want to visually explore flavor relationships around one or more ingredients, so that I can discover what pairs well and feel inspired to experiment.

---

**Story 1.1 — Start exploration from a single ingredient**
`Priority: Must Have`

As Alex, I want to search for an ingredient and see its flavor pairings appear around it, so that I can immediately understand what goes well with it.

*Acceptance criteria:*
- Alex can type an ingredient name and select it from a suggestion list
- A lens appears showing the ingredient at center with pairing bubbles orbiting it
- Pairings are visually differentiated by strength (Essential, Highly Recommended, Recommended, Holy Grail)
- The lens is visible without any further interaction

---

**Story 1.2 — Add a second ingredient to compare**
`Priority: Must Have`

As Alex, I want to add a second ingredient alongside the first, so that I can see which flavors they share and where they diverge.

*Acceptance criteria:*
- Alex can add a second ingredient which appears as its own lens on the canvas
- Pairings shared between both ingredients migrate to the overlapping zone when lenses are brought together
- Non-shared pairings remain associated with their respective lens
- Alex can drag lenses closer or further apart to control the overlap

---

**Story 1.3 — Promote a pairing to a new lens**
`Priority: Must Have`

As Alex, I want to double-click a pairing bubble to open it as a new lens, so that I can continue exploring from that ingredient without losing my current view.

*Acceptance criteria:*
- Double-clicking a bubble creates a new lens for that ingredient
- The original lens and its pairings remain on screen
- Alex can have multiple lenses active simultaneously

---

**Story 1.4 — Resize a lens**
`Priority: Must Have`

As Alex, I want to resize a lens by scrolling over it, so that I can control how many pairings are visible at once.

*Acceptance criteria:*
- Scrolling up over a lens increases its size and reveals more pairing bubbles
- Scrolling down decreases its size and hides lower-strength pairings first
- The number of visible bubbles adjusts fluidly as the lens grows or shrinks

---

**Story 1.5 — Reshuffle visible pairings**
`Priority: Should Have`

As Alex, I want to reshuffle which pairings are shown in a lens, so that I can discover different options when the lens can't show everything at once.

*Acceptance criteria:*
- Pressing R while hovering a lens replaces the current visible pairings with a different random selection from the same ingredient
- Strength tier distribution is preserved (Essential always shown before Recommended)
- The reshuffled state is reflected in the URL

---

**Story 1.6 — Pan and zoom the canvas**
`Priority: Must Have`

As Alex, I want to pan and zoom the canvas, so that I can navigate a complex multi-lens layout comfortably.

*Acceptance criteria:*
- Holding Space and dragging pans the viewport
- Holding Space and scrolling zooms in/out centered on the cursor
- All lenses and bubbles remain correctly positioned relative to each other during pan and zoom

---

### Epic 2: Reference / Overview (Board View)

> As Alex, I want a structured view of ingredients and their pairings, so that I can scan and reference information quickly without the spatial metaphor of the lens.

---

**Story 2.1 — Switch to board view**
`Priority: Should Have`

As Alex, I want to switch between the lens view and a board view, so that I can choose the mode that fits how I'm thinking at that moment.

*Acceptance criteria:*
- A clear toggle allows switching between lens view and board view
- The current set of active ingredients carries over between views
- Switching views does not reset or lose the current exploration state

---

**Story 2.2 — Browse ingredients as cards in board view**
`Priority: Should Have`

As Alex, I want to see my selected ingredients displayed as cards with their pairings listed, so that I can scan relationships quickly and compare at a glance.

*Acceptance criteria:*
- Each active ingredient appears as a card
- Pairings are listed within each card, grouped or ordered by strength
- Shared pairings between multiple ingredients are visually highlighted
- The board is legible and scannable without interaction

---

**Story 2.3 — Print or export the board view**
`Priority: Must Have`

As Alex, I want to print or export the board view as a clean document, so that I can share my flavor exploration with friends or keep a physical reference for future cooking.

*Acceptance criteria:*
- Alex can click "Print View" in the board toolbar to open a clean standalone print document in a new tab
- The print page preserves the current ingredient selection and active filters (serialized into URL params — shareable)
- The output is clean and legible — no UI chrome, navigation, or interactive buttons visible
- Ingredient profiles (meta, techniques, botanicals, avoids, tips, quotes), shared pairings, affinities, and remaining flavor cards are all present
- Active filters are summarized at the bottom of the document
- Alex opens the browser print dialog themselves (Cmd+P / Ctrl+P) to print or save as PDF

---

### Epic 3: Filtering

> As Alex, I want to filter what pairings I see, so that I can focus on options that are relevant to what I'm cooking.

---

**Story 3.1 — Filter by cuisine / region**
`Priority: Should Have`

As Alex, I want to filter pairings by cuisine or region (e.g. French, Japanese, West African), so that I can explore combinations that fit the style of dish I'm making.

*Acceptance criteria:*
- Alex can select one or more cuisines from a filter panel
- Only pairings associated with the selected cuisines are shown in both lens and board view
- Deselecting all filters restores the full pairing set

---

**Story 3.2 — Filter by season**
`Priority: Should Have`

As Alex, I want to filter pairings by season, so that I can prioritize ingredients that are in season.

*Acceptance criteria:*
- Alex can filter by one or more seasons (Spring, Summer, Autumn, Winter)
- Only pairings associated with matching seasons are shown
- The filter applies consistently across both views

---

**Story 3.3 — Filter by taste profile**
`Priority: Should Have`

As Alex, I want to filter pairings by taste profile (e.g. sweet, sour, bitter, umami, salty), so that I can steer the flavor direction of a dish.

*Acceptance criteria:*
- Alex can select one or more taste profiles
- Only pairings matching those taste profiles are shown
- Multiple selected profiles are treated as OR (show any match)

---

**Story 3.4 — Filter to show shared or individual pairings only**
`Priority: Should Have`

As Alex, I want to filter to show only shared pairings (present in multiple lenses) or only individual ones, so that I can reduce clutter when working with multiple ingredients.

*Acceptance criteria:*
- A toggle or filter option allows showing: All / Shared only / Individual only
- In lens view, non-matching bubbles fade out or hide
- In board view, non-matching pairings are hidden from cards

---

### Epic 4: Ingredient Detail

> As Alex, I want to see detailed context about a pairing when I choose to, so that I can understand not just *that* two ingredients go together but *why* and *how*.

---

**Story 4.1 — View pairing detail on click**
`Priority: Must Have`

As Alex, I want to click a pairing bubble or card entry to see more information about it, so that I can understand the nuance behind the pairing.

*Acceptance criteria:*
- Clicking a pairing reveals a detail panel or card
- The panel shows: pairing strength label, any modifier notes (e.g. "especially in spring"), a quote or tip from the book if available, and taste/season metadata if available
- The panel can be dismissed without losing the current view state

---

**Story 4.2 — See top pairings of a pairing ingredient**
`Priority: Could Have`

As Alex, I want to see the top pairings of an ingredient I'm looking at in the detail panel, so that I can decide whether to explore it further.

*Acceptance criteria:*
- The detail panel shows the top pairings of the selected ingredient
- Alex can double-click or tap a call-to-action to open that ingredient as a new lens

---

**Story 4.3 — Open a full ingredient profile page**
`Priority: Must Have`

As Alex, I want to click an ingredient in either the lens or board view to open its full profile in a new tab, so that I can see everything the Flavor Bible has to say about that ingredient without losing my current exploration.

*Acceptance criteria:*
- Clicking the ingredient name/label (lens center or board card header) opens a new tab
- The profile page displays all available data for that ingredient: full pairing list with strengths, taste profile, weight, volume, season, all quotes with attribution, all tips, and flavor affinities
- The profile page is self-contained and readable without any other context
- The page has a clean, printable layout
- Deep-linking directly to an ingredient profile URL works (e.g. `/ingredient/garlic`)
- **Could Have:** A photo of the ingredient is displayed on the profile page to help Alex visually identify it

---

**Story 4.4 — See what an ingredient explicitly avoids**
`Priority: Should Have`

As Alex, I want to know when the book explicitly recommends avoiding a pairing, so that I can steer clear of combinations that don't work.

*Acceptance criteria:*
- On the full ingredient profile page, a clearly marked "Avoid" section shows ingredients or categories to avoid, in a distinct red-toned style
- In the board view, each ingredient's profile card shows a compact "Avoid:" line in its header when avoids exist
- When two active ingredients in the board view explicitly avoid each other, a ⚠ warning banner appears between the profile and pairings sections
- Avoid items that resolve to known ingredients link to their profile page

---

### Epic 5: Search

> As Alex, I want to find specific ingredients quickly, so that I can start or extend my exploration without browsing through a long list.

---

**Story 5.1 — Search for an ingredient by name**
`Priority: Must Have`

As Alex, I want to type an ingredient name and see matching suggestions, so that I can find what I'm looking for quickly even if I'm unsure of the exact name.

*Acceptance criteria:*
- A search input is always accessible
- Results appear as Alex types (minimum 2 characters)
- Suggestions match on partial name (e.g. "choc" returns "Chocolate", "White Chocolate")
- Already-active ingredients are excluded from results
- Selecting a result adds the ingredient to the current exploration

---

### Epic 6: Session Persistence

> As Alex, I want my exploration to be preserved so that I can return to it later or share it with someone else.

---

**Story 6.1 — Restore exploration from URL**
`Priority: Should Have`

As Alex, I want the URL to reflect my current exploration state, so that I can bookmark it or share it and return to exactly where I left off.

*Acceptance criteria:*
- The URL updates automatically as Alex adds ingredients, moves lenses, resizes, pans, or zooms
- Loading the URL in a new tab restores the full exploration state (ingredients, positions, zoom, pan, seeds)
- No login or account is required

---

## Priority Summary (MoSCoW)

| ID | Story | Priority |
|---|---|---|
| 1.1 | Start from single ingredient | Must Have |
| 1.2 | Add second ingredient | Must Have |
| 1.3 | Promote pairing to lens | Must Have |
| 1.4 | Resize lens | Must Have |
| 1.5 | Reshuffle pairings | Should Have |
| 1.6 | Pan and zoom | Must Have |
| 2.1 | Switch to board view | Should Have |
| 2.2 | Browse as cards | Should Have |
| 2.3 | Print or export board view | Must Have |
| 3.1 | Filter by cuisine | Should Have |
| 3.2 | Filter by season | Should Have |
| 3.3 | Filter by taste profile | Should Have |
| 3.4 | Filter shared/individual | Should Have |
| 4.1 | Pairing detail on click | Must Have |
| 4.2 | Top pairings in detail panel | Could Have |
| 4.3 | Full ingredient profile page | Must Have |
| 4.3a | Ingredient photo on profile page | Could Have |
| 4.4 | Avoid pairings | Should Have |
| 5.1 | Search by name | Must Have |
| 6.1 | Restore from URL | Should Have |
