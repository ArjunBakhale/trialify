#!/usr/bin/env npx tsx

import { mastra } from './src/mastra/index';
import { WorkflowExecutor } from './src/mastra/workflows/workflow-executor';

async function testWorkflowExecutor() {
  console.log('🚀 Testing Workflow Executor');
  console.log('================================================================================\n');

  const patientInput = "65-year-old male presenting with poorly controlled Type 2 Diabetes Mellitus. Current HbA1c is 9.2%. Patient has been on metformin 1000mg twice daily for 3 years. BMI is 32. Recent labs show eGFR of 65 mL/min/1.73m². Patient also has hypertension controlled with lisinopril 10mg daily. No history of diabetic ketoacidosis or severe hypoglycemic episodes. Lives in Atlanta, Georgia. Interested in exploring new treatment options.";

  try {
    console.log('📋 Patient Input:');
    console.log(patientInput);
    console.log('\n🔄 Running workflow with custom executor...\n');

    const workflow = mastra.getWorkflow('clinicalTrialWorkflow');
    
    // Use the custom executor
    const result = await WorkflowExecutor.executeWorkflow(workflow, {
      patientData: patientInput
    });

    console.log('✅ Workflow executed successfully!');
    console.log('\n📊 Results Summary:');
    console.log('================================================================================');
    
    if (result.clinicalReport?.eligible_trials?.length > 0) {
      console.log(`🎯 Found ${result.clinicalReport.eligible_trials.length} eligible trials`);
      
      result.clinicalReport.eligible_trials.slice(0, 5).forEach((trial, index) => {
        console.log(`\n${index + 1}. ${trial.nct_id}: ${trial.title}`);
        console.log(`   Match Score: ${trial.match_score?.toFixed(3) || 'N/A'}`);
        console.log(`   Eligibility Reasoning: ${trial.eligibility_reasoning?.substring(0, 100)}...`);
        console.log(`   Next Steps: ${trial.next_steps?.join(', ') || 'Contact coordinator'}`);
      });
    } else {
      console.log('❌ No eligible trials found');
    }

    console.log('\n📄 Clinical Report Summary:');
    console.log(`   Patient Summary: ${result.clinicalReport?.patient_summary?.substring(0, 200)}...`);
    console.log(`   Eligible Trials: ${result.clinicalReport?.eligible_trials?.length || 0}`);
    console.log(`   Recommendations: ${result.clinicalReport?.recommendations?.substring(0, 200)}...`);

    console.log('\n🎉 Workflow executor test completed successfully!');

  } catch (error) {
    console.error('❌ Workflow executor test failed:', error);
    
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Stack trace:', error.stack);
    }
  }
}

testWorkflowExecutor().catch(console.error);