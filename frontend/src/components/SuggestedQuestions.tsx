import { useMemo } from 'react';

interface SuggestedQuestionsProps {
  questions?: string[];
  onSelect: (question: string) => void;
  disabled?: boolean;
  useCaseContext?: string;
  industry?: string;
}

const DEFAULT_QUESTIONS = [
  'What AI use cases fit my business?',
  'How ready is my team for AI adoption?',
  'What should we automate first?',
  'What does an AI pilot look like?',
];

// Use case keyword → contextual questions mapping
const USE_CASE_QUESTION_MAP: Array<{
  keywords: string[];
  questions: string[];
}> = [
  {
    keywords: ['document', 'documents', 'paperwork', 'contracts', 'invoices', 'data entry', 'extraction'],
    questions: [
      'How can AI automate our document processing?',
      'What document types can AI handle?',
      'How accurate is AI for data extraction?',
      'What does a document AI pilot look like?',
    ],
  },
  {
    keywords: ['customer service', 'support', 'tickets', 'helpdesk', 'customer inquiries', 'wait time'],
    questions: [
      'How can AI improve our customer response times?',
      'Can AI handle our support tickets?',
      'What does an AI customer service pilot look like?',
      'How do we maintain quality with AI support?',
    ],
  },
  {
    keywords: ['sales', 'pipeline', 'leads', 'follow-up', 'crm', 'deals', 'prospecting', 'outreach'],
    questions: [
      'How can AI improve our sales follow-ups?',
      'What sales tasks can AI automate?',
      'How does AI-powered lead scoring work?',
      'What does an AI sales pilot look like?',
    ],
  },
  {
    keywords: ['content', 'marketing', 'writing', 'social media', 'blog', 'copy'],
    questions: [
      'How can AI scale our content production?',
      'Can AI maintain our brand voice?',
      'What content tasks can AI automate?',
      'What does an AI content pilot look like?',
    ],
  },
  {
    keywords: ['onboarding', 'training', 'new hire', 'ramp up', 'employee'],
    questions: [
      'How can AI speed up employee onboarding?',
      'Can AI create personalized training paths?',
      'How do we automate knowledge transfer?',
      'What does an AI onboarding pilot look like?',
    ],
  },
  {
    keywords: ['compliance', 'regulatory', 'audit', 'risk', 'legal'],
    questions: [
      'How can AI streamline our compliance workflow?',
      'Can AI monitor regulatory changes automatically?',
      'How does AI reduce audit preparation time?',
      'What does an AI compliance pilot look like?',
    ],
  },
  {
    keywords: ['booking', 'scheduling', 'appointment', 'reservation', 'concierge'],
    questions: [
      'How can AI handle bookings 24/7?',
      'Can AI manage our scheduling workflow?',
      'What does an AI booking pilot look like?',
      'How do we maintain personal touch with AI scheduling?',
    ],
  },
  {
    keywords: ['automat', 'workflow', 'process', 'efficiency', 'manual', 'repetitive'],
    questions: [
      'What processes should we automate first?',
      'How can AI reduce our manual workload?',
      'What does an AI automation pilot look like?',
      'How do we measure AI automation ROI?',
    ],
  },
];

// v2.1 industry categories with targeted questions
const INDUSTRY_CATEGORY_QUESTIONS: Record<string, string[]> = {
  'Pharma & Healthcare': [
    'How can AI accelerate our HCP engagement and field team productivity?',
    'What AI solutions help with clinical documentation and regulatory compliance?',
    'How does AI improve patient intake scheduling and follow-ups?',
    'What does an AI pilot look like for pharma or healthcare?',
  ],
  'Airlines & Aviation': [
    'How can AI improve crew scheduling and operational efficiency?',
    'What AI tools help with passenger service and rebooking?',
    'How does AI optimize route planning and fuel management?',
    'What does an AI pilot look like for aviation?',
  ],
  'Logistics & Supply Chain': [
    'How can AI optimize our route planning and fleet management?',
    'What AI tools improve demand forecasting and inventory?',
    'How does AI help with warehouse operations and automation?',
    'What does an AI pilot look like for logistics?',
  ],
  'Real Estate & Property': [
    'How can AI streamline property valuations and market analysis?',
    'What AI tools improve lead qualification and tenant screening?',
    'How does AI help with facility management and maintenance?',
    'What does an AI pilot look like for real estate?',
  ],
  'Government & Public Sector': [
    'How can AI improve citizen service delivery and response times?',
    'What AI tools help with document processing and compliance?',
    'How does AI assist with policy analysis and public engagement?',
    'What does an AI pilot look like for government?',
  ],
  'Retail & E-commerce': [
    'How can AI personalize the customer experience and recommendations?',
    'What AI tools improve inventory management and pricing?',
    'How does AI optimize promotions and customer retention?',
    'What does an AI pilot look like for retail?',
  ],
  'Financial Services': [
    'How can AI improve fraud detection and risk analysis?',
    'What financial processes like KYC and reporting can AI automate?',
    'How does AI help with regulatory compliance and audit prep?',
    'What does an AI pilot look like for financial services?',
  ],
  'Education & Training': [
    'How can AI personalize student learning paths and assessments?',
    'What AI tools help with enrollment and administrative tasks?',
    'How does AI improve student engagement and retention?',
    'What does an AI pilot look like for education?',
  ],
  'Cross-Industry': [
    'What AI use cases fit my business?',
    'How ready is my team for AI adoption?',
    'What should we automate first?',
    'What does an AI pilot look like?',
  ],
};

// Map the 13 onboarding industries to v2.1 categories
const INDUSTRY_TO_CATEGORY: Record<string, string> = {
  'Healthcare': 'Pharma & Healthcare',
  'Technology': 'Cross-Industry',
  'Finance & Banking': 'Financial Services',
  'Manufacturing': 'Cross-Industry',
  'Retail & E-commerce': 'Retail & E-commerce',
  'Education': 'Education & Training',
  'Real Estate': 'Real Estate & Property',
  'Legal Services': 'Cross-Industry',
  'Consulting': 'Cross-Industry',
  'Media & Entertainment': 'Cross-Industry',
  'Transportation & Logistics': 'Logistics & Supply Chain',
  'Energy & Utilities': 'Cross-Industry',
  'Other': 'Cross-Industry',
};

function getContextualQuestions(useCaseContext: string, industry?: string): string[] {
  const contextLower = useCaseContext?.toLowerCase().trim() || '';
  // Map to v2.1 category, then look up questions
  const category = industry ? (INDUSTRY_TO_CATEGORY[industry] || 'Cross-Industry') : null;
  const industryQuestions = category ? INDUSTRY_CATEGORY_QUESTIONS[category] : null;

  // Find use-case match
  let useCaseQuestions: string[] | null = null;
  if (contextLower.length > 0) {
    for (const mapping of USE_CASE_QUESTION_MAP) {
      if (mapping.keywords.some(keyword => contextLower.includes(keyword))) {
        useCaseQuestions = mapping.questions;
        break;
      }
    }
  }

  // Priority 1: Both industry + use case match -> blend 2 industry + 2 use-case
  if (industryQuestions && useCaseQuestions) {
    return [...industryQuestions.slice(0, 2), ...useCaseQuestions.slice(0, 2)];
  }

  // Priority 2: Industry match only
  if (industryQuestions) {
    return industryQuestions;
  }

  // Priority 3: Use case match only
  if (useCaseQuestions) {
    return useCaseQuestions;
  }

  // Priority 4: No match, try to reference their stated goal
  if (contextLower.length > 0) {
    const shortContext = useCaseContext.length > 40
      ? useCaseContext.substring(0, 40).trim() + '...'
      : useCaseContext;

    return [
      `How can AI help with ${shortContext.toLowerCase()}?`,
      'What should we automate first?',
      'How ready is my team for AI adoption?',
      'What does an AI pilot look like?',
    ];
  }

  return DEFAULT_QUESTIONS;
}

export function SuggestedQuestions({
  questions,
  onSelect,
  disabled,
  useCaseContext,
  industry,
}: SuggestedQuestionsProps) {
  const displayQuestions = useMemo(() => {
    if (questions && questions.length > 0) return questions;
    return getContextualQuestions(useCaseContext || '', industry);
  }, [questions, useCaseContext, industry]);

  return (
    <div className="space-y-2 lg:space-y-3">
      <div className="text-[10px] lg:text-xs text-allys-muted tracking-wider px-3 lg:px-4">RECOMMENDED</div>
      <div className="space-y-1.5 lg:space-y-2 px-2">
        {displayQuestions.map((question, index) => (
          <button
            key={index}
            onClick={() => onSelect(question)}
            disabled={disabled}
            className={`
              w-full text-left p-3 lg:p-4 rounded bg-allys-dark
              text-xs lg:text-sm text-allys-text
              transition-all duration-200
              ${disabled
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-allys-gray cursor-pointer'
              }
            `}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
