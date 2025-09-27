#!/usr/bin/env tsx

import { createWorkflow } from '@mastra/core/workflows';
import { clinicalTrialWorkflow } from './src/mastra/workflows/clinical-trial-workflow';

async function testPatientCase() {
  console.log('🏥 Processing Patient Case: 65-year-old male with Type 2 Diabetes');
  console.log('=' .repeat(80));
  
  const patientData = `65-year-old male presenting with poorly controlled Type 2 Diabetes Mellitus. Current HbA1c is 9.2%. Patient has been on metformin 1000mg twice daily for 3 years. BMI is 32. Recent labs show eGFR of 65 mL/min/1.73m². Patient also has hypertension controlled with lisinopril 10mg daily. No history of diabetic ketoacidosis or severe hypoglycemic episodes. Lives in Atlanta, Georgia. Interested in exploring new treatment options.`;

  try {
    console.log('\n📋 Patient Data:');
    console.log(patientData);
    
    console.log('\n🔄 Running Clinical Trial Workflow...');
    const startTime = Date.now();
    
    const result = await clinicalTrialWorkflow.execute({
      patientData,
      demographics: {
        age: 65,
        location: 'Atlanta, Georgia'
      },
      searchPreferences: {
        maxTrials: 10,
        prioritizeRecruiting: true,
        includeBiomarkerTrials: false
      }
    });
    
    const executionTime = Date.now() - startTime;
    
    console.log(`\n⏱️ Total execution time: ${executionTime}ms`);
    console.log('\n📊 Results Summary:');
    console.log(`   Patient Profile: ${result.patientProfile.diagnosis} (Age: ${result.patientProfile.age})`);
    console.log(`   Trials Found: ${result.trialScoutResults.candidateTrials.length}`);
    console.log(`   Eligible Trials: ${result.eligibilityResults.eligibilityAssessments.filter(a => a.eligibilityStatus === 'ELIGIBLE').length}`);
    console.log(`   Potentially Eligible: ${result.eligibilityResults.eligibilityAssessments.filter(a => a.eligibilityStatus === 'POTENTIALLY_ELIGIBLE').length}`);
    
    console.log('\n🎯 Top Eligible Trials:');
    const eligibleTrials = result.eligibilityResults.eligibilityAssessments
      .filter(a => a.eligibilityStatus === 'ELIGIBLE')
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
    
    eligibleTrials.forEach((trial, index) => {
      console.log(`\n${index + 1}. ${trial.nctId}: ${trial.title}`);
      console.log(`   Match Score: ${(trial.matchScore * 100).toFixed(1)}%`);
      console.log(`   Age Eligibility: ${trial.ageEligibility.eligible ? '✅' : '❌'} - ${trial.ageEligibility.reason}`);
      console.log(`   Location: ${trial.locationEligibility.eligible ? '✅' : '❌'} - ${trial.locationEligibility.reason}`);
      console.log(`   Drug Interactions: ${trial.drugInteractions.length} found`);
      if (trial.drugInteractions.length > 0) {
        trial.drugInteractions.forEach(interaction => {
          console.log(`     - ${interaction.medication}: ${interaction.severity} severity`);
        });
      }
      console.log(`   Recommendations: ${trial.recommendations.join(', ')}`);
    });
    
    console.log('\n📄 Clinical Report Summary:');
    console.log(`   Total Trials Assessed: ${result.clinicalReport.summary.totalTrialsAssessed}`);
    console.log(`   Eligible Trials: ${result.clinicalReport.summary.eligibleTrials}`);
    console.log(`   Safety Flags: ${result.clinicalReport.safetyFlags.length}`);
    if (result.clinicalReport.safetyFlags.length > 0) {
      console.log(`   Safety Concerns: ${result.clinicalReport.safetyFlags.join(', ')}`);
    }
    
    console.log('\n💡 Key Recommendations:');
    result.clinicalReport.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
    
  } catch (error) {
    console.error('❌ Error processing patient case:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
  }
}

testPatientCase();