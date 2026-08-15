export type TutorialActionType = 'click' | 'type' | 'select' | 'submit' | 'navigate';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export interface TutorialStep {
  id: string;
  instruction: string;
  targetId: string;
  action: TutorialActionType;
  expectedValue?: string;
  tooltipPosition?: TooltipPosition;
}

export type LessonCategory = 'freezerBox';

export interface TutorialLesson {
  id: string;
  title: string;
  description: string;
  category: LessonCategory;
  icon: string;
  steps: TutorialStep[];
  estimatedMinutes: number;
}

export interface TutorialState {
  isActive: boolean;
  currentLessonId: string | null;
  currentStepIndex: number;
  showHub: boolean;
}

export const LESSON_CATEGORIES: Record<LessonCategory, { label: string; description: string }> = {
  freezerBox: { label: 'Freezer Boxes', description: 'Grid-based sample storage' },
};
