import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { computeFittedFontSize, computeFittedFontSizeMultiline } from '../utils/autoFitTextUtils';

interface BoxLabelProps {
  ref?: React.Ref<HTMLDivElement>;
  workspaceName: string;
  boxName: string;
  boxRows: number;
  boxColumns: number;
  boxDescription: string;
  deepLinkUrl: string;
}

const LABEL_WIDTH = 680;
const LABEL_HEIGHT = 383;
const PADDING = 22;
const GAP = 12;
const LEFT_COL_FRACTION = 0.55;
const BOX_NAME_MAX_FONT = 48;
const BOX_NAME_AVAILABLE_WIDTH = (LABEL_WIDTH - PADDING * 2) * LEFT_COL_FRACTION - GAP;

const SECTION_LABEL_FONT = 28;
const SECTION_LABEL_LINE_HEIGHT = 1.2;
const SECTION_LABEL_MB = 2;
const BOX_NAME_LINE_HEIGHT = 1.1;
const DIMENSIONS_FONT = 38;
const DIMENSIONS_LINE_HEIGHT = 1.2;
const DESC_MAX_FONT = 34;
const DESC_LINE_HEIGHT = 1.4;
const SECTION_GAP = 8;
const WORKSPACE_FONT = 48;
const WORKSPACE_LINE_HEIGHT = 1.1;
const WORKSPACE_MB = 10;

function computeDescriptionAvailableHeight(boxName: string, hasDescription: boolean): number {
  if (!hasDescription) return 0;
  const contentHeight = LABEL_HEIGHT - PADDING * 2;
  const workspaceHeight = WORKSPACE_FONT * WORKSPACE_LINE_HEIGHT + WORKSPACE_MB;
  const leftColHeight = contentHeight - workspaceHeight;

  const boxNameFontSize = computeFittedFontSize(boxName, BOX_NAME_MAX_FONT, BOX_NAME_AVAILABLE_WIDTH, 600);
  const boxNameSection = SECTION_LABEL_FONT * SECTION_LABEL_LINE_HEIGHT + SECTION_LABEL_MB + boxNameFontSize * BOX_NAME_LINE_HEIGHT;
  const dimensionsSection = SECTION_LABEL_FONT * SECTION_LABEL_LINE_HEIGHT + SECTION_LABEL_MB + DIMENSIONS_FONT * DIMENSIONS_LINE_HEIGHT;
  const descLabelHeight = SECTION_LABEL_FONT * SECTION_LABEL_LINE_HEIGHT + SECTION_LABEL_MB;

  const usedHeight = boxNameSection + SECTION_GAP + dimensionsSection + SECTION_GAP + descLabelHeight;
  return Math.max(0, leftColHeight - usedHeight);
}

function BoxLabel({ ref, workspaceName, boxName, boxRows, boxColumns, boxDescription, deepLinkUrl }: BoxLabelProps) {
    return (
      <div
        ref={ref}
        style={{
          width: LABEL_WIDTH,
          height: LABEL_HEIGHT,
          padding: PADDING,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          backgroundColor: '#ffffff',
          border: '2px solid #e5e7eb',
          borderRadius: 8,
          boxSizing: 'border-box',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: WORKSPACE_FONT,
            fontWeight: 700,
            color: '#111827',
            marginBottom: WORKSPACE_MB,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: WORKSPACE_LINE_HEIGHT,
          }}
        >
          {workspaceName}
        </div>

        <div style={{ display: 'flex', flex: 1, gap: GAP, minHeight: 0 }}>
          <div
            style={{
              flex: '1 1 55%',
              display: 'flex',
              flexDirection: 'column',
              gap: SECTION_GAP,
              overflow: 'hidden',
            }}
          >
            <div>
              <div style={{ fontSize: SECTION_LABEL_FONT, color: '#9ca3af', marginBottom: SECTION_LABEL_MB, textTransform: 'uppercase', letterSpacing: '0.025em', lineHeight: SECTION_LABEL_LINE_HEIGHT }}>
                Box Name
              </div>
              <div style={{ fontSize: computeFittedFontSize(boxName, BOX_NAME_MAX_FONT, BOX_NAME_AVAILABLE_WIDTH, 600), fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', lineHeight: 1.1 }}>
                {boxName}
              </div>
            </div>

            <div>
              <div style={{ fontSize: SECTION_LABEL_FONT, color: '#9ca3af', marginBottom: SECTION_LABEL_MB, textTransform: 'uppercase', letterSpacing: '0.025em', lineHeight: SECTION_LABEL_LINE_HEIGHT }}>
                Dimensions
              </div>
              <div style={{ fontSize: DIMENSIONS_FONT, color: '#374151', lineHeight: DIMENSIONS_LINE_HEIGHT }}>
                {boxRows} &times; {boxColumns}
              </div>
            </div>

            {boxDescription && (
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <div style={{ fontSize: SECTION_LABEL_FONT, color: '#9ca3af', marginBottom: SECTION_LABEL_MB, textTransform: 'uppercase', letterSpacing: '0.025em', lineHeight: SECTION_LABEL_LINE_HEIGHT }}>
                  Description
                </div>
                <div
                  style={{
                    fontSize: computeFittedFontSizeMultiline(
                      boxDescription,
                      DESC_MAX_FONT,
                      BOX_NAME_AVAILABLE_WIDTH,
                      computeDescriptionAvailableHeight(boxName, true),
                      400,
                      DESC_LINE_HEIGHT
                    ),
                    color: '#374151',
                    lineHeight: DESC_LINE_HEIGHT,
                    wordBreak: 'break-word',
                    overflow: 'hidden',
                  }}
                >
                  {boxDescription}
                </div>
              </div>
            )}
          </div>

          <div
            style={{
              flex: '0 0 42%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <QRCodeSVG
              value={deepLinkUrl}
              size={190}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>
      </div>
    );
}

export default BoxLabel;
