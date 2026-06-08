import OpenAI from 'openai';
import { config, chatModel } from '../config/env.js';
import { CompanyResearch, FabAnswers } from '../types/index.js';

/**
 * FAB onboarding research service.
 *
 * `researchCompany` does a lightweight LLM lookup based on the company name.
 * It does NOT browse the web — it asks the model to share what it already
 * knows about UAE businesses by that name and to honestly flag uncertainty.
 *
 * `getBackupCompany` returns a pre-vetted demo SME for the worked sample,
 * used as the "we ran one earlier" fallback for live demos.
 */

const openai = new OpenAI(
  config.openRouterApiKey
    ? { apiKey: config.openRouterApiKey, baseURL: 'https://openrouter.ai/api/v1' }
    : { apiKey: config.openaiApiKey }
);

interface LlmResearchPayload {
  source?: 'live' | 'thin';
  sector?: string;
  approximateSize?: string;
  whatTheyDo?: string;
}

export async function researchCompany(companyName: string): Promise<CompanyResearch> {
  const cleanName = companyName.trim();
  if (!cleanName) {
    return { sector: '', approximateSize: '', whatTheyDo: '', source: 'failed' };
  }

  const prompt = `You are a research assistant. Based ONLY on what you already know (no web access), tell me what you can about the UAE-based business named "${cleanName}".

Return ONLY a JSON object with this shape:
{
  "source": "live" | "thin",
  "sector": string,             // e.g. "Logistics & Trading", "F&B", "Construction". Empty string if unknown.
  "approximateSize": string,    // e.g. "~30 staff", "small SME", "mid-market". Empty string if unknown.
  "whatTheyDo": string          // 1 sentence describing what the business does. Empty string if unknown.
}

Rules:
- If you do not have reliable knowledge about this specific business, set "source" to "thin" and leave the other fields as empty strings. Do NOT guess or invent details.
- If you do have reliable knowledge (well-known UAE business, distinctive name with clear sector signal), set "source" to "live" and fill the fields.
- Keep each field short. No marketing language. No URLs.
- Never include rates, fees, or financial specifics.`;

  try {
    const response = await openai.chat.completions.create({
      model: chatModel('gpt-4o-mini'),
      messages: [
        {
          role: 'system',
          content: 'You return only valid JSON. You honestly admit when you do not know a specific business.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      max_tokens: 250,
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { sector: '', approximateSize: '', whatTheyDo: '', source: 'thin' };
    }

    const parsed = JSON.parse(content) as LlmResearchPayload;

    if (parsed.source === 'thin') {
      return { sector: '', approximateSize: '', whatTheyDo: '', source: 'thin' };
    }

    const hasSubstance =
      (parsed.sector && parsed.sector.trim().length > 0) ||
      (parsed.whatTheyDo && parsed.whatTheyDo.trim().length > 0);

    if (!hasSubstance) {
      return { sector: '', approximateSize: '', whatTheyDo: '', source: 'thin' };
    }

    return {
      sector: (parsed.sector || '').trim(),
      approximateSize: (parsed.approximateSize || '').trim(),
      whatTheyDo: (parsed.whatTheyDo || '').trim(),
      source: 'live',
    };
  } catch (err) {
    console.error('Company research failed:', err);
    return { sector: '', approximateSize: '', whatTheyDo: '', source: 'failed' };
  }
}

/**
 * Pre-vetted demo company — the worked sample logistics importer from the brief.
 * Loadable as "we ran one earlier" for demo-day resilience.
 */
export function getBackupCompany(): {
  name: string;
  research: CompanyResearch;
  suggestedAnswers: FabAnswers;
} {
  const name = 'Falcon Components Trading LLC';
  return {
    name,
    research: {
      sector: 'Logistics & Trading',
      approximateSize: '~30 staff',
      whatTheyDo:
        'Imports electronics components from China and South Korea, distributes to UAE retailers. B2B.',
      source: 'backup',
    },
    suggestedAnswers: {
      name: 'Omar',
      companyName: name,
      businessDescription:
        'Imports electronics components from China and South Korea, distributes to UAE retailers.',
      teamSize: '~30 staff',
      yearsOperating: '4 years',
      crossBorder: 'Yes, imports from China and South Korea',
      paymentTerms: 'Customers pay on 60-day terms',
      paymentMethod: 'No card payments, all bank transfer, B2B',
      biggestHeadache:
        'Cash is always tight between paying suppliers up front and waiting two months to get paid.',
    },
  };
}
