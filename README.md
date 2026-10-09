# MD Discover Assessment

Power Apps Code App for opportunity qualification and customer discovery during the Discover phase of DEEPR. The workspace supports account discovery, stakeholder and ICP qualification, win strategy, risk review, and a structured pursuit recommendation.

## Current implementation

- React 19, TypeScript, Vite, Fluent UI v9, and Recharts.
- Dashboard with recommendation counts, industry outcomes, qualification scores, and high-risk distribution.
- Searchable and filterable assessment list with sorting.
- Eight-step assessment wizard with automatic draft persistence.
- Deterministic scoring and rules-based strengths, risks, gaps, and next actions.
- Assessment detail view, completion history, browser print-to-PDF, and Word export.
- Generated Dataverse CRUD services for the published `cr1b4_*` tables.
- Snapshot-backed assessment repository with revision grouping and demo fallback.
- Import CSVs aligned to the currently published table columns in `dataverse/import/`.

The current assessment repository persists the complete assessment as JSON in `cr1b4_assessmentsnapshotjson`, while writing searchable name, score, version, and recommendation summary fields through the generated Dataverse service. This preserves all wizard fields that are not separate columns in the published table. Generated insights are rules-based, not AI-generated; the service boundary can host future Copilot or AI implementations.

## Run locally

Requires Node.js 22 or later.

```powershell
npm install
npm run lint
npm test
npm run build
```

To test the UI without a Power Apps browser session or Dataverse connection, run `npm run dev` and open `http://localhost:5173/?dataMode=local`. This explicit local-demo mode stores drafts in browser local storage; the default mode uses the generated Dataverse service and requires the Power Apps host context.

Use the Power Apps Code App local runner from the already-connected environment to test Dataverse-backed runtime behavior. Plain Vite preview does not provide the Power Apps connector host context.

## Assessment scoring

Ten positive qualification signals contribute 10 points each: strategic customer, enterprise scale, multiple initiatives, long-term partnership, Microsoft alignment, confirmed budget, confirmed business need, executive support, identified executive sponsor, and identified decision maker. Medium risk deducts 5 points and high risk deducts 10 points for each of delivery, commercial, and relationship risk. Win probability above 75% adds 10 points. The result is bounded to 0-100. Recommendations are Pursue at 80+, Pursue With Risks at 60-79, and Do Not Pursue below 60.

Unassessed risks currently have no score deduction and are called out for discovery. Treat that as an unknown, not as a low-risk rating.

## Dataverse and ALM

The published solution uses the environment publisher prefix `cr1b4` and currently exposes these tables:

- `cr1b4_contact`: contact name, email, and job title.
- `cr1b4_opportunityassessment`: versioned assessment snapshot rows.
- `cr1b4_opportunityassessmentnote`: structured assessment notes.
- `cr1b4_opportunitystakeholder`: stakeholder role and engagement details.

The current published schema differs from the proposed normalized `md_*` design in `dataverse/schema/md_opportunityassessment.json`: version history is stored in rows of `cr1b4_opportunityassessment`, and the generated note/stakeholder models expose assessment/contact association fields as text rather than Dataverse lookups. These are not enforced relational links. The assessment summary choice currently supports only `Pursue` and `Do Not Pursue`; `Pursue With Risks` is kept in the full JSON snapshot and is not written as a lossy choice value.

The generated models and services are under `src/generated/`; do not edit these generated files. The app currently reads/writes the assessment snapshot table. Note and stakeholder services are registered, but the UI has not yet been migrated to create/update those child rows. For simple free-form notes or attachments, consider native Dataverse Notes (`annotation`).

To add or refresh the published tables in the already-initialized Code App solution:

```powershell
pa app add data-source --connector dataverse --table cr1b4_opportunityassessment
pa app add data-source --connector dataverse --table cr1b4_opportunityassessmentnote
pa app add data-source --connector dataverse --table cr1b4_opportunitystakeholder
pa app add data-source --connector dataverse --table cr1b4_contact
```

The CSVs are sample imports, not table definitions. Import Contact rows before stakeholder rows if using the name fields for matching. Keep the `cr1b4_*` logical names from the published environment; the earlier `md_*` names describe the proposed schema only. Validate with `npm run lint`, `npm test`, and `npm run build` before deployment.

Increment the package version for each deployment; the same version is shown in the application header.

## Project structure

```text
src/
  data/                 Assessment repository backed by generated Dataverse service
  domain/               Assessment model, scoring, and insights rules
  state/                Assessment context and autosave lifecycle
  App.tsx               Dashboard, list, wizard, details, and exports
  App.css               Responsive workspace styles
dataverse/schema/       Dataverse schema contract
```
