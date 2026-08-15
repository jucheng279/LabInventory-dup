import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Beaker, Package, CalendarClock, Unlink, PackagePlus, ExternalLink } from 'lucide-react';
import { CellData } from '../services/locationCellService';
import { computeBoxContentSummary, ContentGroup, getExpirationColor } from '../utils/cellDataUtils';
import { findNameLink, findInfoLink, findInfoOnlyLink, hasAnyVariantLink } from '../utils/linkMatchUtils';
import type { BoxGridItemLink, GridItemLinkType } from '../types/database';

interface ContentSummaryProps {
  cellData: Record<string, CellData>;
  links?: BoxGridItemLink[];
  onAddAsItem?: (name: string, info: string | null, linkType: GridItemLinkType, count: number, date?: string | null, dateType?: string) => void;
  onUnlink?: (linkId: string) => void;
  onNavigateToLinkedItem?: (itemId: string) => void;
}

const ReagentGroup: React.FC<ReagentGroupProps> = ({ group, links, onAddAsItem, onUnlink, onNavigateToLinkedItem }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMultipleVariants = group.variants.length > 1 ||
    (group.variants.length === 1 && (group.variants[0].information || group.variants[0].date));

  const infoOnlyLink = group.isInfoOnly
    ? findInfoOnlyLink(links, group.effectiveName, group.variants[0]?.date || null, group.variants[0]?.date_type || 'none')
    : undefined;
  const nameLink = group.isInfoOnly ? undefined : findNameLink(links, group.effectiveName);
  const activeLink = infoOnlyLink || nameLink;
  const hasVariantLinks = !group.isInfoOnly && hasAnyVariantLink(links, group.effectiveName);
  const showNameAddButton = !activeLink && !hasVariantLinks && onAddAsItem;

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div
        onClick={() => hasMultipleVariants && setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
          hasMultipleVariants ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {hasMultipleVariants ? (
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
          {activeLink && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToLinkedItem?.(activeLink.item_id);
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
                  onUnlink?.(activeLink.id);
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
                if (group.isInfoOnly) {
                  onAddAsItem(group.effectiveName, group.effectiveName, 'info', group.totalCount);
                } else {
                  onAddAsItem(group.effectiveName, null, 'name', group.totalCount);
                }
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

      {isExpanded && hasMultipleVariants && (
        <div className="bg-gray-50/50 border-t border-gray-100">
          {group.variants.map((variant, idx) => {
            const variantLink = variant.information
              ? findInfoLink(links, group.effectiveName, variant.information, variant.date || null, variant.date_type || 'none')
              : undefined;
            const showVariantAdd = !nameLink && variant.information && !variantLink && onAddAsItem;

            return (
              <div
                key={idx}
                className="flex items-center justify-between px-4 py-2.5 pl-14 border-b border-gray-100/50 last:border-b-0"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {variant.information && (
                    <span className="text-sm text-gray-600 truncate">{variant.information}</span>
                  )}
                  {variant.information && variant.date && (
                    <span className="text-gray-300 flex-shrink-0">|</span>
                  )}
                  {variant.date && (
                    <span className={`text-xs flex items-center gap-1 flex-shrink-0 whitespace-nowrap ${
                      variant.date_type === 'expiration' ? getExpirationColor(variant.date) : 'text-gray-400'
                    }`}>
                      {variant.date_type === 'expiration' && <CalendarClock className="h-3 w-3 flex-shrink-0" />}
                      {formatDate(variant.date)}
                    </span>
                  )}
                  {!variant.information && !variant.date && (
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
                        onAddAsItem!(group.effectiveName, variant.information, 'name_info', variant.wellCount, variant.date || null, variant.date_type || 'none');
                      }}
                      className="inline-flex items-center gap-0.5 px-1.5 h-5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
                      title="Add as inventory item (by name + info + date)"
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

const ContentSummary: React.FC<ContentSummaryProps> = ({
  cellData,
  links = [],
  onAddAsItem,
  onUnlink,
  onNavigateToLinkedItem,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const summary = useMemo(() => computeBoxContentSummary(cellData), [cellData]);

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
            <ReagentGroup
              key={idx}
              group={group}
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

export default ContentSummary;
