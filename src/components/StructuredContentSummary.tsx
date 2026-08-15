import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Beaker, Package, CalendarClock, Unlink, PackagePlus, ExternalLink } from 'lucide-react';
import { CellData } from '../services/locationCellService';
import { computeStructuredBoxContentSummary, getExpirationColor, StructuredContentGroup } from '../utils/cellDataUtils';
import { findNameLink, findInfoLink, findInfoOnlyLink } from '../utils/linkMatchUtils';
import type { SlideBoxHeader, SlideValuesMap, BoxGridItemLink, GridItemLinkType } from '../types/database';

interface StructuredContentSummaryProps {
  cellData: Record<string, CellData>;
  headers: SlideBoxHeader[];
  slideValues: SlideValuesMap;
  links?: BoxGridItemLink[];
  onAddAsItem?: (name: string, info: string | null, linkType: GridItemLinkType, count: number, headerValues?: Record<number, string>) => void;
  onUnlink?: (linkId: string) => void;
  onNavigateToLinkedItem?: (itemId: string) => void;
}

interface StructuredReagentGroupProps {
  group: StructuredContentGroup;
  headers: SlideBoxHeader[];
  links: BoxGridItemLink[];
  onAddAsItem?: StructuredContentSummaryProps['onAddAsItem'];
  onUnlink?: (linkId: string) => void;
  onNavigateToLinkedItem?: (itemId: string) => void;
}

function serializeVariantInfo(headerValues: Record<number, string>, sortedHeaders: SlideBoxHeader[]): string {
  return sortedHeaders.map(h => (headerValues[h.display_order] || '').trim()).join('|||');
}

function hasAnyVariantLink(links: BoxGridItemLink[], name: string): boolean {
  return links.some(
    (l) => (l.link_type === 'name_info' || l.link_type === 'info') &&
      (l.link_type === 'info' || l.linked_name.trim() === name.trim()),
  );
}

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const StructuredReagentGroup: React.FC<StructuredReagentGroupProps> = ({ group, headers, links, onAddAsItem, onUnlink, onNavigateToLinkedItem }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const sortedHeaders = [...headers].sort((a, b) => a.display_order - b.display_order);

  const hasVariantDetails = group.variants.length > 1 ||
    (group.variants.length === 1 && sortedHeaders.some(
      h => (group.variants[0].headerValues[h.display_order] || '').trim() !== ''
    ));

  const nameLink = group.isInfoOnly ? undefined : findNameLink(links, group.effectiveName);
  const hasVariantLinks = hasAnyVariantLink(links, group.effectiveName);
  const showNameAddButton = !nameLink && !hasVariantLinks && onAddAsItem && !group.isInfoOnly;

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div
        onClick={() => hasVariantDetails && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
          hasVariantDetails ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {hasVariantDetails ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
            )
          ) : (
            <div className="w-4 flex-shrink-0" />
          )}
          <Beaker className="h-4 w-4 text-blue-500 flex-shrink-0" />
          <span className="font-medium text-gray-900 truncate">{group.effectiveName}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {nameLink && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToLinkedItem?.(nameLink.item_id);
                }}
                className="inline-flex items-center gap-1 px-2 h-6 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium rounded-full hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                title="Go to linked inventory item"
              >
                <ExternalLink className="h-3 w-3" />
                <span>Linked</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlink?.(nameLink.id);
                }}
                className="inline-flex items-center gap-1 px-1.5 h-6 bg-red-50 border border-red-200 text-red-600 text-xs font-medium rounded-full hover:bg-red-100 hover:border-red-300 transition-colors"
                title="Unlink from inventory item"
              >
                <Unlink className="h-3 w-3" />
              </button>
            </>
          )}
          {showNameAddButton && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const firstVariantHeaders = group.variants[0]?.headerValues;
                onAddAsItem(group.effectiveName, null, 'name', group.totalCount, firstVariantHeaders);
              }}
              className="inline-flex items-center gap-1 px-2 h-6 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors text-xs"
              title="Add as inventory item (by name)"
            >
              <PackagePlus className="h-3.5 w-3.5" />
            </button>
          )}
          <span className="inline-flex items-center justify-center min-w-[28px] h-6 px-2 bg-blue-100 text-blue-700 text-sm font-semibold rounded-full">
            {group.totalCount}
          </span>
        </div>
      </div>

      {isExpanded && hasVariantDetails && (
        <div className="bg-gray-50/50 border-t border-gray-100">
          {group.variants.map((variant, idx) => {
            const filledHeaders = sortedHeaders.filter(
              h => (variant.headerValues[h.display_order] || '').trim() !== ''
            );
            const hasAnyDetail = filledHeaders.length > 0;
            const variantInfo = serializeVariantInfo(variant.headerValues, sortedHeaders);
            const variantLink = hasAnyDetail
              ? (group.isInfoOnly
                  ? findInfoOnlyLink(links, variantInfo)
                  : findInfoLink(links, group.effectiveName, variantInfo))
              : undefined;
            const showVariantAdd = !nameLink && hasAnyDetail && !variantLink && onAddAsItem;

            return (
              <div
                key={idx}
                className="flex items-center justify-between px-4 py-2.5 pl-14 border-b border-gray-100/50 last:border-b-0"
              >
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  {hasAnyDetail ? (
                    filledHeaders.map(h => {
                      const val = variant.headerValues[h.display_order];
                      const isDate = h.header_type === 'date' || h.header_type === 'expiration';
                      const isExpiration = h.header_type === 'expiration';

                      if (isDate) {
                        return (
                          <span
                            key={h.display_order}
                            className={`text-xs flex items-center gap-1 ${
                              isExpiration ? getExpirationColor(val) : 'text-gray-400'
                            }`}
                          >
                            {isExpiration && <CalendarClock className="h-3 w-3 flex-shrink-0" />}
                            <span className="text-gray-500 mr-1">{h.header_text}:</span>
                            {formatDate(val)}
                          </span>
                        );
                      }

                      return (
                        <span key={h.display_order} className="text-sm text-gray-600 truncate">
                          <span className="text-gray-400">{h.header_text}:</span>{' '}
                          {val}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-sm text-gray-400 italic">No additional details</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {variantLink && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToLinkedItem?.(variantLink.item_id);
                        }}
                        className="inline-flex items-center gap-0.5 px-1.5 h-5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-medium rounded-full hover:bg-emerald-100 hover:border-emerald-300 transition-colors"
                        title="Go to linked inventory item"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUnlink?.(variantLink.id);
                        }}
                        className="inline-flex items-center gap-0.5 px-1.5 h-5 bg-red-50 border border-red-200 text-red-600 text-[10px] font-medium rounded-full hover:bg-red-100 hover:border-red-300 transition-colors"
                        title="Unlink from inventory item"
                      >
                        <Unlink className="h-2.5 w-2.5" />
                      </button>
                    </>
                  )}
                  {showVariantAdd && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddAsItem!(
                          group.effectiveName,
                          variantInfo,
                          group.isInfoOnly ? 'info' : 'name_info',
                          variant.wellCount,
                          variant.headerValues,
                        );
                      }}
                      className="inline-flex items-center gap-0.5 px-1.5 h-5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                      title="Add as inventory item (by name + info)"
                    >
                      <PackagePlus className="h-3 w-3" />
                    </button>
                  )}
                  <span className="inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">
                    {variant.wellCount}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const StructuredContentSummary: React.FC<StructuredContentSummaryProps> = ({
  cellData,
  headers,
  slideValues,
  links = [],
  onAddAsItem,
  onUnlink,
  onNavigateToLinkedItem,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const summary = useMemo(
    () => computeStructuredBoxContentSummary(cellData, headers, slideValues),
    [cellData, headers, slideValues]
  );

  if (summary.groups.length === 0) {
    return (
      <div id="reagent-inventory" className="mt-6 bg-white rounded-2xl border border-gray-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-400" />
            )}
            <Package className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-900">Reagent Inventory</h3>
          </div>
          <span className="text-sm text-gray-500">0 reagents</span>
        </button>
        {isExpanded && (
          <div className="px-6 pb-6 pt-2">
            <div className="text-center py-8 text-gray-500">
              <Beaker className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>No reagents stored in this box</p>
              <p className="text-sm text-gray-400 mt-1">Add reagents by selecting cells and filling in the details</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="reagent-inventory" className="mt-6 bg-white rounded-2xl border border-gray-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
          <Package className="h-5 w-5 text-blue-500" />
          <h3 className="text-lg font-semibold text-gray-900">Reagent Inventory</h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {summary.totalUniqueReagents} reagent{summary.totalUniqueReagents !== 1 ? 's' : ''}
          </span>
          <span className="text-sm text-gray-400">|</span>
          <span className="text-sm text-gray-500">
            {summary.totalValidWells} well{summary.totalValidWells !== 1 ? 's' : ''}
          </span>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200">
          {summary.groups.map((group, idx) => (
            <StructuredReagentGroup
              key={idx}
              group={group}
              headers={headers}
              links={links}
              onAddAsItem={onAddAsItem}
              onUnlink={onUnlink}
              onNavigateToLinkedItem={onNavigateToLinkedItem}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default StructuredContentSummary;
