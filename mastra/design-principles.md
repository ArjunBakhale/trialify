# Mastra Clinical Trial Navigator – Design Principles

_Last updated: 2025-09-26_

## Project Intent

Deliver an enterprise-grade clinical trial matching showcase on top of Mastra that emphasizes orchestration, multi-API intelligence, and clinician safety. The system must present a vertical slice that feels production-ready, favouring depth and polish over breadth.

## Guiding Tenets

1. **Patient-Centric Accuracy**
   - Maintain fidelity from raw patient input through structured profiles and eligibility decisions.
   - Preserve traceability of every transformation and decision, with justifications accessible to clinicians.

2. **Agent Separation of Concerns**
   - Each agent owns a distinct step in the pipeline: EMR parsing, trial scouting, eligibility screening, and summarization.
   - Inputs and outputs follow explicit schemas to guarantee deterministic hand-offs.

3. **Evidence-Driven Recommendations**
   - Combine ClinicalTrials.gov search results with PubMed literature support for every trial suggestion.
   - Leverage RAG over curated eligibility knowledge to ground semantic matching and reasoning.

4. **Human-in-the-Loop Assurance**
   - Suspend workflow execution before final reporting to enable clinician review and overrides.
   - Surface rationale, match scores, and safety flags in the physician checkpoint payload.

5. **Operational Observability**
   - Instrument real-time workflow monitoring via Mastra `.watch()` hooks.
   - Emit meaningful telemetry for each agent activation and tool call to support debugging and demo storytelling.

6. **Performance Discipline**
   - Target sub-10 second end-to-end execution by caching expensive lookups where possible and minimizing sequential latency.
   - Provide mock pathways to enable offline demos when external APIs are unavailable.

7. **Compliance and Extensibility**
   - Store sensitive data securely, avoiding unnecessary persistence.
   - Structure tools and schemas to simplify future integrations (e.g., OpenFDA, additional knowledge bases).

## RAG Infrastructure Choice

For the demo build, run the eligibility retrieval augmented generation flow on Mastra's in-memory memory adapter. This keeps setup friction low while still demonstrating vector-style semantic search against seeded eligibility criteria. Document any future migration steps (for example, moving to Supabase pgvector) in the technical backlog once external persistence is required.

## Project Structure

```
trialify/
├── mastra/
│   ├── index.ts              # Main Mastra configuration
│   ├── design-principles.md  # This document (moved here)
│   ├── agents/
│   │   ├── emrAnalysisAgent.ts
│   │   ├── trialScoutAgent.ts
│   │   ├── eligibilityScreenerAgent.ts
│   │   └── summarizationAgent.ts
│   ├── tools/
│   │   ├── clinicalTrialsApi.ts
│   │   ├── pubmedApi.ts
│   │   ├── icd10Api.ts
│   │   └── openFdaApi.ts
│   └── workflows/
│       └── clinicalTrialWorkflow.ts
├── pages/api/
│   └── find-trials.ts       # Next.js API route
├── pages/
│   └── index.tsx            # Frontend
└── app/                     # Existing Next.js app structure
    ├── page.tsx
    ├── layout.tsx
    └── ...
```

## Implementation Phasing Reference

1. **Phase 1** – Build the four-agent workflow using mock data and deterministic fixtures.
2. **Phase 2** – Integrate ClinicalTrials.gov and PubMed API tooling with robust error handling.
3. **Phase 3** – Stand up the eligibility RAG pipeline and vector interactions.
4. **Phase 4** – Add human review suspension and live workflow monitoring.
5. **Phase 5** – Polish with ICD-10 lookup, OpenFDA drug interaction checks, and additional validations.

## Agent Contracts (High-Level)

| Agent | Purpose | Key Inputs | Key Outputs | Required Tools |
| --- | --- | --- | --- | --- |
| `EMR_Analysis_Agent` | Parse unstructured patient data into structured medical profile | Patient free text or Synthea EMR blob | `{ diagnosis, age, medications, labValues }` | `icd10LookupTool`, `patientParserTool` |
| `Trial_Scout_Agent` | Retrieve candidate clinical trials and supportive evidence | Structured patient profile | Array of trial metadata with literature highlights | `clinicalTrialsApiTool`, `pubmedSearchTool` |
| `Eligibility_Screener_Agent` | Match patient against inclusion/exclusion criteria | Patient profile + candidate trials | Eligibility assessment, match scores, reasoning | `vectorQueryTool`, `drugInteractionTool` |
| `Summarization_Agent` | Produce clinician-facing report with schemas | Aggregated agent outputs | `ClinicalReportSchema` compliant report | `reportGeneratorTool` (with `.suspend()` support) |

## Structured Output Schema Reference

Use the following Zod schema to validate final reports:

```typescript
const ClinicalReportSchema = z.object({
  patient_summary: z.string(),
  eligible_trials: z.array(z.object({
    nct_id: z.string(),
    title: z.string(),
    match_score: z.number(),
    eligibility_reasoning: z.string(),
  })),
  ineligible_trials: z.array(z.object({
    nct_id: z.string(),
    title: z.string(),
    exclusion_reason: z.string(),
  })),
  recommendations: z.string(),
  literature_support: z.array(z.string()),
});
```

## Full Instruction Reference (verbatim)

> Build a sophisticated multi-agent system using the Mastra framework for matching patients to clinical trials. This system showcases advanced Mastra capabilities including multi-agent orchestration, RAG integration, human-in-the-loop workflows, and multi-API tool integration.
>
> ## Core Architecture Requirements
>
> ### 1. Multi-Agent Workflow Design
> Create a **4-agent sequential workflow** with the following architecture:
>
> ```
> Patient Input → EMR_Analysis_Agent → Trial_Scout_Agent → Eligibility_Screener_Agent → Summarization_Agent → Clinical Report
> ```
>
> ### 2. Agent Specifications
>
> #### **EMR_Analysis_Agent**
> - **Purpose**: Parse unstructured patient data into structured medical profile
> - **Input**: Raw patient text/Synthea EMR data
> - **Output**: Structured object `{diagnosis: string, age: number, medications: string[], labValues: object}`
> - **Tools Required**: 
>   - `icd10LookupTool` (NLM ICD-10-CM API)
>   - `patientParserTool` (custom parsing logic)
>
> #### **Trial_Scout_Agent** 
> - **Purpose**: Search and retrieve relevant clinical trials
> - **Input**: Structured patient profile from EMR_Analysis_Agent
> - **Output**: Array of potential trials with metadata
> - **Tools Required**:
>   - `clinicalTrialsApiTool` (ClinicalTrials.gov API v2)
>   - `pubmedSearchTool` (NCBI E-utilities API)
> - **Multi-API Logic**: Cross-reference trial data with supporting literature
>
> #### **Eligibility_Screener_Agent**
> - **Purpose**: Perform semantic matching against trial eligibility criteria
> - **Input**: Patient profile + trial list
> - **Output**: Eligibility assessment with reasoning
> - **Tools Required**:
>   - `vectorQueryTool` (RAG-powered eligibility matching)
>   - `drugInteractionTool` (OpenFDA API)
> - **RAG Integration**: Query vector store of trial inclusion/exclusion criteria
>
> #### **Summarization_Agent**
> - **Purpose**: Generate structured clinical report
> - **Input**: All previous agent outputs
> - **Output**: Structured report using Zod schemas
> - **Tools Required**:
>   - `reportGeneratorTool` (structured output formatting)
> - **Human-in-the-Loop**: Implement `.suspend()` for physician review
>
> ### 3. Technical Implementation Requirements
>
> #### **Multi-API Tool Integration**
> ```typescript
> // Implement these API wrappers as Mastra tools:
> const clinicalTrialsApiTool = createTool({
>   name: "clinicalTrialsSearch",
>   description: "Search ClinicalTrials.gov for relevant trials",
>   inputSchema: z.object({
>     condition: z.string(),
>     age: z.number(),
>     location: z.string().optional()
>   }),
>   // API call to https://clinicaltrials.gov/api/v2/studies
> })
>
> const pubmedSearchTool = createTool({
>   name: "pubmedLiteratureSearch", 
>   description: "Find supporting literature for clinical trials",
>   inputSchema: z.object({
>     query: z.string(),
>     max_results: z.number().default(5)
>   }),
>   // API call to https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
> })
>
> const icd10LookupTool = createTool({
>   name: "icd10DiagnosisLookup",
>   description: "Convert diagnosis text to ICD-10 codes",
>   inputSchema: z.object({
>     diagnosis_text: z.string()
>   }),
>   // API call to https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/
> })
> ```
>
> #### **RAG Pipeline Setup**
> ```typescript
> // Vector store for eligibility criteria
> const eligibilityKnowledgeBase = [
>   {
>     trial_id: "NCT12345",
>     condition: "Type 2 Diabetes",
>     inclusion_criteria: "Adults 18-75 years with HbA1c 7.0-10.5%, on stable metformin dose",
>     exclusion_criteria: "Pregnancy, severe renal impairment (eGFR <30), active malignancy",
>     age_range: {min: 18, max: 75},
>     required_labs: ["HbA1c", "eGFR"]
>   },
>   // Add more trial criteria...
> ]
>
> // RAG implementation
> await agent.memory.upsert({
>   data: eligibilityKnowledgeBase,
>   index: "clinical_trial_eligibility"
> })
> ```
>
> #### **Workflow Orchestration**
> ```typescript
> const clinicalTrialWorkflow = workflow()
>   .step("analyzePatient", async ({ context }) => {
>     const analysis = await emrAnalysisAgent.run({
>       input: context.patientData
>     })
>     return { patientProfile: analysis }
>   })
>   .step("findTrials", async ({ context }) => {
>     const trials = await trialScoutAgent.run({
>       input: context.patientProfile
>     })
>     return { candidateTrials: trials }
>   })
>   .step("screenEligibility", async ({ context }) => {
>     const screening = await eligibilityScreenerAgent.run({
>       input: {
>         patient: context.patientProfile,
>         trials: context.candidateTrials
>       }
>     })
>     return { eligibilityResults: screening }
>   })
>   .step("generateReport", async ({ context }) => {
>     // Human-in-the-loop checkpoint
>     await workflow.suspend("physician_review", {
>       message: "Please review eligibility results before final report generation",
>       data: context.eligibilityResults
>     })
>     
>     const report = await summarizationAgent.run({
>       input: context
>     })
>     return { finalReport: report }
>   })
> ```
>
> ### 4. Advanced Mastra Features to Showcase
>
> #### **Human-in-the-Loop Safety**
> - Implement `.suspend()` before final report generation
> - Allow physician override of eligibility decisions
> - Provide clear justification for all recommendations
>
> #### **Real-time Workflow Monitoring**
> - Use `.watch()` to stream execution progress
> - Display agent activation status in UI
> - Show intermediate results as they're generated
>
> #### **Structured Output Validation**
> ```typescript
> const ClinicalReportSchema = z.object({
>   patient_summary: z.string(),
>   eligible_trials: z.array(z.object({
>     nct_id: z.string(),
>     title: z.string(),
>     match_score: z.number(),
>     eligibility_reasoning: z.string()
>   })),
>   ineligible_trials: z.array(z.object({
>     nct_id: z.string(),
>     title: z.string(),
>     exclusion_reason: z.string()
>   })),
>   recommendations: z.string(),
>   literature_support: z.array(z.string())
> })
> ```
>
> ## Implementation Priority
> 1. **Phase 1**: Build basic 4-agent workflow with mock data
> 2. **Phase 2**: Integrate ClinicalTrials.gov and PubMed APIs
> 3. **Phase 3**: Implement RAG pipeline for eligibility screening
> 4. **Phase 4**: Add human-in-the-loop and workflow monitoring
> 5. **Phase 5**: Polish with additional APIs (ICD-10, OpenFDA)
>
> ## Success Criteria
> - **Multi-agent orchestration** with clear separation of concerns
> - **Multi-API integration** demonstrating 3+ external data sources
> - **RAG-powered semantic matching** for eligibility screening
> - **Human-in-the-loop workflow** with physician review checkpoints
> - **Real-time monitoring** of agent execution
> - **Structured outputs** with proper validation schemas
> - **Sub-10 second execution** for end-to-end patient matching
>
> Build this system to showcase Mastra's enterprise-grade capabilities while solving a real clinical workflow problem. Focus on the "vertical slice" approach - make one complete workflow exceptional rather than building broad, shallow functionality.
>
> before you begin building anything, clear what you're doing with me. this is a sensitive environment
