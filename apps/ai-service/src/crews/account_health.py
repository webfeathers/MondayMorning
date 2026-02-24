"""Account Health Analysis Crew.

This crew analyzes CRM account data to assess overall account health,
identify risks, and provide actionable recommendations.

Ported from LUCI account health analysis with improvements for
normalized multi-tenant CRM data structure.
"""

from typing import Any


def get_account_health_crew_config() -> dict[str, Any]:
    """Get configuration for the account health analysis crew.

    Returns:
        Dictionary containing agents and tasks configuration for CrewAI
    """
    return {
        "agents": [
            {
                "role": "CRM Data Analyst",
                "goal": "Analyze account activity, engagement patterns, and relationship strength",
                "backstory": """You are an expert CRM data analyst with years of experience
                analyzing customer relationships. You excel at identifying patterns in
                customer engagement, deal progression, and support interactions. You have
                a keen eye for both positive signals and warning signs in account health.""",
                "verbose": False,
                "allow_delegation": False,
            },
            {
                "role": "Account Risk Assessor",
                "goal": "Identify risks, red flags, and churn signals in account data",
                "backstory": """You are a seasoned customer success professional specializing
                in churn prediction and risk mitigation. You understand the telltale signs
                of at-risk accounts: declining engagement, increased support tickets, stalled
                deals, and gaps in communication. You provide data-driven risk assessments.""",
                "verbose": False,
                "allow_delegation": False,
            },
            {
                "role": "Strategic Account Advisor",
                "goal": "Synthesize insights and provide actionable recommendations for account growth",
                "backstory": """You are a strategic account management expert who translates
                data insights into concrete action plans. You understand how to strengthen
                customer relationships, expand accounts, and prevent churn. Your recommendations
                are practical, prioritized, and directly tied to business outcomes.""",
                "verbose": False,
                "allow_delegation": False,
            },
        ],
        "tasks": [
            {
                "description": """Analyze the account's engagement patterns and activity trends.

Context:
You have access to normalized CRM data for this account including:
- Account information (name, industry, size, status, created date)
- All associated contacts with their roles and activity
- Deal pipeline (open, closed-won, closed-lost deals with stages and amounts)
- Support tickets (open, resolved, with priorities and response times)
- Interaction history (meetings, calls, emails with dates and notes)

Your task:
1. Assess overall engagement level (frequency of interactions, responsiveness)
2. Identify trends: Is engagement increasing, stable, or declining?
3. Evaluate deal pipeline health: progression rates, stall indicators
4. Analyze support ticket patterns: volume, severity, resolution times
5. Assess relationship breadth: number of contacts, seniority levels
6. Note any significant changes in the past 30/60/90 days

Provide a detailed engagement analysis with specific metrics and observations.
The context_data will contain:
- accounts: List of account records
- contacts: List of contact records linked to accounts
- deals: List of deal records with stages and amounts
- tickets: List of support ticket records
- activities: List of interaction records (calls, meetings, emails)

Focus on quantitative metrics and observable patterns.""",
                "expected_output": """A structured analysis containing:
- Engagement score (1-10) with justification
- Key engagement metrics (interaction frequency, response rates)
- Trend analysis (improving/stable/declining)
- Deal pipeline assessment
- Support ticket analysis
- Notable patterns or changes
All observations must be backed by specific data points.""",
                "agent_index": 0,
            },
            {
                "description": """Identify risks, red flags, and churn indicators in this account.

Building on the engagement analysis, assess account risk level.

Your task:
1. Identify churn risk factors:
   - Declining engagement or responsiveness
   - Increased support burden or unresolved critical issues
   - Stalled deals or lost opportunities
   - Champion turnover or loss of key contacts
   - Gaps in communication (no activity for extended periods)
   - Contract renewal coming up without clear renewal path

2. Score risk severity for each factor (low/medium/high)
3. Evaluate overall account risk (low/medium/high/critical)
4. Identify the most urgent risks requiring immediate attention
5. Note any positive signals that mitigate risk

Be specific about the data that indicates risk. Avoid speculation.""",
                "expected_output": """A risk assessment containing:
- Overall risk score (low/medium/high/critical) with clear rationale
- List of specific risk factors with severity and evidence
- Timeline of concerning changes or events
- Mitigating factors (positive signals)
- Top 3 most urgent risks requiring action
Risk identification must be evidence-based from the provided data.""",
                "agent_index": 1,
            },
            {
                "description": """Synthesize the engagement analysis and risk assessment into
an actionable account health report with strategic recommendations.

Combine insights from the CRM Data Analyst and Account Risk Assessor to create a
comprehensive account health report.

Your task:
1. Assign an overall account health score (0-100) considering:
   - Engagement levels and trends
   - Deal pipeline health
   - Support ticket patterns
   - Risk factors and severity
   - Relationship strength

2. Provide an executive summary of account status (2-3 sentences)

3. Generate prioritized recommendations:
   - Immediate actions (within 1 week) for critical issues
   - Short-term strategies (1-4 weeks) for improvement
   - Long-term initiatives (1-3 months) for growth

4. Recommendations should be:
   - Specific and actionable (who should do what)
   - Tied to observed data and identified risks
   - Prioritized by impact and urgency
   - Realistic given the account context

Output the final report as structured JSON.""",
                "expected_output": """A JSON object with this structure:
{
  "health_score": 85,
  "health_category": "healthy|at-risk|critical",
  "summary": "Brief executive summary of account status",
  "engagement_score": 8,
  "risk_level": "low|medium|high|critical",
  "key_insights": [
    "Top 3-5 most important insights about this account"
  ],
  "recommendations": {
    "immediate": [
      {
        "action": "Specific action to take",
        "rationale": "Why this is needed",
        "owner": "Who should do it (AE/CSM/Support)",
        "urgency": "critical|high|medium"
      }
    ],
    "short_term": [...],
    "long_term": [...]
  },
  "risk_factors": [
    {
      "factor": "Description of risk",
      "severity": "low|medium|high|critical",
      "evidence": "Specific data supporting this"
    }
  ],
  "positive_signals": [
    "Notable strengths or positive trends"
  ]
}""",
                "agent_index": 2,
            },
        ],
        "verbose": False,
    }
