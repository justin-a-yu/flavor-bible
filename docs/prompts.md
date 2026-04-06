# Product Brainstorm — Flavor Bible Explorer

A log of the ideation conversation used to define this project.

---

**[User]** I would like to process the third chapter, the charts, in order to create a tool that helps chefs explore flavors and use the reference in a most easily digestible way. I am thinking about processing the data in a format suitable to create a network so that the user can input a couple flavors and easily explore the flavors that are most suitable and why. Help me brainstorm the best product for this.

---

**Q1: Who is the primary user of this tool?**
- Options: Professional chefs / Home cooks / Both / Food R&D teams

**[User]** The primary user is home cooks. I am a home cook and I would like to explore and create something that is eye catching and easily accessible. But I have seen similar projects with the same dataset that neglect the depth of data that is present in the book (it only had connections between different flavors) and I think there is a missed opportunity there. I want to make it accessible but also find a way to display and utilize the strength of flavor connections and recommendations.

---

**Q2: How important is it to capture contextual notes (e.g. "pairs well with lamb in spring", "use sparingly", "classic French combination") in addition to connection strength?**
- Options: Very important / Somewhat important / Not a priority

**[User]** Somewhat important. It would be best if they are not present initially in order to declutter the UI, but then the user can click on the flavors and see the explicit notes. If there is a relevant note (i.e. if lamb is being explored) then it can pop up too.

---

**Q3: What is the core interaction? When a user opens the tool, what do they do first?**
- Options: Search single ingredient / Start with two ingredients / Blank canvas / Guided mode

**[User]** It should be a single ingredient and expand the flavor network around it. Also have the capability to start with two ingredients.

---

**Q4: How should connection strength be visually encoded?**
- Options: Edge thickness / Edge color gradient / Node size / Combination / No preference

**[User]** No preference — decided: edge thickness + color gradient + node size reflecting connection density.

---

**Q5: What platform?**
- Options: Web desktop-first / Web mobile-first / Web responsive / Native mobile / Desktop app

**[User]** Web app, leaning towards desktop-first or responsive. Decided: **desktop-first web app** (graph exploration needs canvas space; mobile simplified view is a future nice-to-have).

---

**Q6: Technical comfort level?**
- Options: Beginner / Intermediate / Strong / Specific stack in mind

**[User]** Intermediate.

---

**Q7: Graph visualization library preference?**
- Options: D3.js / Cytoscape.js / React Flow / No preference

**[User]** No preference — decided: **React Flow** (best fit for intermediate developer, excellent docs, component-based, customizable).
Full stack: **React + React Flow + Tailwind CSS + static JSON.**

---

**Q8: How should data be stored and served?**
- Options: Static JSON / Lightweight backend (SQLite) / Hosted database (Supabase/Firebase) / No preference

**[User]** No preference — decided: **static JSON bundled with the app** (dataset is small enough, no infrastructure needed, instant load).

---

**Q9: How should two-ingredient mode work?**
- Options: Intersection only / Side by side with shared highlights / Merged network with visual distinction / No preference

**[User]** Side by side with shared connections highlighted. Can change if it gets cluttered.

---

**Q10: Deployment?**
- Options: Hosted publicly (Vercel/Netlify) / Local only / Decide later

**[User]** Local first, hosting later.

---

**Visualization direction decision:**
- **Lens view** = primary interactive exploration mode
- **Board view** = secondary mode, optimised for printing and reference
- User should be able to seamlessly swap between the two views
- Radial rings dropped — gets convoluted with multiple ingredients

---

**Lens ideation decisions:**

- **Single click** on a bubble → detail card
- **Double click** on a bubble → promote it to a new full lens on the canvas
- **Shared bubbles keep their strength color** (gold/orange/green) — spatial position between lenses is sufficient to communicate "shared". No purple override.
- **Lens resize** → scroll wheel over a lens (scroll up = bigger, scroll down = smaller)
