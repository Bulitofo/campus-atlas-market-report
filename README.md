# Campus Atlas · College-town housing markets

[Open the interactive market report](https://bulitofo.github.io/campus-atlas-market-report/).

Explore 35,442 historical sales around eleven university campuses. The report compares all eighteen cities, records which rankings change after applying a price boundary, and shows how buyers can explore bedroom counts, budgets, market time and distance to campus. Each question includes a chart and a written result.

The explorer links its campus map, controls, city table and key figures. Open the same URL to restore a selection. Question-specific controls change Q7–Q10, while Q1–Q6 always describe their specified full populations. Mobile and dark layouts are included.

## Reproduce the numbers

The static website reads the original CSV. No build or server-side database is required. To verify independently with Node and Python 3, run `python3 scripts/verify.py`. It compares results with the original SQLite database, including prices exactly at a boundary, missing dates, empty results and budgets above the price cap.

The data come from the University of Illinois–Deloitte Foundation Center for Business Emerging Technologies, [College-town home sales, version 1.0](https://github.com/uidfc-business-emerging-technologies/campustown-home-sales-starter/blob/main/docs/data_description_sheet.md). The contiguous US basemap comes from Natural Earth via [world.geo.json](https://github.com/johan/world.geo.json). Campus locations are computed from the sales.

Built with OpenAI ChatGPT Codex Desktop (local), JavaScript, CSS and HTML. GitHub Pages publishes the report. The history documents the analytical implementation and subsequent rounds of design and validation.
