import React, { useMemo } from 'react';
import { Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface NavLinkData {
  locationId: string;
  sublocationId: string;
  positionId: string;
  boxId: string;
  boxName: string;
  boxType: string;
  cellId: string;
  displayText: string;
  folderId: string;
  folderName: string;
  itemId: string;
}

function parseKV(s: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of s.split(',')) {
    const eq = pair.indexOf('=');
    if (eq > 0) result[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return result;
}

export function resolveNavLink(codePath: string, displayText: string): NavLinkData | null {
  if (codePath.startsWith('loc=')) {
    const kv = parseKV(codePath);
    const locationId = kv.loc || '';
    const boxId = kv.box || '';
    const folderId = kv.folder || '';
    const itemId = kv.item || '';
    if (!locationId && !boxId && !folderId) return null;
    return {
      locationId,
      sublocationId: kv.sub || '',
      positionId: kv.pos || '',
      boxId,
      boxName: kv.bn ? decodeURIComponent(kv.bn) : '',
      boxType: kv.bt || '',
      cellId: kv.cell || '',
      displayText,
      folderId,
      folderName: kv.fn ? decodeURIComponent(kv.fn) : '',
      itemId,
    };
  }
  return null;
}

const NAV_RE = /\{\{nav:([^|}]+)\|([^}]*(?:\}[^}])*[^}]*)\}\}/g;
const COPY_RE = /\[\[([^\]]+)\]\]/g;

type ExtractedToken = {
  type: 'nav';
  codePath: string;
  displayText: string;
} | {
  type: 'copy';
  term: string;
}

function extractTokens(content: string): { cleaned: string; tokens: Map<string, ExtractedToken> } {
  const tokens = new Map<string, ExtractedToken>();
  let counter = 0;

  let cleaned = content.replace(NAV_RE, (_match, codePath: string, rawDisplay: string) => {
    const displayText = rawDisplay.replace(/\*+/g, '').replace(/_+/g, '').replace(/`/g, '').trim();
    const id = `\u200BNAV${counter++}\u200B`;
    tokens.set(id, { type: 'nav', codePath, displayText });
    return id;
  });

  cleaned = cleaned.replace(COPY_RE, (_match, term: string) => {
    const id = `\u200BCOPY${counter++}\u200B`;
    tokens.set(id, { type: 'copy', term });
    return id;
  });

  return { cleaned, tokens };
}

const PLACEHOLDER_RE = /(\u200BNAV\d+\u200B|\u200BCOPY\d+\u200B)/g;

function processChildren(
  children: React.ReactNode,
  tokens: Map<string, ExtractedToken>,
  onNavigate?: (nav: NavLinkData) => void,
  onCopyTerm?: (term: string) => void,
  copiedTerm?: string | null,
): React.ReactNode {
  return React.Children.map(children, (child, ci) => {
    if (typeof child === 'string') {
      const parts = child.split(PLACEHOLDER_RE).filter(Boolean);
      if (parts.length === 1 && !tokens.has(parts[0])) return child;

      return parts.map((part, pi) => {
        const key = `${ci}-${pi}`;
        const token = tokens.get(part);
        if (!token) return <React.Fragment key={key}>{part}</React.Fragment>;

        if (token.type === 'nav') {
          if (onNavigate) {
            const nav = resolveNavLink(token.codePath, token.displayText);
            if (nav) {
              return (
                <span
                  key={key}
                  onClick={() => onNavigate(nav)}
                  className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                >
                  {token.displayText}
                </span>
              );
            }
          }
          return <span key={key}>{token.displayText}</span>;
        }

        return (
          <button
            key={key}
            onClick={() => onCopyTerm?.(token.term)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ai-50 text-ai-800 text-sm font-medium hover:bg-ai-100 transition-colors border border-ai-200"
            title="Click to copy"
          >
            {token.term}
            {copiedTerm === token.term ? (
              <Check size={12} className="text-green-600" />
            ) : (
              <Copy size={12} className="opacity-50" />
            )}
          </button>
        );
      });
    }

    if (React.isValidElement(child)) {
      const props = child.props as Record<string, unknown>;
      if (props?.children != null) {
        return React.cloneElement(
          child as React.ReactElement<{ children?: React.ReactNode }>,
          {},
          processChildren(props.children as React.ReactNode, tokens, onNavigate, onCopyTerm, copiedTerm),
        );
      }
    }

    return child;
  });
}

interface AIChatMarkdownProps {
  content: string;
  onCopyTerm: (term: string) => void;
  copiedTerm: string | null;
  onNavigate?: (nav: NavLinkData) => void;
}

const AIChatMarkdown: React.FC<AIChatMarkdownProps> = ({ content, onCopyTerm, copiedTerm, onNavigate }) => {
  const { cleaned, tokens } = useMemo(() => extractTokens(content), [content]);

  const wrap = (children: React.ReactNode) =>
    processChildren(children, tokens, onNavigate, onCopyTerm, copiedTerm);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <span className="block text-base font-bold text-gray-900 mt-3 mb-1">{wrap(children)}</span>,
        h2: ({ children }) => <span className="block text-sm font-bold text-gray-900 mt-3 mb-1">{wrap(children)}</span>,
        h3: ({ children }) => <span className="block text-sm font-semibold text-gray-800 mt-2 mb-0.5">{wrap(children)}</span>,
        p: ({ children }) => <span className="block mb-1.5 last:mb-0">{wrap(children)}</span>,
        strong: ({ children }) => <strong className="font-semibold text-gray-900">{wrap(children)}</strong>,
        em: ({ children }) => <em>{wrap(children)}</em>,
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return <code className="block bg-gray-50 border border-gray-100 rounded-lg p-3 text-xs font-mono text-gray-800 my-2 overflow-x-auto">{children}</code>;
          }
          return <code className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-[0.85em] font-mono">{wrap(children)}</code>;
        },
        pre: ({ children }) => <pre className="my-1">{children}</pre>,
        ul: ({ children }) => <ul className="space-y-0.5 my-1">{children}</ul>,
        ol: ({ children }) => <ol className="space-y-0.5 my-1 list-decimal list-inside">{children}</ol>,
        li: ({ children }) => (
          <li className="pl-3 relative before:content-[''] before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-1.5 before:rounded-full before:bg-gray-300">
            {wrap(children)}
          </li>
        ),
        hr: () => <hr className="my-2 border-gray-100" />,
        table: ({ children }) => <table className="w-full text-xs border-collapse my-2">{children}</table>,
        th: ({ children }) => <th className="text-left px-2 py-1 border-b border-gray-200 font-semibold text-gray-700">{wrap(children)}</th>,
        td: ({ children }) => <td className="px-2 py-1 border-b border-gray-50 text-gray-600">{wrap(children)}</td>,
      }}
    >
      {cleaned}
    </ReactMarkdown>
  );
};

export default AIChatMarkdown;
