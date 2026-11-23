# Start here

**LineageSutra AI answers one question before you change a table: what breaks, and where is the proof?**

It reads your SQL files, draws the column-level map of how data flows, and tells you which views, tables and columns a change would hit. It runs on your laptop or in CI. It never touches your database.

![How LineageSutra AI turns SQL into evidence](assets/pipeline.svg)

## Who is it for

| You are | You get |
|---|---|
| Analytics engineer | A checklist of every model to update before you rename a column |
| Data platform owner | A CI gate that blocks pull requests which break consumers |
| Data steward | A map of where sensitive-looking columns flow |
| New team member | A trace from any dashboard column back to its source |
| Someone using an AI coding agent | Read-only lineage tools the agent cannot misuse |

## Five minutes, three commands

Needs Node.js 20 or newer. Nothing else.

```bash
npx lineagesutra-ai scan --root ./sql --out lineage.html
npx lineagesutra-ai scan --root ./sql --out lineage.json
npx lineagesutra-ai impact --input lineage.json --table customers --column email --change rename --out impact.html
```

Open `lineage.html` and `impact.html` in a browser. Each page is a single self-contained file you can attach to a pull request.

## What you will see

![Column-level lineage of the bundled sample](assets/lineage-graph.svg)

Each box is a table or view. Each line is a column feeding another column. Now ask what renaming `customers.email` would break:

![Blast radius of renaming customers.email](assets/blast-radius.svg)

Red lines are **confirmed**: the SQL text proves the column flows there. Three columns in three views need an update, one of them two hops away.

## The one rule that makes it trustworthy

LineageSutra AI separates what it **proved** from what it only **suspects**, and lists what it **could not read**. It never turns a guess into a confident answer.

| Label | Meaning | What you do |
|---|---|---|
| Confirmed | A parsed column path exists | Review and update every one |
| Possible | Used in a filter, join or group, or only a table link exists | Ask the owning team |
| Warning | The parser could not read it | Add missing DDL or review by hand |

## Where to go next

- Want to see it in action? Read **Real-world scenarios**.
- Want to understand it? Read **How it works, visually**.
- Want it in CI? Read **CI recipes**.
- Want one page to keep open? Read the **Cheat sheet**.
