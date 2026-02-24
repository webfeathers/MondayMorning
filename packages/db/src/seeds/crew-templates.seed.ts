/**
 * Seed data for AI crew templates
 *
 * Defines the default crew templates available to all tenants.
 */

export const crewTemplateSeeds = [
  {
    name: 'Account Health Analysis',
    slug: 'account_health',
    description:
      'Comprehensive analysis of account health, identifying risks, opportunities, and providing actionable recommendations for account managers.',
    maxContext: {
      organizations: 1,
      deals: 20,
      contacts: 10,
      tickets: 15,
      meetings: 10,
    },
    estimatedCreditCost: 50, // ~50K tokens average
    config: {
      contextRequirements: [
        'organizations',
        'deals',
        'contacts',
        'tickets',
        'meetings',
      ],
      agents: [
        {
          role: 'Account Health Analyst',
          goal: 'Assess the overall health and engagement level of the account',
          backstory:
            'You are an experienced customer success analyst who specializes in identifying account health signals from CRM data, support tickets, and meeting transcripts.',
        },
        {
          role: 'Risk Identification Specialist',
          goal: 'Identify potential churn risks and warning signs',
          backstory:
            'You are a churn prevention expert who can spot early warning signs of customer dissatisfaction or disengagement.',
        },
        {
          role: 'Opportunity Finder',
          goal: 'Discover expansion and upsell opportunities',
          backstory:
            'You are a growth strategist who identifies signals indicating readiness for expansion, upgrades, or additional services.',
        },
        {
          role: 'Action Recommender',
          goal: 'Synthesize findings into specific, actionable recommendations',
          backstory:
            'You are a strategic advisor who translates analysis into clear, prioritized action items for account managers.',
        },
      ],
      tasks: [
        {
          description:
            'Analyze deal pipeline activity, win rates, and deal velocity trends',
          expectedOutput:
            'Summary of deal health metrics with trend analysis and key patterns',
        },
        {
          description:
            'Review support ticket volume, resolution time, and sentiment patterns',
          expectedOutput:
            'Assessment of support engagement and satisfaction indicators',
        },
        {
          description:
            'Evaluate meeting frequency, attendance, and executive engagement',
          expectedOutput:
            'Analysis of relationship strength and engagement level',
        },
        {
          description:
            'Identify churn risks based on declining engagement, negative sentiment, or support escalations',
          expectedOutput:
            'List of risk factors with severity levels and supporting evidence',
        },
        {
          description:
            'Identify expansion opportunities based on usage patterns, positive sentiment, and strategic initiatives',
          expectedOutput:
            'List of growth opportunities with confidence scores and timing recommendations',
        },
        {
          description:
            'Synthesize all findings into a health score (0-100) and prioritized action plan',
          expectedOutput:
            'Comprehensive health report with score, risk/opportunity summary, and 3-5 specific action items',
        },
      ],
    },
    isActive: true,
  },
  {
    name: 'Deal Risk Assessment',
    slug: 'deal_risk',
    description:
      'Analyzes a specific deal to identify blockers, risks, and suggests strategies to move it forward.',
    maxContext: {
      deals: 1,
      organizations: 1,
      contacts: 10,
      meetings: 5,
      tickets: 5,
    },
    estimatedCreditCost: 30, // ~30K tokens average
    config: {
      contextRequirements: ['deals', 'organizations', 'contacts', 'meetings'],
      agents: [
        {
          role: 'Deal Analyst',
          goal: 'Evaluate deal health and progression',
          backstory:
            'You are a sales operations analyst who specializes in identifying deal risks and blockers.',
        },
        {
          role: 'Competitive Intelligence Specialist',
          goal: 'Assess competitive dynamics and positioning',
          backstory:
            'You understand competitive signals and how they impact deal outcomes.',
        },
        {
          role: 'Close Plan Strategist',
          goal: 'Develop strategies to overcome obstacles and close the deal',
          backstory:
            'You are a seasoned sales strategist who knows how to navigate complex deal cycles.',
        },
      ],
      tasks: [
        {
          description:
            'Analyze deal stage progression, timeline, and momentum',
          expectedOutput:
            'Assessment of deal velocity and stage appropriateness',
        },
        {
          description:
            'Review stakeholder engagement and decision-maker involvement',
          expectedOutput:
            'Stakeholder map with engagement levels and influence assessment',
        },
        {
          description:
            'Identify blockers, objections, and competitive threats',
          expectedOutput:
            'List of risks with impact assessment and mitigation strategies',
        },
        {
          description:
            'Recommend next steps and close plan tactics',
          expectedOutput:
            'Prioritized action plan with specific tactics and timeline',
        },
      ],
    },
    isActive: true,
  },
  {
    name: 'Executive Business Review Preparation',
    slug: 'ebr_prep',
    description:
      'Prepares a comprehensive briefing for Executive Business Reviews, including achievements, metrics, and strategic recommendations.',
    maxContext: {
      organizations: 1,
      deals: 10,
      tickets: 20,
      meetings: 15,
      contacts: 10,
    },
    estimatedCreditCost: 40, // ~40K tokens average
    config: {
      contextRequirements: [
        'organizations',
        'deals',
        'tickets',
        'meetings',
        'contacts',
      ],
      agents: [
        {
          role: 'Business Analyst',
          goal: 'Summarize business outcomes and ROI achieved',
          backstory:
            'You excel at quantifying value delivered and translating technical details into business impact.',
        },
        {
          role: 'Strategic Advisor',
          goal: 'Identify strategic alignment opportunities and future initiatives',
          backstory:
            'You understand how to position strategic recommendations that align with executive priorities.',
        },
        {
          role: 'Executive Communicator',
          goal: 'Package insights for C-level consumption',
          backstory:
            'You know how to communicate complex information clearly and concisely for executive audiences.',
        },
      ],
      tasks: [
        {
          description:
            'Summarize key achievements, milestones, and value delivered since last EBR',
          expectedOutput:
            'Executive summary of accomplishments with quantified business impact',
        },
        {
          description:
            'Analyze usage trends, adoption metrics, and business outcomes',
          expectedOutput:
            'Key metrics dashboard with trends and insights',
        },
        {
          description:
            'Review support engagement and resolution effectiveness',
          expectedOutput:
            'Support health summary with improvements and action items',
        },
        {
          description:
            'Identify strategic opportunities for deeper partnership',
          expectedOutput:
            'Strategic recommendations aligned with customer business goals',
        },
        {
          description:
            'Prepare executive-ready briefing document',
          expectedOutput:
            'Polished EBR document with narrative, data points, and next steps',
        },
      ],
    },
    isActive: true,
  },
  {
    name: 'Renewal Risk Analysis',
    slug: 'renewal_risk',
    description:
      'Evaluates renewal likelihood and identifies actions needed to secure renewal for contracts coming up within the next 90 days.',
    maxContext: {
      organizations: 1,
      deals: 5,
      contacts: 10,
      tickets: 30,
      meetings: 10,
    },
    estimatedCreditCost: 35, // ~35K tokens average
    config: {
      contextRequirements: [
        'organizations',
        'deals',
        'contacts',
        'tickets',
        'meetings',
      ],
      agents: [
        {
          role: 'Renewal Specialist',
          goal: 'Assess renewal likelihood and risk factors',
          backstory:
            'You specialize in evaluating customer satisfaction and predicting renewal outcomes.',
        },
        {
          role: 'Value Validator',
          goal: 'Validate value realization and ROI',
          backstory:
            'You help customers recognize and articulate the value they\'ve received.',
        },
        {
          role: 'Retention Strategist',
          goal: 'Develop renewal acceleration strategies',
          backstory:
            'You know how to navigate renewal conversations and overcome objections.',
        },
      ],
      tasks: [
        {
          description:
            'Evaluate product usage, adoption trends, and value realization',
          expectedOutput:
            'Usage health assessment with adoption metrics and ROI validation',
        },
        {
          description:
            'Analyze support sentiment, escalations, and unresolved issues',
          expectedOutput:
            'Support health summary identifying satisfaction risks',
        },
        {
          description:
            'Assess executive engagement and relationship strength',
          expectedOutput:
            'Stakeholder relationship map with engagement scores',
        },
        {
          description:
            'Identify renewal risks and calculate risk score',
          expectedOutput:
            'Renewal risk assessment with probability score and key risk factors',
        },
        {
          description:
            'Recommend renewal strategy and action plan',
          expectedOutput:
            'Tactical renewal plan with timing, messaging, and key actions',
        },
      ],
    },
    isActive: true,
  },
  {
    name: 'Competitive Win/Loss Analysis',
    slug: 'competitive_analysis',
    description:
      'Analyzes patterns in won and lost deals to identify competitive strengths, weaknesses, and winning strategies.',
    maxContext: {
      deals: 50,
      organizations: 50,
      contacts: 20,
      meetings: 20,
    },
    estimatedCreditCost: 60, // ~60K tokens average
    config: {
      contextRequirements: ['deals', 'organizations', 'contacts'],
      agents: [
        {
          role: 'Win/Loss Analyst',
          goal: 'Identify patterns in won and lost deals',
          backstory:
            'You are a competitive intelligence analyst who excels at finding patterns in deal outcomes.',
        },
        {
          role: 'Competitive Strategist',
          goal: 'Develop strategies to improve win rates',
          backstory:
            'You translate competitive insights into actionable sales strategies and positioning.',
        },
      ],
      tasks: [
        {
          description:
            'Analyze win/loss patterns by industry, deal size, and competitor',
          expectedOutput:
            'Win/loss statistics with key pattern insights',
        },
        {
          description:
            'Identify common objections and reasons for loss',
          expectedOutput:
            'Top objections and competitive weaknesses to address',
        },
        {
          description:
            'Identify winning strategies and differentiators in closed-won deals',
          expectedOutput:
            'Best practices and winning tactics to replicate',
        },
        {
          description:
            'Recommend competitive positioning improvements',
          expectedOutput:
            'Strategic recommendations to improve win rates',
        },
      ],
    },
    isActive: true,
  },
];
