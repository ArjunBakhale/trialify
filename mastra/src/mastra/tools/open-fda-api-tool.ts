import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface OpenFDAResponse {
  interactions: Array<{
    medication: string;
    interaction: string;
    severity: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    recommendation: string;
    evidence: string;
  }>;
  warnings: string[];
}

export const openFdaDrugSafetyTool = createTool({
  id: 'check-drug-interactions',
  description: 'Check drug interactions and safety information using OpenFDA API',
  inputSchema: z.object({
    medications: z.array(z.string()).describe('List of medications to check for interactions'),
    patientAge: z.number().int().positive().optional().describe('Patient age for age-specific warnings'),
    patientWeight: z.number().positive().optional().describe('Patient weight for dosing considerations'),
    allergies: z.array(z.string()).optional().describe('Known drug allergies'),
  }),
  outputSchema: z.object({
    interactions: z.array(z.object({
      medication: z.string(),
      interaction: z.string(),
      severity: z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']),
      recommendation: z.string(),
      evidence: z.string(),
    })),
    warnings: z.array(z.string()),
  }),
  execute: async ({ context }) => {
    return await checkDrugInteractions(context);
  },
});

async function checkDrugInteractions(searchParams: any): Promise<OpenFDAResponse> {
  try {
    const interactions: any[] = [];
    const warnings: string[] = [];
    
    // Check each medication for safety information
    for (const medication of searchParams.medications) {
      try {
        // Search for drug information
        const drugSearchUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:"${encodeURIComponent(medication)}"&limit=1`;
        const drugResponse = await fetch(drugSearchUrl);
        
        if (drugResponse.ok) {
          const drugData = await drugResponse.json();
          
          if (drugData.results?.length > 0) {
            const drug = drugData.results[0];
            
            // Extract warnings and contraindications
            const warningsText = drug.warnings || [];
            const contraindications = drug.contraindications || [];
            
            // Check for age-specific warnings
            if (searchParams.patientAge) {
              if (searchParams.patientAge < 18 && warningsText.some((w: string) => w.toLowerCase().includes('pediatric'))) {
                warnings.push(`Age warning for ${medication}: Pediatric considerations apply`);
              }
              if (searchParams.patientAge > 65 && warningsText.some((w: string) => w.toLowerCase().includes('elderly'))) {
                warnings.push(`Age warning for ${medication}: Elderly patient considerations apply`);
              }
            }
            
            // Check for weight-based dosing
            if (searchParams.patientWeight && warningsText.some((w: string) => w.toLowerCase().includes('weight'))) {
              warnings.push(`Weight-based dosing considerations for ${medication}`);
            }
            
            // Check for allergies
            if (searchParams.allergies?.length) {
              const allergyWarnings = contraindications.filter((contra: string) =>
                searchParams.allergies.some((allergy: string) =>
                  contra.toLowerCase().includes(allergy.toLowerCase())
                )
              );
              
              allergyWarnings.forEach((warning: string) => {
                interactions.push({
                  medication,
                  interaction: `Allergy contraindication: ${warning}`,
                  severity: 'CRITICAL',
                  recommendation: 'Do not use this medication due to known allergy',
                  evidence: 'FDA labeling contraindication',
                });
              });
            }
          }
        }
        
        // Check for drug-drug interactions (simplified)
        if (searchParams.medications.length > 1) {
          const otherMeds = searchParams.medications.filter((med: string) => med !== medication);
          
          // Simple interaction checking based on common drug classes
          const drugClasses = {
            'warfarin': ['aspirin', 'ibuprofen', 'acetaminophen'],
            'digoxin': ['furosemide', 'spironolactone'],
            'metformin': ['insulin', 'sulfonylurea'],
            'lisinopril': ['spironolactone', 'potassium'],
          };
          
          for (const [drugClass, interactingDrugs] of Object.entries(drugClasses)) {
            if (medication.toLowerCase().includes(drugClass)) {
              const interactingMed = otherMeds.find((med: string) =>
                interactingDrugs.some((interactingDrug: string) =>
                  med.toLowerCase().includes(interactingDrug)
                )
              );
              
              if (interactingMed) {
                interactions.push({
                  medication: `${medication} + ${interactingMed}`,
                  interaction: `Potential interaction between ${medication} and ${interactingMed}`,
                  severity: 'MODERATE',
                  recommendation: 'Monitor patient closely for adverse effects',
                  evidence: 'Known drug interaction',
                });
              }
            }
          }
        }
        
      } catch (error) {
        console.warn(`Failed to check ${medication}:`, error);
      }
    }
    
    return {
      interactions,
      warnings,
    };
  } catch (error) {
    console.error('OpenFDA API check failed:', error);
    // Return mock data for development
    return {
      interactions: [
        {
          medication: searchParams.medications.join(' + '),
          interaction: 'Mock drug interaction for development',
          severity: 'MODERATE',
          recommendation: 'Monitor patient closely',
          evidence: 'Mock evidence',
        },
      ],
      warnings: [
        'Mock warning: This is development data only',
      ],
    };
  }
}