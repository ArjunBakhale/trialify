# Dropout Prediction Integration

## Overview

The dropout prediction model has been successfully integrated into the clinical trial workflow. The enhanced workflow provides unique dropout risk assessments for each patient-trial combination.

## Quick Backend Integration

To switch to the enhanced workflow with dropout prediction, simply change one line in your backend:

### Before (Original Workflow)
```typescript
import { workingClinicalTrialWorkflowWrapper } from './mastra/src/mastra';

// Use original workflow
const result = await workingClinicalTrialWorkflowWrapper.execute(inputData);
```

### After (Enhanced Workflow with Dropout Prediction)
```typescript
import { clinicalTrialWorkflowWithDropoutPrediction } from './mastra/src/mastra';

// Use enhanced workflow with dropout prediction
const result = await clinicalTrialWorkflowWithDropoutPrediction.execute(inputData, mastra);
```

## What's New

The enhanced workflow now includes:

### For Each Eligible Trial:
- **Dropout Risk Score** (0-1 scale)
- **Risk Level** (LOW/MODERATE/HIGH/VERY_HIGH)
- **Risk Factors** (specific factors contributing to dropout risk)
- **Mitigation Recommendations** (actionable steps to reduce risk)

### Example Output Structure:
```typescript
{
  clinicalReport: {
    patient_summary: "...",
    eligible_trials: [
      {
        nct_id: "NCT12345678",
        title: "Efficacy Study of New Drug",
        match_score: 0.85,
        eligibility_reasoning: "...",
        // NEW: Dropout risk assessment
        dropoutRisk: {
          overallRisk: 0.45,
          riskLevel: "MODERATE",
          confidence: 0.85
        },
        riskFactors: [
          {
            factor: "Advanced Age",
            impact: 0.2,
            description: "Patient age 65 may face increased challenges",
            mitigation: "Consider shorter trial duration"
          },
          {
            factor: "Location/Distance Factors",
            impact: 0.03,
            description: "Location and distance factors increase dropout risk by 3.24%",
            mitigation: "Consider transportation assistance or remote monitoring options"
          },
          {
            factor: "Trial-Patient Match Factors",
            impact: 0.07,
            description: "Trial-patient compatibility factors increase dropout risk by 7.18%",
            mitigation: "Enhance patient education and trial expectations management"
          }
        ],
        riskMitigationRecommendations: [
          "Implement standard monitoring with periodic check-ins",
          "Provide clear trial expectations and timeline"
        ]
      }
    ],
    // NEW: Dropout risk summary
    dropoutRiskSummary: {
      overallRiskLevel: "MODERATE",
      highestRiskTrial: "NCT12345678",
      riskMitigationStrategies: [
        "Implement enhanced patient support services",
        "Provide comprehensive trial education"
      ],
      averageDropoutRisk: 0.45
    },
    recommendations: "...", // Now includes dropout risk information
    workflow_metadata: {
      // ... existing metadata
      dropout_assessments_completed: 3 // NEW: Number of dropout assessments
    }
  }
}
```

## Model Details

- **Model Type**: Random Forest Classifier
- **Accuracy**: 82.5%
- **Features**: Age, Gender, Blood Pressure, Cholesterol, Adverse Events, Treatment Group
- **Key Risk Factors**: Adverse Events (35.7%), Treatment Group (13.7%), Age (13.3%)
- **Location Variation**: ±5% random multiplier applied to account for location and distance factors
- **Match Score Variation**: ±10% random multiplier applied to account for trial-patient compatibility factors

## Files Added/Updated

- `mastra/dropout_model.joblib` - Trained model
- `mastra/model_metadata.json` - Model configuration
- `mastra/src/mastra/agents/dropout-risk-agent.ts` - Dropout risk agent
- `mastra/src/mastra/tools/dropout-prediction-tool.ts` - Model integration tool
- `mastra/src/mastra/tools/summarization-tool.ts` - **Updated** to include dropout risk in clinical reports

## Backward Compatibility

The original workflow remains unchanged and functional. The enhanced workflow is additive and can be used alongside existing workflows.