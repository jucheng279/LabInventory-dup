import React from 'react';
import type { SearchResults, DateFilter } from '../types/search';
import { getDateFilterLabel } from './DateFilterPicker';

interface SearchPagePrintViewProps {
  results: SearchResults;
  query: string;
  dateFilter: DateFilter | null;
  filterSummaryParts: string[];
  customFilters: string[];
  showDate: boolean;
  showDaysRemaining: boolean;
  slideHeaderFilters: string[];
  itemHeaderFilters: string[];
}

function formatDaysRemaining(dateValue: string): string | null {
  const target = new Date(dateValue + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return null;
  if (diff === 0) return 'today';
  if (diff === 1) return '1 day';
  return `${diff} days`;
}

const thClass = 'px-2 py-1.5 text-[9px] font-bold text-gray-700 uppercase tracking-wider border border-gray-300 bg-gray-100 text-left';
const tdClass = 'px-2 py-1.5 text-[10px] text-gray-800 border border-gray-200';
const tdMutedClass = 'px-2 py-1.5 text-[10px] text-gray-500 border border-gray-200';

const SearchPagePrintView: React.FC<SearchPagePrintViewProps> = ({
  results,
  query,
  dateFilter,
  filterSummaryParts,
  customFilters,
  showDate,
  showDaysRemaining,
  slideHeaderFilters,
  itemHeaderFilters,
}) => {
  const totalResults =
    results.cellMatches.length +
    results.structuredFreezerMatches.length +
    results.cellTitles.length +
    results.cellInfo.length +
    results.boxes.length +
    results.items.length +
    results.itemCustomValues.length +
    results.slideMatches.length +
    results.slideValues.length +
    results.slideHeaders.length;

  const hasResults = totalResults > 0;
  const timestamp = new Date().toLocaleString();
  const allFilterParts = [...filterSummaryParts, ...customFilters];
  const slideDataTitle = slideHeaderFilters.length === 1 ? `Slide Data -- ${slideHeaderFilters[0]}` : 'Slide Data';
  const itemDataTitle = itemHeaderFilters.length === 1 ? `Item Data -- ${itemHeaderFilters[0]}` : 'Item Data';

  return (
    <div className="print-only" style={{ width: '1000px', maxWidth: '1000px' }}>
      <div style={{ padding: '20px' }}>
        <div style={{ borderBottom: '2px solid #111', paddingBottom: '12px', marginBottom: '16px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#111', margin: 0 }}>Search Results</h1>
          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '11px', color: '#555' }}>
            {query && <span><strong>Query:</strong> {query}</span>}
            {dateFilter && <span><strong>Date Filter:</strong> {getDateFilterLabel(dateFilter)}</span>}
            {allFilterParts.length > 0 && <span><strong>Filters:</strong> {allFilterParts.join(', ')}</span>}
            <span><strong>Results:</strong> {totalResults}</span>
            {results.blockedCount > 0 && <span><strong>Hidden (restricted):</strong> {results.blockedCount}</span>}
            <span><strong>Printed:</strong> {timestamp}</span>
          </div>
        </div>

        {!hasResults && (
          <p style={{ textAlign: 'center', color: '#888', fontSize: '12px', padding: '40px 0' }}>No results to print.</p>
        )}

        {results.slideMatches.length > 0 && (
          <div style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
              Slide Matches ({results.slideMatches.length})
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={thClass}>Slide</th>
                  <th className={thClass}>Cell</th>
                  <th className={thClass}>Box</th>
                  <th className={thClass}>Position</th>
                  <th className={thClass}>Sublocation</th>
                  <th className={thClass}>Location</th>
                  {showDate && <th className={thClass}>Date</th>}
                </tr>
              </thead>
              <tbody>
                {results.slideMatches.map((r, i) => {
                  const days = showDate && showDaysRemaining && r.dateType === 'expiration' && r.dateValue
                    ? formatDaysRemaining(r.dateValue)
                    : null;
                  const primary = r.values[0]?.value || '';
                  const rest = r.values.slice(1).map((v) => `${v.headerText}: ${v.value}`).join(' | ');
                  return (
                    <tr key={i}>
                      <td className={tdClass}>
                        <div>{primary}</div>
                        {rest && <div style={{ color: '#777', fontSize: '9px' }}>{rest}</div>}
                      </td>
                      <td className={tdMutedClass} style={{ fontFamily: 'monospace' }}>{r.cellId}</td>
                      <td className={tdClass}>{r.boxName}</td>
                      <td className={tdMutedClass}>{r.positionName || '--'}</td>
                      <td className={tdMutedClass}>{r.sublocationName || '--'}</td>
                      <td className={tdMutedClass}>{r.locationName}</td>
                      {showDate && (
                        <td className={tdMutedClass}>
                          {r.dateValue ? `${r.dateValue}${days ? ` (${days})` : ''}` : '--'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {results.cellMatches.length > 0 && (
          <div style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
              Freezer Matches ({results.cellMatches.length})
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={thClass}>Content</th>
                  <th className={thClass}>Cell</th>
                  <th className={thClass}>Box</th>
                  <th className={thClass}>Position</th>
                  <th className={thClass}>Sublocation</th>
                  <th className={thClass}>Location</th>
                  {showDate && <th className={thClass}>Date</th>}
                </tr>
              </thead>
              <tbody>
                {results.cellMatches.map((r, i) => {
                  const days = showDate && showDaysRemaining && r.dateType === 'expiration' && r.dateValue
                    ? formatDaysRemaining(r.dateValue)
                    : null;
                  const primary = r.name || r.information || '';
                  const subtitle = r.name && r.information ? r.information : '';
                  return (
                    <tr key={i}>
                      <td className={tdClass}>
                        <div>{primary}</div>
                        {subtitle && <div style={{ color: '#777', fontSize: '9px', fontStyle: 'italic' }}>{subtitle}</div>}
                      </td>
                      <td className={tdMutedClass} style={{ fontFamily: 'monospace' }}>{r.cellId}</td>
                      <td className={tdClass}>{r.boxName}</td>
                      <td className={tdMutedClass}>{r.positionName || '--'}</td>
                      <td className={tdMutedClass}>{r.sublocationName || '--'}</td>
                      <td className={tdMutedClass}>{r.locationName}</td>
                      {showDate && (
                        <td className={tdMutedClass}>
                          {r.dateValue ? `${r.dateValue}${days ? ` (${days})` : ''}` : '--'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {results.structuredFreezerMatches.length > 0 && (
          <div style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
              Structured Freezer Matches ({results.structuredFreezerMatches.length})
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={thClass}>Content</th>
                  <th className={thClass}>Cell</th>
                  <th className={thClass}>Box</th>
                  <th className={thClass}>Position</th>
                  <th className={thClass}>Sublocation</th>
                  <th className={thClass}>Location</th>
                  {showDate && <th className={thClass}>Date</th>}
                </tr>
              </thead>
              <tbody>
                {results.structuredFreezerMatches.map((r, i) => {
                  const days = showDate && showDaysRemaining && r.dateType === 'expiration' && r.dateValue
                    ? formatDaysRemaining(r.dateValue)
                    : null;
                  const primary = r.name || r.values[0]?.value || r.information || '';
                  const infoLine = r.name && r.information ? r.information : '';
                  const columnValues = r.values.filter(v => v.value && v.value !== primary);
                  return (
                    <tr key={i}>
                      <td className={tdClass}>
                        <div>{primary}</div>
                        {infoLine && <div style={{ color: '#777', fontSize: '9px', fontStyle: 'italic' }}>{infoLine}</div>}
                        {columnValues.length > 0 && (
                          <div style={{ color: '#777', fontSize: '9px' }}>
                            {columnValues.map((v) => `${v.headerText}: ${v.value}`).join(' | ')}
                          </div>
                        )}
                      </td>
                      <td className={tdMutedClass} style={{ fontFamily: 'monospace' }}>{r.cellId}</td>
                      <td className={tdClass}>{r.boxName}</td>
                      <td className={tdMutedClass}>{r.positionName || '--'}</td>
                      <td className={tdMutedClass}>{r.sublocationName || '--'}</td>
                      <td className={tdMutedClass}>{r.locationName}</td>
                      {showDate && (
                        <td className={tdMutedClass}>
                          {r.dateValue ? `${r.dateValue}${days ? ` (${days})` : ''}` : '--'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}


        {results.structuredFreezerMatches.length > 0 && (
          <div style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
              Structured Freezer Matches ({results.structuredFreezerMatches.length})
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={thClass}>Content</th>
                  <th className={thClass}>Cell</th>
                  <th className={thClass}>Box</th>
                  <th className={thClass}>Position</th>
                  <th className={thClass}>Sublocation</th>
                  <th className={thClass}>Location</th>
                  {showDate && <th className={thClass}>Date</th>}
                </tr>
              </thead>
              <tbody>
                {results.structuredFreezerMatches.map((r, i) => {
                  const days = showDate && showDaysRemaining && r.dateType === 'expiration' && r.dateValue
                    ? formatDaysRemaining(r.dateValue)
                    : null;
                  const primary = r.name || r.values[0]?.value || r.information || '';
                  const infoLine = r.name && r.information ? r.information : '';
                  const columnValues = r.values.filter(v => v.value && v.value !== primary);
                  return (
                    <tr key={i}>
                      <td className={tdClass}>
                        <div>{primary}</div>
                        {infoLine && <div style={{ color: '#777', fontSize: '9px', fontStyle: 'italic' }}>{infoLine}</div>}
                        {columnValues.length > 0 && (
                          <div style={{ color: '#777', fontSize: '9px' }}>
                            {columnValues.map((v) => `${v.headerText}: ${v.value}`).join(' | ')}
                          </div>
                        )}
                      </td>
                      <td className={tdMutedClass} style={{ fontFamily: 'monospace' }}>{r.cellId}</td>
                      <td className={tdClass}>{r.boxName}</td>
                      <td className={tdMutedClass}>{r.positionName || '--'}</td>
                      <td className={tdMutedClass}>{r.sublocationName || '--'}</td>
                      <td className={tdMutedClass}>{r.locationName}</td>
                      {showDate && (
                        <td className={tdMutedClass}>
                          {r.dateValue ? `${r.dateValue}${days ? ` (${days})` : ''}` : '--'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {results.slideValues.length > 0 && (
          <div style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
              {slideDataTitle} ({results.slideValues.length})
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={thClass}>Value</th>
                  <th className={thClass}>Column</th>
                  <th className={thClass}>Cell</th>
                  <th className={thClass}>Box</th>
                  <th className={thClass}>Position</th>
                  <th className={thClass}>Sublocation</th>
                  <th className={thClass}>Location</th>
                  {showDate && <th className={thClass}>Date</th>}
                </tr>
              </thead>
              <tbody>
                {results.slideValues.map((r, i) => {
                  const days = showDate && showDaysRemaining && r.dateType === 'expiration' && r.dateValue
                    ? formatDaysRemaining(r.dateValue)
                    : null;
                  return (
                    <tr key={i}>
                      <td className={tdClass}>{r.matchedValue}</td>
                      <td className={tdMutedClass}>{r.headerText}</td>
                      <td className={tdMutedClass} style={{ fontFamily: 'monospace' }}>{r.cellId}</td>
                      <td className={tdClass}>{r.boxName}</td>
                      <td className={tdMutedClass}>{r.positionName || '--'}</td>
                      <td className={tdMutedClass}>{r.sublocationName || '--'}</td>
                      <td className={tdMutedClass}>{r.locationName}</td>
                      {showDate && (
                        <td className={tdMutedClass}>
                          {r.dateValue ? `${r.dateValue}${days ? ` (${days})` : ''}` : '--'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {results.itemCustomValues.length > 0 && (
          <div style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
              {itemDataTitle} ({results.itemCustomValues.length})
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={thClass}>Value</th>
                  <th className={thClass}>Column</th>
                  <th className={thClass}>Item</th>
                  <th className={thClass}>Folder</th>
                  <th className={thClass}>Position</th>
                  <th className={thClass}>Sublocation</th>
                  <th className={thClass}>Location</th>
                </tr>
              </thead>
              <tbody>
                {results.itemCustomValues.map((r, i) => (
                  <tr key={i}>
                    <td className={tdClass}>{r.matchedValue}</td>
                    <td className={tdMutedClass}>{r.headerText}</td>
                    <td className={tdClass}>{r.itemName}</td>
                    <td className={tdMutedClass}>{r.folderName}</td>
                    <td className={tdMutedClass}>{r.positionName || '--'}</td>
                    <td className={tdMutedClass}>{r.sublocationName || '--'}</td>
                    <td className={tdMutedClass}>{r.locationName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {results.cellTitles.length > 0 && (
          <PrintCellTable
            title="Cell Titles"
            results={results.cellTitles}
            showDate={showDate}
            showDaysRemaining={showDaysRemaining}
          />
        )}

        {results.cellInfo.length > 0 && (
          <PrintCellTable
            title="Cell Info"
            results={results.cellInfo}
            showDate={showDate}
            showDaysRemaining={showDaysRemaining}
          />
        )}

        {results.slideHeaders.length > 0 && (
          <div style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
              Slide Headers ({results.slideHeaders.length})
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={thClass}>Header</th>
                  <th className={thClass}>Box</th>
                  <th className={thClass}>Position</th>
                  <th className={thClass}>Sublocation</th>
                  <th className={thClass}>Location</th>
                </tr>
              </thead>
              <tbody>
                {results.slideHeaders.map((r, i) => (
                  <tr key={i}>
                    <td className={tdClass}>{r.headerText}</td>
                    <td className={tdClass}>{r.boxName}</td>
                    <td className={tdMutedClass}>{r.positionName || '--'}</td>
                    <td className={tdMutedClass}>{r.sublocationName || '--'}</td>
                    <td className={tdMutedClass}>{r.locationName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {results.boxes.length > 0 && (
          <div style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
              Boxes ({results.boxes.length})
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={thClass}>Box Name</th>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Position</th>
                  <th className={thClass}>Sublocation</th>
                  <th className={thClass}>Location</th>
                </tr>
              </thead>
              <tbody>
                {results.boxes.map((r, i) => (
                  <tr key={i}>
                    <td className={tdClass}>{r.boxName}</td>
                    <td className={tdMutedClass}>{r.boxType === 'slide' ? 'Slide' : 'Freezer'}</td>
                    <td className={tdMutedClass}>{r.positionName || '--'}</td>
                    <td className={tdMutedClass}>{r.sublocationName || '--'}</td>
                    <td className={tdMutedClass}>{r.locationName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {results.items.length > 0 && (
          <div style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
              Items ({results.items.length})
            </h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th className={thClass}>Item Name</th>
                  <th className={thClass}>Type</th>
                  <th className={thClass}>Folder</th>
                  <th className={thClass}>Position</th>
                  <th className={thClass}>Sublocation</th>
                  <th className={thClass}>Location</th>
                </tr>
              </thead>
              <tbody>
                {results.items.map((r, i) => (
                  <tr key={i}>
                    <td className={tdClass}>{r.itemName}</td>
                    <td className={tdMutedClass}>{r.itemType}</td>
                    <td className={tdMutedClass}>{r.folderName}</td>
                    <td className={tdMutedClass}>{r.positionName || '--'}</td>
                    <td className={tdMutedClass}>{r.sublocationName || '--'}</td>
                    <td className={tdMutedClass}>{r.locationName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

interface PrintCellTableProps {
  title: string;
  results: SearchResults['cellTitles'];
  showDate: boolean;
  showDaysRemaining: boolean;
}

const PrintCellTable: React.FC<PrintCellTableProps> = ({ title, results, showDate, showDaysRemaining }) => (
  <div style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
    <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '6px' }}>
      {title} ({results.length})
    </h2>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th className={thClass}>Content</th>
          <th className={thClass}>Cell</th>
          <th className={thClass}>Box</th>
          <th className={thClass}>Position</th>
          <th className={thClass}>Sublocation</th>
          <th className={thClass}>Location</th>
          {showDate && <th className={thClass}>Date</th>}
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => {
          const days = showDate && showDaysRemaining && r.dateType === 'expiration' && r.dateValue
            ? formatDaysRemaining(r.dateValue)
            : null;
          return (
            <tr key={i}>
              <td className={tdClass}>{r.cellContent}</td>
              <td className={tdMutedClass} style={{ fontFamily: 'monospace' }}>{r.cellId}</td>
              <td className={tdClass}>{r.boxName}</td>
              <td className={tdMutedClass}>{r.positionName || '--'}</td>
              <td className={tdMutedClass}>{r.sublocationName || '--'}</td>
              <td className={tdMutedClass}>{r.locationName}</td>
              {showDate && (
                <td className={tdMutedClass}>
                  {r.dateValue ? `${r.dateValue}${days ? ` (${days})` : ''}` : '--'}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

export default SearchPagePrintView;
