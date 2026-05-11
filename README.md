# The 100-App Challenge

## A Brief Discursion on Maximum Productivity

This repo is configured for maximum productivity. We're **agentmaxxing**. We're **skillmaxxing**. We have superpowers — literally, the `using-superpowers` skill is right there in [.agents/skills/](.agents/skills/), and so are 30+ others, from `designing-game-mechanics` to `game-feel-and-juice` to `collision-and-2d-physics`. Our agents have agents. Our skills have skills. Our subagents dispatch parallel subagents that dispatch parallel subagents.

Our stack is better than your stack. Vite. React. TypeScript. Cloudflare Pages. D1. Token-optimized CLI proxying via RTK saves us 60–90% on dev ops, which means we can afford to think 60–90% harder. We don't write code; we orchestrate fleets of specialized agents that write code while we read the diffs at 4x speed.

We're not 10x engineers. We're 100x engineers — one for each app. We ship straight to production because even our tests have tests, and those tests have skills, and those skills have hooks that trigger more tests. Bugs file themselves. Features ship themselves. The CI pipeline is so confident it merges its own PRs and then writes a postmortem about how good the merge was.

You think you're going to build one game today. We're going to build one hundred. In one hundred minutes. Each with its own distinct visual style. Each with collision detection, game feel, audio, juice, onboarding, and procedural content. And then we're going to playtest them. Solo. Honestly.

Anyway, here's the README.

---

This is the template repository for the 100-app challenge, also known as 100 Apps in 100 Minutes.

Fork this repository and use it as a scaffold to build and display your 100 apps.

The repository currently uses super-standard tooling, vite + React + TypeScript.

To run the dev server and view the website, simply run `yarn dev`.

## Example Prompts

Planning:
```
Create 100 novel game ideas. Make the game ideas as original as possible. Each game should be simple but be a real, fun game, not a toy. Write the ideas to a file with a paragrph of conceptual detail about how the game should be implemented (don't worry about technical details like specifying frameworks for now). It is okay for the games to require a backend (they will have access to SQLite), but stay away from complex backend topics like authentication. The games will be implemented as React components in a larger vite gallery application.

Write the ideas to a markdown file `IDEAS.md`.
```

Execution:
```
Review `IDEAS.md` and create a checklist file for each game and then start implementing. Keep track of each checklist and check items off the list as you complete them.

This repository contains a scaffold: a Cloudflare Pages website with optional functions for backend capability, and D1 for database (the binding is already set up, just create and run necessary migrations if needed). Replace the placeholder routes in the App file with the games. Each game should have its own distinct visual style (use the `frontend-design` skill in `.agents/skills`) and a distinct icon for the home gallery rather than the default gradient. Each should be placed in its own directory in `src/` with a top-level component included in the router in `src/App.tsx`. Use chrome mode or MCP and iterate until each game is beautiful and functional.

Do not modify the scaffold beyond inserting each game into the main gallery page.
```