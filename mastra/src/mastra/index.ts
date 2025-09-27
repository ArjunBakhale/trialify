
import { Mastra } from '@mastra/core/mastra';
import { PinoLogger } from '@mastra/loggers';
import { LibSQLStore } from '@mastra/libsql';
import { clinicalTrialWorkflow } from './workflows/clinical-trial-workflow';
import { emrAgent } from './agents/emr-agent';
import { summarizationAgent } from './agents/summarization-agent';
import { trialScoutAgent } from './agents/trial-scout-agent';
import { eligibilityScreenerAgent } from './agents/eligibility-screener-agent';

export const mastra = new Mastra({
  workflows: { clinicalTrialWorkflow },
  agents: { emrAgent, summarizationAgent, trialScoutAgent, eligibilityScreenerAgent },
  storage: new LibSQLStore({
    // stores telemetry, evals, ... into memory storage, if it needs to persist, change to file:../mastra.db
    url: ":memory:",
  }),
  logger: new PinoLogger({
    name: 'Mastra',
    level: 'info',
  }),
});
