import Anthropic from '@anthropic-ai/sdk'
import {SYSTEM_PROMPT, buildUserPrompt} from './prompt.js'
import {ROUNDUP_JSON_SCHEMA} from './roundupSchema.js'

const MODEL = process.env.SLOTH_MODEL || 'claude-opus-5'
const EFFORT = process.env.SLOTH_EFFORT || 'high'
const MAX_TOKENS = Number(process.env.SLOTH_MAX_TOKENS || 32000)
const USE_WEB_SEARCH = process.env.SLOTH_WEB_SEARCH !== '0'
const MAX_PAUSE_RESUMES = 5

const client = new Anthropic() // reads ANTHROPIC_API_KEY, or an `ant auth login` profile

/**
 * Drafts one roundup and returns the parsed JSON (unvalidated — the caller
 * runs validateRoundup on it).
 *
 * Notes on the request shape:
 * - output_config.format constrains the response to ROUNDUP_JSON_SCHEMA, so
 *   there's no prose to strip and no brittle regex parsing.
 * - web_search is a server-side tool: Anthropic runs the searches, we just
 *   read the answer. Long search turns can come back as stop_reason
 *   "pause_turn", which means "not done, send it back to continue".
 * - fallbacks: "default" re-runs a policy-declined request on Anthropic's
 *   recommended fallback model inside the same call. Cheap insurance.
 */
export async function draftRoundup({topic, category, slug}) {
  let messages = [{role: 'user', content: buildUserPrompt({topic, category, slug, useWebSearch: USE_WEB_SEARCH})}]

  for (let resume = 0; resume <= MAX_PAUSE_RESUMES; resume++) {
    const message = await requestWithFallbacks(messages)

    if (message.stop_reason === 'refusal') {
      throw new Error(
        `Claude declined this request (${message.stop_details?.category ?? 'no category'}). ` +
          `Rewrite the topic or draft this one by hand.`,
      )
    }

    if (message.stop_reason === 'max_tokens') {
      throw new Error(`Response hit max_tokens (${MAX_TOKENS}). Raise SLOTH_MAX_TOKENS and retry.`)
    }

    if (message.stop_reason === 'pause_turn') {
      // Server-side tool loop hit its iteration limit. Echo the turn back to resume.
      messages = [...messages, {role: 'assistant', content: message.content}]
      continue
    }

    return {draft: parseJsonPayload(message), usage: message.usage, model: message.model}
  }

  throw new Error(`Still paused after ${MAX_PAUSE_RESUMES} resumes — giving up.`)
}

async function requestWithFallbacks(messages) {
  const params = {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [{type: 'text', text: SYSTEM_PROMPT, cache_control: {type: 'ephemeral'}}],
    messages,
    ...(USE_WEB_SEARCH
      ? {tools: [{type: 'web_search_20260209', name: 'web_search', max_uses: 8}]}
      : {}),
    output_config: {
      effort: EFFORT,
      format: {type: 'json_schema', schema: ROUNDUP_JSON_SCHEMA},
    },
  }

  try {
    // Streaming keeps a long, search-heavy turn from tripping the HTTP timeout.
    const stream = client.beta.messages.stream({
      ...params,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    })
    return await stream.finalMessage()
  } catch (error) {
    // Older SDK or an account without the fallback beta — retry without it
    // rather than failing the run over an optional resilience feature.
    if (error instanceof Anthropic.BadRequestError && /fallback/i.test(error.message)) {
      console.warn('  note: server-side fallbacks unavailable, continuing without them')
      const stream = client.messages.stream(params)
      return await stream.finalMessage()
    }
    throw error
  }
}

function parseJsonPayload(message) {
  const texts = message.content.filter((block) => block.type === 'text').map((block) => block.text)
  for (const text of texts.reverse()) {
    try {
      return JSON.parse(text)
    } catch {
      // Structured outputs guarantee valid JSON in the final text block, but a
      // search-heavy turn can also emit narration blocks — keep looking.
    }
  }
  throw new Error('No JSON payload found in the response.')
}
