# KSI Design System

> Category: Enterprise / Field Operations
> Restrained, work-first interface language for KSI products.

## 1. Overview & Philosophy

KSI builds operational software: field inspection, site monitoring, drone and observation-session control,
safety reporting, and the back-office tools around them. These are tools used *during* work, often outdoors or
under time pressure. The interface exists to make the next action obvious, not to demonstrate how much data
exists.

**Core principles**

- **Do not scatter KPI cards.** A metric earns a place only when it drives a decision. A wall of equally
  weighted numbers hides the one that matters.
- **Design around the real task flow.** Model the sequence a person actually performs, including the
  interruptions. Do not start from a dashboard template.
- **Every status connects to a next action.** A state without an available action is incomplete: show what the
  user can do, or say explicitly that nothing is required.
- **Use a map only when location is the point.** A map that does not answer a spatial question is decoration.
  If a list or a timeline carries the information better, use that.
- **Make the relationship visible.** A field site, a device, and an observation session are different things.
  The interface must make their relationship explicit rather than implying it through layout proximity.
- **Prefer hierarchy over density.** Progressive disclosure beats a crowded screen. Show the primary object
  and its state first; reveal the rest on demand.
- **Restraint is the visual language.** Neutral surfaces, few accents, strong typography. Bold colour is
  reserved for state and action, not for decoration.

## 2. Layout & Hierarchy

- Establish one primary object per screen: the site, the session, the report. Everything else is supporting.
- Lead with the object's current state and the action available on it. Metadata is secondary.
- Use a single reading column for narrative content and a bounded grid for comparison content. Do not mix
  both in one region.
- Group by decision, not by data source. Two fields belong together if the user evaluates them together.
- Keep primary navigation stable across the product. Avoid per-screen navigation models.
- Wide screens get more context, not more columns. Narrow screens get fewer elements, not smaller ones.
- Prefer full-width sections to nested cards. Cards inside cards flatten hierarchy.

## 3. Status & Action

- Define statuses as a small, explicit vocabulary (for example: scheduled, in progress, needs review,
  complete, blocked). Never rely on colour alone to carry state — pair colour with a label and an icon or shape.
- Every status shows its owner and its next step where that is known.
- Distinguish *informational* states from *actionable* ones. Informational states are quiet; actionable states
  carry the affordance.
- Stale or unknown data must look stale or unknown. Never present last-known values as current.
- Failures state what failed, what it affects, and what the user can do. Avoid generic error copy.
- Never use a status badge as a button. Separate reading from changing.

## 4. Maps & Spatial Views

- A map appears when the task is spatial: locating a site, judging coverage, planning a flight path, reviewing
  a route or a captured area.
- Always pair a map with a non-spatial alternative for the same information (list or table) when the task can
  be completed without geography.
- Show the map's scope and currency: what area, from when, and whether it is live or captured.
- Do not use a map as a hero image or a decorative header.
- Cluster or aggregate at low zoom. An unreadable cloud of pins is not an overview.
- Mark the difference between planned, in-progress, and completed spatial data consistently with the status
  vocabulary.

## 5. Data Display

- Choose the representation from the question: trend over time, comparison across items, distribution, or a
  single current value. Do not default to a chart.
- One chart answers one question. Split multi-question charts rather than adding axes and legends.
- Always label units and the time window. An unlabelled axis is an incomplete statement.
- Show empty, partial, and error states for every data region. A blank panel must say why it is blank.
- Prefer a table over a chart when the user needs exact values or row-level actions.
- Colour in data display encodes meaning and must match the status vocabulary; it is not a palette exercise.

## 6. Typography & Density

- One family across the product. Use weight and size for hierarchy, not a second typeface.
- Establish a small, fixed size scale and use it consistently. Do not tune sizes per screen.
- Numbers that are compared must be tabular and aligned. Right-align numeric columns.
- Keep line length readable for prose; allow denser rows for tabular scanning.
- Korean and English text coexist. Do not compress line height to fit more rows; keep both scripts readable.
- Dense layouts are acceptable when the user is scanning, not reading. Reading surfaces stay quiet.

## 7. Color

- Neutral surfaces carry the interface. Accent colour marks action and state only.
- Reserve the strongest colour for the single primary action on a screen.
- Status colours are a fixed, small set used consistently product-wide. Do not invent a new colour for a new
  status; extend the vocabulary instead.
- Ensure text and state colours meet contrast requirements on their actual background, including over imagery.
- Never encode required information in colour alone.

## 8. Components

- Reuse the product's existing components and tokens. This document defines intent; the product's real
  components define implementation.
- Buttons state the action ("Approve report"), not the mechanism ("Submit").
- Prefer inline editing with an explicit save or undo over modal forms for single-field changes.
- Confirmations are reserved for irreversible actions and must name the object and the consequence.
- Empty states teach the next action; they are not just "no data".
- Loading states preserve layout. Do not replace a region with a spinner that collapses the page.

## 9. Motion

- Motion clarifies a change of state or spatial relationship. It is not decorative.
- Keep durations short and consistent. Respect reduced-motion preferences.
- Do not animate data into place in a way that delays reading.
- Use motion to show where something came from or went to when a panel or detail view opens.

## 10. Anti-patterns

- A dashboard that opens with six or more equal KPI cards.
- A map used as decoration or as a hero background.
- Status communicated only by colour, dot, or badge with no label.
- "No data" with no explanation and no next step.
- Charts without units, time windows, or axis labels.
- Mixing field-site, device, and session identities in one list without distinguishing them.
- Replacing a dense but useful view with a simplified one that removes required information.
- Introducing a new accent colour or typeface to make a screen "look better".
- Modal dialogs for routine actions.
- Inventing a parallel design system instead of using the product's existing tokens and components.

## 11. Relationship to the Project

This package describes KSI design intent. A specific project's own `DESIGN.md`, tokens, and components remain
authoritative for that product, and an approved artifact from the Human overrides generic guidance here. Where
this document is silent, use the project's established patterns rather than importing another product's visual
language.
