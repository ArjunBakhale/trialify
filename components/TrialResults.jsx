import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ExternalLink, MapPin, Calendar, Users, AlertCircle, TrendingUp, Shield } from 'lucide-react'

const TrialResults = ({ trials }) => {
  // Handle edge cases
  if (!trials || trials === null || trials === undefined) {
    return null
  }

  if (Array.isArray(trials) && trials.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6">
        <Card className="text-center">
          <CardContent className="py-12">
            <AlertCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No matching clinical trials found</h3>
            <p className="text-muted-foreground">
              Please try adjusting your survey answers.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Get status badge styling
  const getStatusBadgeVariant = (status) => {
    if (!status) return 'secondary'

    const normalizedStatus = status.toLowerCase()
    if (normalizedStatus.includes('recruiting')) {
      return 'default' // Green background
    }
    if (normalizedStatus.includes('active') && normalizedStatus.includes('not recruiting')) {
      return 'secondary' // Yellow background
    }
    return 'outline' // Gray background for other statuses
  }

  const getStatusBadgeColor = (status) => {
    if (!status) return ''

    const normalizedStatus = status.toLowerCase()
    if (normalizedStatus.includes('recruiting')) {
      return 'bg-green-600 text-white hover:bg-green-700'
    }
    if (normalizedStatus.includes('active') && normalizedStatus.includes('not recruiting')) {
      return 'bg-yellow-500 text-black hover:bg-yellow-600'
    }
    return 'bg-gray-500 text-white hover:bg-gray-600'
  }

  // Get dropout risk badge styling
  const getRiskBadgeColor = (riskLevel) => {
    if (!riskLevel) return 'bg-gray-100 text-gray-600'
    
    switch (riskLevel) {
      case 'LOW':
        return 'bg-green-100 text-green-700 border-green-200'
      case 'MODERATE':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'HIGH':
        return 'bg-orange-100 text-orange-700 border-orange-200'
      case 'VERY_HIGH':
        return 'bg-red-100 text-red-700 border-red-200'
      default:
        return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Clinical Trial Results</h2>
        <p className="text-muted-foreground text-lg">
          Found {trials.length} matching clinical trial{trials.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Responsive grid layout */}
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
        {trials.map((trial, index) => (
          <Card
            key={trial.id || trial.nctId || index}
            className="w-full bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow duration-200"
          >
            <CardHeader className="space-y-4 pb-4">
              {/* Title */}
              <CardTitle className="text-xl font-bold text-gray-900 leading-tight">
                {trial.title || trial.officialTitle || 'Untitled Study'}
              </CardTitle>

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {/* NCT ID Badge */}
                <Badge variant="outline" className="text-xs">
                  NCT ID: {trial.id || trial.nctId || 'N/A'}
                </Badge>

                {/* Phase Badge */}
                {trial.phase && (
                  <Badge variant="outline" className="text-xs">
                    {trial.phase}
                  </Badge>
                )}

                {/* Status Badge with conditional styling */}
                {trial.status && (
                  <Badge
                    variant={getStatusBadgeVariant(trial.status)}
                    className={`text-xs ${getStatusBadgeColor(trial.status)}`}
                  >
                    {trial.status}
                  </Badge>
                )}

                {/* Match Score Badge */}
                {trial.matchScore && (
                  <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">
                    {Math.round(trial.matchScore * 100)}% Match
                  </Badge>
                )}

                {/* Dropout Risk Badge */}
                {trial.dropoutRisk && (
                  <Badge variant="outline" className={`text-xs ${getRiskBadgeColor(trial.dropoutRisk.riskLevel)}`}>
                    <TrendingUp className="w-3 h-3 mr-1" />
                    {trial.dropoutRisk.riskLevel} Risk ({Math.round(trial.dropoutRisk.overallRisk * 100)}%)
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Location */}
              {trial.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  <span>{trial.location}</span>
                </div>
              )}

              {/* Summary/Brief Summary */}
              {(trial.summary || trial.briefSummary) && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Study Summary</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {trial.summary || trial.briefSummary}
                  </p>
                </div>
              )}

              {/* Match Reason (if different from summary) */}
              {trial.matchReason && trial.matchReason !== trial.summary && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Why This Trial Matches</h4>
                  <p className="text-sm text-muted-foreground">
                    {trial.matchReason}
                  </p>
                </div>
              )}

              {/* Locations array */}
              {trial.locations && Array.isArray(trial.locations) && trial.locations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Study Locations</h4>
                  <div className="flex flex-wrap gap-1">
                    {trial.locations.slice(0, 3).map((location, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {location}
                      </Badge>
                    ))}
                    {trial.locations.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{trial.locations.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Contact Information */}
              {trial.contactInfo && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Contact Information</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {trial.contactInfo.name && trial.contactInfo.name !== 'N/A' && (
                      <p><span className="font-medium">Contact:</span> {trial.contactInfo.name}</p>
                    )}
                    {trial.contactInfo.phone && trial.contactInfo.phone !== 'N/A' && (
                      <p><span className="font-medium">Phone:</span> {trial.contactInfo.phone}</p>
                    )}
                    {trial.contactInfo.email && trial.contactInfo.email !== 'N/A' && (
                      <p><span className="font-medium">Email:</span> {trial.contactInfo.email}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Study Details */}
              {trial.studyDetails && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  {trial.studyDetails.sponsor && (
                    <div>
                      <span className="font-medium">Sponsor:</span>
                      <p className="text-muted-foreground">{trial.studyDetails.sponsor}</p>
                    </div>
                  )}
                  {trial.studyDetails.estimatedCompletion && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <div>
                        <span className="font-medium">Est. Completion:</span>
                        <p className="text-muted-foreground">{trial.studyDetails.estimatedCompletion}</p>
                      </div>
                    </div>
                  )}
                  {trial.studyDetails.enrollment && (
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      <div>
                        <span className="font-medium">Enrollment:</span>
                        <p className="text-muted-foreground">{trial.studyDetails.enrollment} participants</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Next Steps */}
              {trial.nextSteps && Array.isArray(trial.nextSteps) && trial.nextSteps.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Next Steps</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {trial.nextSteps.map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-teal-600 font-medium">{idx + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Eligibility Criteria */}
              {trial.eligibilityCriteria && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Eligibility Criteria</h4>
                  <p className="text-sm text-muted-foreground">
                    {trial.eligibilityCriteria}
                  </p>
                </div>
              )}

              {/* Dropout Risk Assessment */}
              {trial.dropoutRisk && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <h4 className="font-semibold text-sm text-blue-900">Dropout Risk Assessment</h4>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Risk Level */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Risk Level:</span>
                      <Badge className={`text-xs ${getRiskBadgeColor(trial.dropoutRisk.riskLevel)}`}>
                        {trial.dropoutRisk.riskLevel}
                      </Badge>
                    </div>
                    
                    {/* Risk Score */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Risk Score:</span>
                      <span className="text-sm font-mono">{Math.round(trial.dropoutRisk.overallRisk * 100)}%</span>
                    </div>
                    
                    {/* Confidence */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Confidence:</span>
                      <span className="text-sm font-mono">{Math.round(trial.dropoutRisk.confidence * 100)}%</span>
                    </div>
                  </div>

                  {/* Risk Factors */}
                  {trial.riskFactors && trial.riskFactors.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium text-sm mb-2">Key Risk Factors:</h5>
                      <div className="space-y-2">
                        {trial.riskFactors.slice(0, 3).map((factor, idx) => (
                          <div key={idx} className="text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{factor.factor}</span>
                              <span className="text-muted-foreground">{Math.round(factor.impact * 100)}% impact</span>
                            </div>
                            <p className="text-muted-foreground">{factor.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mitigation Recommendations */}
                  {trial.riskMitigationRecommendations && trial.riskMitigationRecommendations.length > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium text-sm mb-2">Recommendations:</h5>
                      <ul className="text-xs space-y-1">
                        {trial.riskMitigationRecommendations.slice(0, 3).map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-blue-600 font-medium">•</span>
                            <span className="text-muted-foreground">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* ClinicalTrials.gov Link */}
              <div className="pt-4 border-t">
                <Button
                  asChild
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                >
                  <a
                    href={`https://clinicaltrials.gov/study/${trial.id || trial.nctId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    View Details on ClinicalTrials.gov
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default TrialResults