import { useEffect, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, SkipForward, CheckCircle2 } from 'lucide-react';
import { useTutorial } from '../../tutorial/TutorialContext';
import { attachStepValidator, getTargetRect, getTargetElement } from '../../tutorial/validationEngine';
import { executeStepEnterEffect } from '../../tutorial/stepEffects';
import type { TooltipPosition } from '../../tutorial/types';

interface TooltipCoords {
  top: number;
  left: number;
  arrowPosition: 'top' | 'bottom' | 'left' | 'right';
}

function computeTooltipPosition(
  targetRect: DOMRect,
  preferred: TooltipPosition = 'auto',
  tooltipWidth: number = 320,
  tooltipHeight: number = 180
): TooltipCoords {
  const padding = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let position = preferred;
  if (position === 'auto') {
    const spaceBelow = vh - targetRect.bottom;
    const spaceAbove = targetRect.top;
    const spaceRight = vw - targetRect.right;
    const spaceLeft = targetRect.left;

    if (spaceBelow >= tooltipHeight + padding) position = 'bottom';
    else if (spaceAbove >= tooltipHeight + padding) position = 'top';
    else if (spaceRight >= tooltipWidth + padding) position = 'right';
    else if (spaceLeft >= tooltipWidth + padding) position = 'left';
    else position = 'bottom';
  }

  switch (position) {
    case 'bottom':
      return {
        top: targetRect.bottom + padding,
        left: Math.max(padding, Math.min(targetRect.left + targetRect.width / 2 - tooltipWidth / 2, vw - tooltipWidth - padding)),
        arrowPosition: 'top',
      };
    case 'top':
      return {
        top: targetRect.top - tooltipHeight - padding,
        left: Math.max(padding, Math.min(targetRect.left + targetRect.width / 2 - tooltipWidth / 2, vw - tooltipWidth - padding)),
        arrowPosition: 'bottom',
      };
    case 'right':
      return {
        top: Math.max(padding, Math.min(targetRect.top + targetRect.height / 2 - tooltipHeight / 2, vh - tooltipHeight - padding)),
        left: targetRect.right + padding,
        arrowPosition: 'left',
      };
    case 'left':
      return {
        top: Math.max(padding, Math.min(targetRect.top + targetRect.height / 2 - tooltipHeight / 2, vh - tooltipHeight - padding)),
        left: targetRect.left - tooltipWidth - padding,
        arrowPosition: 'right',
      };
  }
}

export default function TutorialOverlay() {
  const { state, currentLesson, currentStep, totalSteps, nextStep, skipStep, exitTutorial, openHub, isLessonComplete } = useTutorial();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevStepIdRef = useRef<string | null>(null);

  const updateTargetRect = useCallback(() => {
    if (!currentStep) {
      setTargetRect(null);
      return;
    }
    const rect = getTargetRect(currentStep.targetId);
    setTargetRect(rect);
  }, [currentStep]);

  useEffect(() => {
    if (!state.isActive || !currentStep) return;
    updateTargetRect();
    pollRef.current = setInterval(updateTargetRect, 500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [state.isActive, currentStep, updateTargetRect]);

  useEffect(() => {
    if (!state.isActive || !currentStep) return;

    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    if (prevStepIdRef.current && prevStepIdRef.current !== currentStep.id) {
      const el = getTargetElement(currentStep.targetId);
      if (el) {
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    }
    prevStepIdRef.current = currentStep.id;

    executeStepEnterEffect(currentStep.id).catch(() => {});

    const cleanup = attachStepValidator(
      currentStep.targetId,
      currentStep.action,
      currentStep.expectedValue,
      () => {
        nextStep();
      }
    );
    cleanupRef.current = cleanup;

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [state.isActive, currentStep, nextStep]);

  useEffect(() => {
    if (isLessonComplete && state.isActive) {
      setShowComplete(true);
    } else {
      setShowComplete(false);
    }
  }, [isLessonComplete, state.isActive]);

  if (!state.isActive) return null;

  if (showComplete) {
    return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md mx-4 text-center animate-in fade-in zoom-in duration-300">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Lesson Complete!</h2>
          <p className="text-gray-600 mb-6">
            You have finished <span className="font-semibold text-gray-900">{currentLesson?.title}</span>.
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={exitTutorial}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
            >
              Exit Tutorial
            </button>
            <button
              onClick={() => {
                setShowComplete(false);
                exitTutorial();
                setTimeout(() => {
                  openHub();
                }, 100);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              More Lessons
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (!currentStep) return null;

  const tooltipWidth = 340;
  const tooltipHeight = 160;
  const coords = targetRect
    ? computeTooltipPosition(targetRect, currentStep.tooltipPosition, tooltipWidth, tooltipHeight)
    : { top: window.innerHeight / 2 - 80, left: window.innerWidth / 2 - 170, arrowPosition: 'top' as const };

  return createPortal(
    <>
      {/* Spotlight overlay */}
      <div className="fixed inset-0 z-[9990] pointer-events-none">
        {targetRect && (
          <div
            className="absolute inset-0 transition-all duration-300"
            style={{
              boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.55), 0 0 0 2px rgba(59, 130, 246, 0.7) inset`,
              borderRadius: '8px',
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
            }}
          />
        )}
      </div>

      {/* Click blocker with target hole */}
      <div
        className="fixed inset-0 z-[9989]"
        style={{
          clipPath: targetRect
            ? `polygon(0% 0%, 0% 100%, ${targetRect.left - 4}px 100%, ${targetRect.left - 4}px ${targetRect.top - 4}px, ${targetRect.right + 4}px ${targetRect.top - 4}px, ${targetRect.right + 4}px ${targetRect.bottom + 4}px, ${targetRect.left - 4}px ${targetRect.bottom + 4}px, ${targetRect.left - 4}px 100%, 100% 100%, 100% 0%)`
            : undefined,
        }}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[9991] animate-in fade-in slide-in-from-bottom-2 duration-200"
        style={{ top: coords.top, left: coords.left, width: tooltipWidth }}
      >
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white/90 text-xs font-medium">
                {currentLesson?.title}
              </span>
              <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                {state.currentStepIndex + 1}/{totalSteps}
              </span>
            </div>
            <button
              onClick={exitTutorial}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1 bg-blue-100">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${((state.currentStepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-4">
            <p className="text-gray-800 text-sm leading-relaxed mb-3">
              {currentStep.instruction}
            </p>

            {/* Actions */}
            <div className="flex items-center justify-end pt-1">
              <button
                onClick={skipStep}
                className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded flex items-center gap-1 transition-colors"
                title="Skip this step"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Skip
              </button>
            </div>
          </div>
        </div>

        {/* Pulse indicator on target */}
        {targetRect && (
          <div
            className="fixed rounded-lg pointer-events-none animate-pulse"
            style={{
              top: targetRect.top - 4,
              left: targetRect.left - 4,
              width: targetRect.width + 8,
              height: targetRect.height + 8,
              border: '2px solid rgba(59, 130, 246, 0.5)',
              zIndex: 9992,
            }}
          />
        )}
      </div>
    </>,
    document.body
  );
}
