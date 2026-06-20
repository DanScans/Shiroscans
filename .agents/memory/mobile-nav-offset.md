---
name: Mobile nav bottom offset
description: The fixed mobile nav bar is h-14 (56px); any fixed/floating UI element must use at least bottom-20 (80px) to avoid being hidden behind it.
---

## Rule
The `MobileNav` component is `fixed bottom-0 h-14` (56px tall). Any element using `position: fixed` that should appear above the nav must use at minimum `bottom-20` (80px) to guarantee clearance.

**Why:** `bottom-6` (24px) and `bottom-14` (56px) both fall within or flush with the nav bar, hiding the element. Users reported download buttons being invisible.

**How to apply:**
- Fixed download buttons, toasts, FABs → use `fixed bottom-20` at minimum
- If the element needs safe-area inset too, add `pb-safe` or `env(safe-area-inset-bottom)`
