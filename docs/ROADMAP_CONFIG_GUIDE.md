# How to Add Data to the Roadmap (Simple Guide)

This guide is for **non-technical** people. It explains how to add or edit practice papers in the roadmap by editing one file: **`src/lib/papers/roadmapConfig.ts`**.

---

## What is the roadmap?

The roadmap is the list of past papers (by exam and year) that students see when they choose what to practice.  
Editing `roadmapConfig.ts` changes **which papers appear** and **how they’re grouped** (e.g. Section 1, Section 2, Part A, Part B).

---

## Before you start

1. **Open the file**  
   In your project, go to:  
   `src/lib/papers/roadmapConfig.ts`  
   Open it in any text editor (e.g. Notepad, VS Code, Cursor).

2. **Be careful with:**
   - **Commas** – Every block of data (except the last one in a list) must end with a comma `,`.
   - **Spelling** – Names like `"Part A"`, `"Section 1"`, `"Mathematics"` must match **exactly** (same capitals and spaces).
   - **Quotes** – All text must be in double quotes `"like this"`.

3. **Save the file** when you’re done. If the app won’t build or the roadmap looks wrong, check for a missing comma or a typo.

---

## Task 1: Add a new year for an existing exam (e.g. NSAA 2024)

You’re adding a **new block** that looks like the ones already in the file. Find a similar year (e.g. NSAA 2023) and copy that whole block, then change the year and id.

**Step 1:** Find the exam and the year closest to the one you want.  
Example: you want **NSAA 2024**. Find the block for **NSAA 2023** (search for `'nsaa-2023'` or `year: 2023`).

**Step 2:** Copy the **entire** block for that year. It starts with `{` and ends with `},` (including the comma). For example, the NSAA 2023 block looks like:

```ts
  {
    id: 'nsaa-2023',
    year: 2023,
    examName: 'NSAA',
    label: 'Core Practice',
    parts: [
      {
        partLetter: 'Part A',
        partName: 'Mathematics',
        paperName: 'Section 1',
        examType: 'Official',
      },
      // ... more parts ...
    ],
  },
```

**Step 3:** Paste the copy **right after** the block you copied from (e.g. after the closing `},` of NSAA 2023).

**Step 4:** In the **pasted** block only, change:
- `id: 'nsaa-2023'` → `id: 'nsaa-2024'`
- `year: 2023` → `year: 2024`

**Step 5:** Leave **examName**, **label**, and **parts** the same **unless** the new year has a different structure (e.g. different sections). If the new year has the same sections as 2023, you’re done. Save the file.

---

## Task 2: Add a new year for ENGAA

Same idea as NSAA. Find an ENGAA year that has the same structure (e.g. ENGAA 2023), copy that whole block, paste it, then change only the **id** and **year** in the pasted block.

- `id: 'engaa-2023'` → `id: 'engaa-2024'`
- `year: 2023` → `year: 2024`

Save the file.

---

## Task 3: Change which questions appear (ENGAA Section 1 Part B only)

For some ENGAA years, the app uses a **list of question numbers** for “Section 1 Part B” instead of showing all questions. That list is at the **top** of the file, in something called **ENGAA_SECTION1_PARTB_FILTERS**.

It looks like:

```ts
const ENGAA_SECTION1_PARTB_FILTERS: Record<number, number[]> = {
  2016: [29, 30, 36, 42, 43, 44, 49, 51, 52],
  2017: [32, 35, 36, 37, 41, 50, 51, 54],
  2018: [35, 38, 39, 42, 44, 45, 50, 51, 52],
  2019: [25, 38, 39],
  // 2020-2023: All questions (no filter)
};
```

- **To add or change a year:**  
  Add a new line (or edit the line) for that year, with the question numbers in square brackets, separated by commas.  
  Example for 2020:  
  `2020: [1, 5, 10, 15, 20],`

- **To use all questions for a year:**  
  Don’t add that year to this list (or remove it). Then the app will show all questions for Section 1 Part B for that year.

Save the file.

---

## Task 4: Change the label (e.g. “Core Practice” vs “Advanced Practice”)

Each stage has a **label**. You’ll see lines like:

- `label: 'Core Practice',`
- `label: 'Advanced Practice',`

To change the label for a year, find that year’s block and change the text inside the quotes. For example:

- `label: 'Core Practice',` → `label: 'Advanced Practice',`

Save the file.

---

## Quick reference: what each field means

| Field         | Meaning |
|--------------|---------|
| **id**       | Unique short name, e.g. `'nsaa-2024'`. Use lowercase, exam + hyphen + year. |
| **year**     | The exam year (number, no quotes): `2024`. |
| **examName** | One of: `'NSAA'`, `'ENGAA'`, `'TMUA'`. |
| **label**    | Usually `'Core Practice'` or `'Advanced Practice'`. |
| **parts**    | List of sections/parts (Part A, Part B, Section 1, Section 2, etc.). |
| **partLetter** | e.g. `'Part A'`, `'Part B'`, `'Paper 1'`. |
| **partName** | e.g. `'Mathematics'`, `'Physics'`, `'Paper 1'`. |
| **paperName**| `'Section 1'`, `'Section 2'`, or for TMUA `'Paper 1'` / `'Paper 2'`. |
| **examType** | Almost always `'Official'`. |

---

## TMUA (Paper 1 / Paper 2)

**TMUA papers are not added in this file.** They are loaded from the database. If a TMUA paper exists in the database for a year, it will show on the roadmap automatically. You only edit `roadmapConfig.ts` for **NSAA** and **ENGAA** (and for ENGAA question filters).

---

## If something goes wrong

- **App won’t build / shows errors:**  
  Check for a **missing comma** after a `}` or `]`, or a **typo** in a name (e.g. `Part A` vs `part A`).

- **Roadmap looks wrong or a year is missing:**  
  Make sure you didn’t delete a comma, and that the **id** is unique (e.g. only one `'nsaa-2024'`).

- **Not sure about the exact part names:**  
  Look at an existing year for the same exam and copy the same **partLetter**, **partName**, and **paperName** from there.

---

## Summary

1. Open `src/lib/papers/roadmapConfig.ts`.
2. To **add a year**: copy an existing block for that exam, paste it, then change **id** and **year** (and parts only if the structure is different).
3. To **change ENGAA Part B questions**: edit **ENGAA_SECTION1_PARTB_FILTERS** at the top.
4. Use exact spelling and commas; save the file when done.

If you need a new exam type or a completely different structure, ask a developer to add the first block; then you can copy it for future years using this guide.
