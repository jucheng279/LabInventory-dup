import { useState, useCallback, useRef, useEffect } from 'react';
import { sendAIMessageStreaming, AIMessage, AIChatResponse, AIPhase, CodeMap, CodeMapEntry } from '../services/aiChatService';


const NAV_LINK_RE = /\{\{nav:([^|}]+)\|([^}]+)\}\}/g;

function buildNavString(loc: string, sub: string, pos: string, box: string, bt: string, bn: string, cell: string, displayText: string, folder = '', fn = '', item = ''): string {
  return `{{nav:loc=${loc},sub=${sub},pos=${pos},box=${box},bt=${bt},bn=${encodeURIComponent(bn)},cell=${cell},folder=${folder},fn=${encodeURIComponent(fn)},item=${item}|${displayText}}}`;
}

function fillBoxFromCodeMap(boxId: string, codeMap: CodeMap): { boxType: string; boxName: string } {
  for (const entry of Object.values(codeMap)) {
    if (entry.type === 'box' && entry.uuid === boxId) {
      return { boxType: entry.box_type || '', boxName: entry.name || '' };
    }
  }
  return { boxType: '', boxName: '' };
}

function findBoxByName(codeMap: CodeMap, displayText: string, locationId?: string, sublocationId?: string): CodeMapEntry | undefined {
  const lower = displayText.toLowerCase();
  for (const entry of Object.values(codeMap)) {
    if (entry.type !== 'box') continue;
    if (entry.name?.toLowerCase() !== lower) continue;
    if (locationId && entry.location_id && entry.location_id !== locationId) continue;
    if (sublocationId && entry.sublocation_id && entry.sublocation_id !== sublocationId) continue;
    return entry;
  }
  return undefined;
}

function resolveNavLinksToUUIDs(text: string, codeMap: CodeMap): string {
  return text.replace(NAV_LINK_RE, (match, codePath: string, displayText: string) => {
    let cellCoord = '';
    let pathPart = codePath;

    const colonIdx = codePath.lastIndexOf(':');
    if (colonIdx > 0) {
      const afterColon = codePath.slice(colonIdx + 1);
      if (/^[A-Z]+\d+$/i.test(afterColon)) {
        cellCoord = afterColon;
        pathPart = codePath.slice(0, colonIdx);
      }
    }

    const segments = pathPart.split('.').filter(Boolean);

    // Resolve each segment from the codeMap into its hierarchy role
    let locationId = '';
    let sublocationId = '';
    let positionId = '';
    let boxId = '';
    let boxName = '';
    let boxType = '';
    let folderId = '';
    let folderName = '';
    let itemId = '';

    for (const seg of segments) {
      const entry: CodeMapEntry | undefined = codeMap[seg];
      if (!entry) {
        console.warn('[NavRewrite] segment not in codeMap:', seg, 'keys:', Object.keys(codeMap).join(','));
        continue;
      }
      switch (entry.type) {
        case 'location':
          locationId = entry.uuid;
          break;
        case 'sublocation':
          sublocationId = entry.uuid;
          if (!locationId && entry.location_id) locationId = entry.location_id;
          break;
        case 'position':
          positionId = entry.uuid;
          if (!sublocationId && entry.sublocation_id) sublocationId = entry.sublocation_id;
          if (!locationId && entry.location_id) locationId = entry.location_id;
          break;
        case 'box':
          boxId = entry.uuid;
          boxName = entry.name;
          boxType = entry.box_type || '';
          if (!locationId && entry.location_id) locationId = entry.location_id;
          if (entry.sublocation_id && !sublocationId) sublocationId = entry.sublocation_id;
          if (entry.position_id && !positionId) positionId = entry.position_id;
          break;
        case 'cell':
          if (entry.box_id && !boxId) {
            boxId = entry.box_id;
            const bf = fillBoxFromCodeMap(boxId, codeMap);
            boxName = bf.boxName; boxType = bf.boxType;
          }
          if (entry.location_id && !locationId) locationId = entry.location_id;
          if (entry.sublocation_id && !sublocationId) sublocationId = entry.sublocation_id;
          if (entry.position_id && !positionId) positionId = entry.position_id;
          break;
        case 'item_folder':
          folderId = entry.uuid;
          folderName = entry.name;
          if (!locationId && entry.location_id) locationId = entry.location_id;
          if (entry.sublocation_id && !sublocationId) sublocationId = entry.sublocation_id;
          if (entry.position_id && !positionId) positionId = entry.position_id;
          break;
        case 'item':
          itemId = entry.uuid;
          if (!locationId && entry.location_id) locationId = entry.location_id;
          if (entry.sublocation_id && !sublocationId) sublocationId = entry.sublocation_id;
          if (entry.position_id && !positionId) positionId = entry.position_id;
          if (entry.folder_id && !folderId) folderId = entry.folder_id;
          break;
      }
    }

    // --- Cell coordinate handling ---
    if (cellCoord) {
      // Try to find the cell entry in the codeMap (B5:D4 format)
      const lastSeg = segments[segments.length - 1];
      const fullCellKey = /^B\d+$/i.test(lastSeg) ? `${lastSeg}:${cellCoord}` : '';
      let cellEntry: CodeMapEntry | undefined = fullCellKey ? codeMap[fullCellKey] : undefined;

      // Broad scan: find any cell entry matching this coordinate
      if (!cellEntry) {
        for (const [key, entry] of Object.entries(codeMap)) {
          if (entry.type !== 'cell' || !key.endsWith(`:${cellCoord}`)) continue;
          if (locationId && entry.location_id && entry.location_id !== locationId) continue;
          cellEntry = entry;
          break;
        }
      }
      // Even broader: match by coordinate alone
      if (!cellEntry) {
        for (const [key, entry] of Object.entries(codeMap)) {
          if (entry.type === 'cell' && key.endsWith(`:${cellCoord}`)) {
            cellEntry = entry;
            break;
          }
        }
      }

      if (cellEntry) {
        if (!boxId && cellEntry.box_id) {
          boxId = cellEntry.box_id;
          const bf = fillBoxFromCodeMap(boxId, codeMap);
          boxName = bf.boxName; boxType = bf.boxType;
        }
        if (!locationId && cellEntry.location_id) locationId = cellEntry.location_id;
        if (!sublocationId && cellEntry.sublocation_id) sublocationId = cellEntry.sublocation_id;
        if (!positionId && cellEntry.position_id) positionId = cellEntry.position_id;
      }
    }

    // Recovery: display text matches a box name in the codeMap
    if (!boxId) {
      const boxByName = findBoxByName(codeMap, displayText, locationId || undefined, sublocationId || undefined);
      if (boxByName) {
        boxId = boxByName.uuid;
        boxName = boxByName.name;
        boxType = boxByName.box_type || '';
        if (boxByName.location_id && !locationId) locationId = boxByName.location_id;
        if (boxByName.sublocation_id && !sublocationId) sublocationId = boxByName.sublocation_id;
        if (boxByName.position_id && !positionId) positionId = boxByName.position_id;
      }
    }

    if (!locationId && !boxId) {
      console.warn('[NavRewrite] FAILED for codePath:', codePath, 'display:', displayText);
      return match;
    }

    console.log('[NavRewrite]', codePath, '->', { loc: locationId?.slice(0,8), box: boxId?.slice(0,8), bt: boxType, cell: cellCoord, folder: folderId?.slice(0,8), item: itemId?.slice(0,8) });
    return buildNavString(locationId, sublocationId, positionId, boxId, boxType, boxName, cellCoord, displayText, folderId, folderName, itemId);
  });
}

export interface ThinkingRecord {
  steps: string[];
  tools: string[];
  durationMs: number;
}

let persistedMessages: AIMessage[] = [];
let persistedSuggestedTerms: string[] = [];
let persistedToolsUsed: string[] = [];
let persistedError: string | null = null;
let persistedThinkingRecords: Map<number, ThinkingRecord> = new Map();
let persistedCodeMap: CodeMap = {};

interface UseAIChatReturn {
  messages: AIMessage[];
  isLoading: boolean;
  streamingContent: string;
  error: string | null;
  suggestedTerms: string[];
  toolsUsed: string[];
  phase: AIPhase;
  currentTool: string | null;
  currentThinkingStep: string | null;
  thinkingTools: string[];
  workDurationMs: number;
  isThinkingDone: boolean;
  codeMap: CodeMap;
  getThinkingRecord: (messageIndex: number) => ThinkingRecord | undefined;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
}

export function clearAIChatState() {
  persistedMessages = [];
  persistedSuggestedTerms = [];
  persistedToolsUsed = [];
  persistedError = null;
  persistedThinkingRecords = new Map();
  persistedCodeMap = {};
}

export function useAIChat(): UseAIChatReturn {
  const [messages, setMessages] = useState<AIMessage[]>(persistedMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [error, setError] = useState<string | null>(persistedError);
  const [suggestedTerms, setSuggestedTerms] = useState<string[]>(persistedSuggestedTerms);
  const [toolsUsed, setToolsUsed] = useState<string[]>(persistedToolsUsed);
  const [phase, setPhase] = useState<AIPhase>(null);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [currentThinkingStep, setCurrentThinkingStep] = useState<string | null>(null);
  const [thinkingTools, setThinkingTools] = useState<string[]>([]);
  const [workDurationMs, setWorkDurationMs] = useState(0);
  const [isThinkingDone, setIsThinkingDone] = useState(false);
  const [thinkingRecords, setThinkingRecords] = useState<Map<number, ThinkingRecord>>(persistedThinkingRecords);
  const [codeMap, setCodeMap] = useState<CodeMap>(persistedCodeMap);

  const streamingRef = useRef('');
  const thinkingStepsRef = useRef<string[]>([]);
  const thinkingToolsRef = useRef<string[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => { persistedMessages = messages; }, [messages]);
  useEffect(() => { persistedSuggestedTerms = suggestedTerms; }, [suggestedTerms]);
  useEffect(() => { persistedToolsUsed = toolsUsed; }, [toolsUsed]);
  useEffect(() => { persistedError = error; }, [error]);
  useEffect(() => { persistedThinkingRecords = thinkingRecords; }, [thinkingRecords]);
  useEffect(() => { persistedCodeMap = codeMap; }, [codeMap]);

  const getThinkingRecord = useCallback((messageIndex: number) => {
    return thinkingRecords.get(messageIndex);
  }, [thinkingRecords]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: AIMessage = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    setStreamingContent('');
    setPhase('thinking');
    setCurrentTool(null);
    setCurrentThinkingStep(null);
    setThinkingTools([]);
    setWorkDurationMs(0);
    setIsThinkingDone(false);
    streamingRef.current = '';
    thinkingStepsRef.current = [];
    thinkingToolsRef.current = [];
    startTimeRef.current = Date.now();

    try {
      const history = [...messages, userMessage];
      const response: AIChatResponse = await sendAIMessageStreaming(
        trimmed,
        history,
        (chunk: string) => {
          if (!streamingRef.current) {
            const elapsed = Date.now() - startTimeRef.current;
            setWorkDurationMs(elapsed);
            setIsThinkingDone(true);
          }
          streamingRef.current += chunk;
          setStreamingContent(streamingRef.current);
        },
        (event) => {
          setPhase(event.phase);
          setCurrentTool(event.tool || null);
          if (event.phase === 'tool' && event.tool) {
            thinkingToolsRef.current = [...thinkingToolsRef.current, event.tool];
            setThinkingTools([...thinkingToolsRef.current]);
          }
        },
        (step: string) => {
          thinkingStepsRef.current = [...thinkingStepsRef.current, step];
          setCurrentThinkingStep(step);
        }
      );

      // Merge new codes into accumulated codeMap (persists across messages)
      let mergedCodeMap = persistedCodeMap;
      if (response.codeMap && Object.keys(response.codeMap).length > 0) {
        mergedCodeMap = { ...persistedCodeMap, ...response.codeMap };
        setCodeMap(mergedCodeMap);
        console.log('[AI CodeMap] received', Object.keys(response.codeMap).length, 'entries:', Object.entries(response.codeMap).map(([k, e]) => `${k}(${e.type})`).join(', '));
      } else {
        console.log('[AI CodeMap] empty response, using persisted:', Object.keys(persistedCodeMap).length, 'entries');
      }

      // Rewrite nav links from ref codes (L1.B7) to resolved UUIDs before storing
      const navMatches = response.reply.match(/\{\{nav:[^}]+\}\}/g);
      if (navMatches) {
        console.log('[AI Nav] raw links:', navMatches.map(m => m.slice(0, 120)));
      }
      const resolvedReply = Object.keys(mergedCodeMap).length > 0
        ? resolveNavLinksToUUIDs(response.reply, mergedCodeMap)
        : response.reply;
      if (navMatches) {
        const resolvedMatches = resolvedReply.match(/\{\{nav:[^}]+\}\}/g);
        console.log('[AI Nav] resolved links:', (resolvedMatches || []).map(m => m.slice(0, 150)));
      }

      const assistantMessage: AIMessage = { role: 'assistant', content: resolvedReply };
      setMessages(prev => {
        const newMessages = [...prev, assistantMessage];
        const msgIndex = newMessages.length - 1;
        if (thinkingStepsRef.current.length > 0 || thinkingToolsRef.current.length > 0) {
          const record: ThinkingRecord = {
            steps: thinkingStepsRef.current,
            tools: thinkingToolsRef.current,
            durationMs: Date.now() - startTimeRef.current,
          };
          setThinkingRecords(prev => {
            const next = new Map(prev);
            next.set(msgIndex, record);
            return next;
          });
        }
        return newMessages;
      });
      setSuggestedTerms(response.suggestedTerms);
      setToolsUsed(response.toolsUsed);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setStreamingContent('');
      setPhase(null);
      setCurrentTool(null);
      setCurrentThinkingStep(null);
      setThinkingTools([]);
      setIsThinkingDone(false);
      streamingRef.current = '';
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setSuggestedTerms([]);
    setToolsUsed([]);
    setStreamingContent('');
    setPhase(null);
    setCurrentTool(null);
    setCurrentThinkingStep(null);
    setThinkingTools([]);
    setWorkDurationMs(0);
    setIsThinkingDone(false);
    setThinkingRecords(new Map());
    setCodeMap({});
    streamingRef.current = '';
    persistedMessages = [];
    persistedSuggestedTerms = [];
    persistedToolsUsed = [];
    persistedError = null;
    persistedThinkingRecords = new Map();
    persistedCodeMap = {};
  }, []);

  return {
    messages, isLoading, streamingContent, error, suggestedTerms, toolsUsed,
    phase, currentTool, currentThinkingStep, thinkingTools, workDurationMs,
    isThinkingDone, getThinkingRecord, sendMessage, clearChat
  };
}
