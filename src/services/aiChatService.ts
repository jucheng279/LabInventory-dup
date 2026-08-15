import { supabase } from '../lib/supabase';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AIPhase = 'thinking' | 'tool' | 'answering' | null;

export interface AIPhaseEvent {
  phase: AIPhase;
  tool?: string;
}

export interface CodeMapEntry {
  uuid: string;
  name: string;
  type: 'location' | 'sublocation' | 'position' | 'box' | 'cell' | 'item' | 'item_folder';
  accent_color?: string | null;
  location_type?: string;
  box_type?: string;
  box_id?: string;
  box_name?: string;
  location_id?: string;
  sublocation_id?: string;
  position_id?: string;
  icon_id?: string | null;
  folder_id?: string | null;
}

export type CodeMap = Record<string, CodeMapEntry>;

export interface AIChatResponse {
  reply: string;
  suggestedTerms: string[];
  toolsUsed: string[];
  codeMap: CodeMap;
}

export async function sendAIMessageStreaming(
  message: string,
  conversationHistory: AIMessage[],
  onChunk: (text: string) => void,
  onPhase?: (event: AIPhaseEvent) => void,
  onThinkingStep?: (step: string) => void
): Promise<AIChatResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated');
  }

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversationHistory: conversationHistory.map(m => ({
        role: m.role,
        content: m.content,
      })),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Request failed (${response.status})`);
  }

  const contentType = response.headers.get('Content-Type') || '';

  if (contentType.includes('text/event-stream')) {
    return readSSEStream(response, onChunk, onPhase, onThinkingStep);
  }

  const data = await response.json();
  if (!data.reply || typeof data.reply !== 'string') {
    throw new Error('Invalid response from AI service');
  }
  onChunk(data.reply);
  return {
    reply: data.reply,
    suggestedTerms: Array.isArray(data.suggestedTerms) ? data.suggestedTerms : [],
    toolsUsed: Array.isArray(data.toolsUsed) ? data.toolsUsed : [],
    codeMap: {},
  };
}

async function readSSEStream(
  response: Response,
  onChunk: (text: string) => void,
  onPhase?: (event: AIPhaseEvent) => void,
  onThinkingStep?: (step: string) => void
): Promise<AIChatResponse> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let suggestedTerms: string[] = [];
  let toolsUsed: string[] = [];
  let codeMap: CodeMap = {};

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;

      try {
        const event = JSON.parse(data);

        if (event.error) {
          throw new Error(event.error);
        }

        if (event.phase && onPhase) {
          onPhase({ phase: event.phase, tool: event.tool });
        }

        if (event.thinking_step && onThinkingStep) {
          onThinkingStep(event.thinking_step);
        }

        if (event.text) {
          fullText += event.text;
          onChunk(event.text);
        }

        if (event.done) {
          suggestedTerms = Array.isArray(event.suggestedTerms) ? event.suggestedTerms : [];
          toolsUsed = Array.isArray(event.toolsUsed) ? event.toolsUsed : [];
          if (event.codeMap && typeof event.codeMap === 'object') {
            codeMap = event.codeMap as CodeMap;
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message !== 'Stream interrupted') {
          if (data.includes('"error"')) throw e;
        }
      }
    }
  }

  if (!fullText) {
    throw new Error('No response received from AI service');
  }

  return { reply: fullText, suggestedTerms, toolsUsed, codeMap };
}
