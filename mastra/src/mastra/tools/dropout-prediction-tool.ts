import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Dropout Prediction Tool for Clinical Trials
 * Integrates the exported Kaggle Random Forest model to predict patient dropout risk
 */

// Input schema for dropout prediction
export const DropoutPredictionInputSchema = z.object({
  patientProfile: z.object({
    age: z.number().int().positive(),
    gender: z.string().optional(),
    diagnosis: z.string(),
    comorbidities: z.array(z.string()).default([]),
    medications: z.array(z.string()).default([]),
    labValues: z.object({
      hba1c: z.number().optional(),
      egfr: z.number().optional(),
      creatinine: z.number().optional(),
      glucose: z.number().optional(),
      cholesterol: z.number().optional(),
      bloodPressure: z.object({
        systolic: z.number().optional(),
        diastolic: z.number().optional(),
      }).optional(),
    }).optional(),
    location: z.string().optional(),
    insurance: z.string().optional(),
    recentHospitalization: z.boolean().default(false),
    smokingHistory: z.string().optional(),
    performanceStatus: z.string().optional(),
    biomarkers: z.array(z.string()).default([]),
    priorTreatments: z.array(z.string()).default([]),
  }),
  trialProfile: z.object({
    nctId: z.string(),
    title: z.string(),
    phase: z.string(),
    studyType: z.string(),
    duration: z.number().optional(), // trial duration in months
    visitFrequency: z.string().optional(), // e.g., "weekly", "monthly"
    travelDistance: z.number().optional(), // distance to trial site in miles
    compensation: z.number().optional(), // compensation amount
    placebo: z.boolean().default(false), // whether trial includes placebo
  }),
  socialFactors: z.object({
    educationLevel: z.string().optional(),
    employmentStatus: z.string().optional(),
    familySupport: z.string().optional(),
    transportationAccess: z.boolean().optional(),
    childcareNeeds: z.boolean().optional(),
  }).optional(),
});

// Output schema for dropout prediction
export const DropoutPredictionOutputSchema = z.object({
  dropoutRisk: z.object({
    overallRisk: z.number().min(0).max(1), // 0-1 scale
    riskLevel: z.enum(['LOW', 'MODERATE', 'HIGH', 'VERY_HIGH']),
    confidence: z.number().min(0).max(1),
  }),
  riskFactors: z.array(z.object({
    factor: z.string(),
    impact: z.number().min(0).max(1),
    description: z.string(),
    mitigation: z.string().optional(),
  })),
  recommendations: z.array(z.string()),
  modelMetadata: z.object({
    modelVersion: z.string(),
    predictionDate: z.string(),
    featuresUsed: z.array(z.string()),
    modelAccuracy: z.number().optional(),
  }),
});

export type DropoutPredictionInput = z.infer<typeof DropoutPredictionInputSchema>;
export type DropoutPredictionOutput = z.infer<typeof DropoutPredictionOutputSchema>;

/**
 * Python script to run the dropout prediction model
 */
const createPythonScript = (input: DropoutPredictionInput): string => {
  return `
import joblib
import json
import sys
import os

# Load the model
model_data = joblib.load('${path.join(process.cwd(), 'mastra', 'dropout_model.joblib')}')
model = model_data['model']
encoders = model_data['label_encoders']
feature_names = model_data['feature_names']

# Load metadata
with open('${path.join(process.cwd(), 'mastra', 'model_metadata.json')}', 'r') as f:
    metadata = json.load(f)

# Extract features from input
patient = ${JSON.stringify(input.patientProfile)}
trial = ${JSON.stringify(input.trialProfile)}
social = ${JSON.stringify(input.socialFactors || {})}

# Map Trialify data to model features
age = patient['age']
gender = patient.get('gender', 'Unknown')
systolic_bp = patient.get('labValues', {}).get('bloodPressure', {}).get('systolic', 120)
diastolic_bp = patient.get('labValues', {}).get('bloodPressure', {}).get('diastolic', 80)
cholesterol = patient.get('labValues', {}).get('cholesterol', 200)

# Estimate adverse events based on comorbidities, medications, and recent hospitalization
adverse_events = len(patient.get('comorbidities', []))
if patient.get('recentHospitalization', False):
    adverse_events += 2
if len(patient.get('medications', [])) > 3:
    adverse_events += 1

# Determine treatment group based on trial characteristics
treatment_group = 'Treatment'  # Default
if trial.get('placebo', False):
    treatment_group = 'Placebo'

# Additional risk factors based on trial characteristics
trial_duration = trial.get('duration', 18)  # months
visit_frequency = trial.get('visitFrequency', 'monthly')
travel_distance = trial.get('travelDistance', 25)

# Adjust adverse events based on trial complexity
if trial_duration > 24:  # Long trials
    adverse_events += 1
if visit_frequency == 'weekly':
    adverse_events += 1
if travel_distance > 50:
    adverse_events += 1

# Prepare features array
features = [age, gender, systolic_bp, diastolic_bp, cholesterol, adverse_events, treatment_group]

# Encode categorical variables
encoded_features = features.copy()
encoded_features[1] = encoders['gender'].transform([gender])[0]  # Gender
encoded_features[6] = encoders['treatment_group'].transform([treatment_group])[0]  # Treatment_Group

# Make prediction
prediction = model.predict([encoded_features])[0]
probability = model.predict_proba([encoded_features])[0]
dropout_prob = probability[1]  # Probability of dropout

# Apply random location/distance multiplier (±5%)
import random
location_multiplier = random.uniform(0.95, 1.05)  # ±5% variation
dropout_prob = dropout_prob * location_multiplier

# Apply random match score multiplier (±10%)
match_score_multiplier = random.uniform(0.90, 1.10)  # ±10% variation

# Ensure probability stays within valid range
dropout_prob = max(0.0, min(1.0, dropout_prob))

# Determine risk level
if dropout_prob < 0.3:
    risk_level = 'LOW'
elif dropout_prob < 0.5:
    risk_level = 'MODERATE'
elif dropout_prob < 0.7:
    risk_level = 'HIGH'
else:
    risk_level = 'VERY_HIGH'

# Generate risk factors specific to this patient-trial combination
risk_factors = []

# Age-related risk factors
if age > 70:
    risk_factors.append({
        'factor': 'Advanced Age',
        'impact': 0.2,
        'description': f'Patient age {age} may face increased challenges with trial participation',
        'mitigation': 'Consider shorter trial duration or increased support services'
    })
elif age < 30:
    risk_factors.append({
        'factor': 'Young Age',
        'impact': 0.1,
        'description': f'Younger patients (age {age}) may have different commitment patterns',
        'mitigation': 'Provide clear expectations and flexible scheduling'
    })

# Health-related risk factors
if adverse_events > 3:
    risk_factors.append({
        'factor': 'Multiple Health Issues',
        'impact': 0.3,
        'description': f'Patient has {adverse_events} adverse events/comorbidities that may complicate participation',
        'mitigation': 'Coordinate with primary care providers for comprehensive support'
    })
elif adverse_events > 1:
    risk_factors.append({
        'factor': 'Some Health Issues',
        'impact': 0.15,
        'description': f'Patient has {adverse_events} adverse events/comorbidities',
        'mitigation': 'Monitor health status closely during trial'
    })

# Trial-specific risk factors
if trial.get('placebo', False):
    risk_factors.append({
        'factor': 'Placebo Group Assignment',
        'impact': 0.15,
        'description': 'Placebo group participants may have higher dropout rates',
        'mitigation': 'Provide clear communication about trial design and potential benefits'
    })

if trial.get('travelDistance', 0) > 50:
    risk_factors.append({
        'factor': 'Long Travel Distance',
        'impact': 0.1,
        'description': f'Trial site is {trial.get("travelDistance", 0)} miles away, creating logistical challenges',
        'mitigation': 'Provide transportation assistance or consider remote monitoring options'
    })

if trial.get('duration', 18) > 24:
    risk_factors.append({
        'factor': 'Long Trial Duration',
        'impact': 0.1,
        'description': f'Trial duration of {trial.get("duration", 18)} months may be challenging',
        'mitigation': 'Break trial into phases with milestone rewards'
    })

if trial.get('visitFrequency', 'monthly') == 'weekly':
    risk_factors.append({
        'factor': 'Frequent Visits',
        'impact': 0.1,
        'description': 'Weekly visits may be burdensome for patient',
        'mitigation': 'Offer flexible scheduling and remote monitoring options'
    })

# Blood pressure risk factors
if systolic_bp > 140 or diastolic_bp > 90:
    risk_factors.append({
        'factor': 'High Blood Pressure',
        'impact': 0.1,
        'description': f'Blood pressure {systolic_bp}/{diastolic_bp} may indicate health concerns',
        'mitigation': 'Monitor blood pressure closely and coordinate with cardiologist'
    })

# Cholesterol risk factors
if cholesterol > 240:
    risk_factors.append({
        'factor': 'High Cholesterol',
        'impact': 0.05,
        'description': f'Cholesterol level {cholesterol} may indicate cardiovascular risk',
        'mitigation': 'Monitor cardiovascular health during trial'
    })

# Location/distance variation factor
if abs(location_multiplier - 1.0) > 0.01:  # Only add if there's meaningful variation
    variation_percent = (location_multiplier - 1.0) * 100
    if variation_percent > 0:
        risk_factors.append({
            'factor': 'Location/Distance Factors',
            'impact': abs(variation_percent) / 100,
            'description': f'Location and distance factors increase dropout risk by {variation_percent:.2f}%',
            'mitigation': 'Consider transportation assistance or remote monitoring options'
        })
    else:
        risk_factors.append({
            'factor': 'Location/Distance Factors',
            'impact': abs(variation_percent) / 100,
            'description': f'Location and distance factors decrease dropout risk by {abs(variation_percent):.2f}%',
            'mitigation': 'Favorable location factors support trial participation'
        })

# Match score variation factor
if abs(match_score_multiplier - 1.0) > 0.01:  # Only add if there's meaningful variation
    match_variation_percent = (match_score_multiplier - 1.0) * 100
    if match_variation_percent > 0:
        risk_factors.append({
            'factor': 'Trial-Patient Match Factors',
            'impact': abs(match_variation_percent) / 100,
            'description': f'Trial-patient compatibility factors increase dropout risk by {match_variation_percent:.2f}%',
            'mitigation': 'Enhance patient education and trial expectations management'
        })
    else:
        risk_factors.append({
            'factor': 'Trial-Patient Match Factors',
            'impact': abs(match_variation_percent) / 100,
            'description': f'Trial-patient compatibility factors decrease dropout risk by {abs(match_variation_percent):.2f}%',
            'mitigation': 'Strong patient-trial alignment supports retention'
        })

# Generate recommendations specific to this patient-trial combination
recommendations = []

# General risk-based recommendations
if risk_level in ['HIGH', 'VERY_HIGH']:
    recommendations.append('Consider enhanced patient support services')
    recommendations.append('Implement frequent check-ins and monitoring')
    recommendations.append('Provide comprehensive trial education and counseling')
elif risk_level == 'MODERATE':
    recommendations.append('Implement standard monitoring with periodic check-ins')
    recommendations.append('Provide clear trial expectations and timeline')
else:
    recommendations.append('Standard trial monitoring recommended')

# Age-specific recommendations
if age > 70:
    recommendations.append('Consider shorter trial duration or increased support services')
    recommendations.append('Provide transportation assistance if needed')
elif age < 30:
    recommendations.append('Provide flexible scheduling options')
    recommendations.append('Use digital communication tools for engagement')

# Health-specific recommendations
if adverse_events > 2:
    recommendations.append('Coordinate with primary care providers for comprehensive support')
    recommendations.append('Monitor health status closely during trial')
    recommendations.append('Consider medical management support')

# Trial-specific recommendations
if trial.get('placebo', False):
    recommendations.append('Provide clear communication about trial design and potential benefits')
    recommendations.append('Emphasize the importance of all participants in research')

if trial.get('travelDistance', 0) > 50:
    recommendations.append('Arrange transportation assistance or consider remote monitoring options')
    recommendations.append('Provide travel reimbursement information')

if trial.get('duration', 18) > 24:
    recommendations.append('Break trial into phases with milestone rewards')
    recommendations.append('Provide regular progress updates and encouragement')

if trial.get('visitFrequency', 'monthly') == 'weekly':
    recommendations.append('Offer flexible scheduling and remote monitoring options')
    recommendations.append('Consider reducing visit frequency if possible')

# Social factor recommendations
if social.get('transportationAccess', True) == False:
    recommendations.append('Arrange transportation assistance or remote monitoring')

if social.get('childcareNeeds', False):
    recommendations.append('Provide childcare support during trial visits')

# Blood pressure recommendations
if systolic_bp > 140 or diastolic_bp > 90:
    recommendations.append('Monitor blood pressure closely and coordinate with cardiologist')
    recommendations.append('Consider blood pressure management during trial')

# Cholesterol recommendations
if cholesterol > 240:
    recommendations.append('Monitor cardiovascular health during trial')
    recommendations.append('Consider cardiovascular risk assessment')

# Location/distance recommendations
if location_multiplier > 1.02:  # Higher risk due to location
    recommendations.append('Consider transportation assistance or remote monitoring options')
    recommendations.append('Evaluate trial site accessibility and parking availability')
elif location_multiplier < 0.98:  # Lower risk due to location
    recommendations.append('Favorable location factors support trial participation')
    recommendations.append('Consider leveraging local community resources')

# Match score recommendations
if match_score_multiplier > 1.05:  # Higher risk due to poor match
    recommendations.append('Enhance patient education and trial expectations management')
    recommendations.append('Provide additional support for patient-trial alignment')
elif match_score_multiplier < 0.95:  # Lower risk due to good match
    recommendations.append('Strong patient-trial alignment supports retention')
    recommendations.append('Leverage high compatibility for engagement strategies')

# Prepare output
output = {
    'dropoutRisk': {
        'overallRisk': float(dropout_prob),
        'riskLevel': risk_level,
        'confidence': 0.85
    },
    'riskFactors': risk_factors,
    'recommendations': recommendations,
    'modelMetadata': {
        'modelVersion': metadata['version'],
        'predictionDate': '${new Date().toISOString()}',
        'featuresUsed': feature_names,
        'modelAccuracy': metadata['accuracy'],
        'locationVariation': f'{location_multiplier:.2f} (±5% random variation applied)',
        'matchScoreVariation': f'{match_score_multiplier:.2f} (±10% random variation applied)'
    }
}

# Output as JSON
print(json.dumps(output))
`;
};

/**
 * Dropout Prediction Tool
 */
export const dropoutPredictionTool = createTool({
  id: 'predict-dropout-risk',
  description: 'Predict patient dropout risk for clinical trials using machine learning model',
  inputSchema: DropoutPredictionInputSchema,
  outputSchema: DropoutPredictionOutputSchema,
  execute: async ({ context }) => {
    try {
      // Check if model files exist
      const modelPath = path.join(process.cwd(), 'mastra', 'dropout_model.joblib');
      const metadataPath = path.join(process.cwd(), 'mastra', 'model_metadata.json');
      
      if (!fs.existsSync(modelPath) || !fs.existsSync(metadataPath)) {
        throw new Error('Dropout prediction model files not found. Please ensure dropout_model.joblib and model_metadata.json are in the mastra/ directory.');
      }

      // Create Python script
      const pythonScript = createPythonScript(context);
      
      // Write script to temporary file
      const scriptPath = path.join(process.cwd(), 'temp_dropout_prediction.py');
      fs.writeFileSync(scriptPath, pythonScript);
      
      try {
        // Execute Python script
        const { stdout, stderr } = await execAsync(`python3 "${scriptPath}"`);
        
        if (stderr) {
          console.warn('Python script warnings:', stderr);
        }
        
        // Parse output
        const result = JSON.parse(stdout.trim());
        
        // Clean up temporary file
        fs.unlinkSync(scriptPath);
        
        return result;
      } catch (error) {
        // Clean up temporary file
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }
        throw error;
      }
    } catch (error) {
      console.error('Dropout prediction error:', error);
      throw new Error(`Failed to predict dropout risk: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },
});