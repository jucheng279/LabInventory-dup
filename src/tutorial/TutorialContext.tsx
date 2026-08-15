import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TutorialState, TutorialLesson, TutorialStep } from './types';
import { getLessonById, tutorialLessons } from './lessonDefinitions';
import { getTutorialSeedData, TUTORIAL_LOCATION_ID } from './mockData';
import { TutorialNavProvider, type TutorialNavigationRef, type TutorialNavigation } from './navigationRef';
import { TutorialSupabaseMock } from './tutorialSupabaseMock';
import { setTutorialMock, clearTutorialMock } from '../lib/supabase';
import { executeSkipAction } from './stepEffects';

interface TutorialContextValue {
  state: TutorialState;
  currentLesson: TutorialLesson | null;
  currentStep: TutorialStep | null;
  totalSteps: number;
  openHub: () => void;
  closeHub: () => void;
  startLesson: (lessonId: string) => void;
  nextStep: () => void;
  exitTutorial: () => void;
  skipStep: () => void;
  isLessonComplete: boolean;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function TutorialProvider({ children, navigationRef }: { children: ReactNode; navigationRef: TutorialNavigationRef }) {
  const [state, setState] = useState<TutorialState>({
    isActive: false,
    currentLessonId: null,
    currentStepIndex: 0,
    showHub: false,
  });

  const tutorialQueryClientRef = useRef<QueryClient | null>(null);
  const tutorialMockRef = useRef<TutorialSupabaseMock | null>(null);
  const skippingRef = useRef(false);

  const currentLesson = state.currentLessonId ? getLessonById(state.currentLessonId) ?? null : null;
  const currentStep = currentLesson ? currentLesson.steps[state.currentStepIndex] ?? null : null;
  const totalSteps = currentLesson ? currentLesson.steps.length : 0;
  const isLessonComplete = currentLesson ? state.currentStepIndex >= currentLesson.steps.length : false;

  const getNav = useCallback((): TutorialNavigation | null => {
    return navigationRef.current;
  }, [navigationRef]);

  const openHub = useCallback(() => {
    setState((s) => ({ ...s, showHub: true }));
  }, []);

  const closeHub = useCallback(() => {
    setState((s) => ({ ...s, showHub: false }));
  }, []);

  const startLesson = useCallback((lessonId: string) => {
    const lesson = getLessonById(lessonId);
    if (!lesson) return;

    const seedData = getTutorialSeedData(lessonId);
    const mock = new TutorialSupabaseMock(seedData);
    tutorialMockRef.current = mock;
    setTutorialMock(mock);

    const qc = new QueryClient({
      defaultOptions: {
        queries: { retry: false, refetchOnWindowFocus: false },
      },
    });
    tutorialQueryClientRef.current = qc;

    setState({
      isActive: true,
      currentLessonId: lessonId,
      currentStepIndex: 0,
      showHub: false,
    });

    const nav = getNav();
    if (nav) {
      nav.backToWorkspace();
      if (lessonId === 'freezer-box-basics') {
        nav.selectLocation(TUTORIAL_LOCATION_ID);
      }
    }
  }, [getNav]);

  const nextStep = useCallback(() => {
    setState((s) => {
      if (!s.currentLessonId) return s;
      return { ...s, currentStepIndex: s.currentStepIndex + 1 };
    });
  }, []);


  const skipStep = useCallback(async () => {
    if (skippingRef.current) return;
    const nav = getNav();
    if (!currentStep || !nav) {
      nextStep();
      return;
    }

    skippingRef.current = true;
    try {
      await executeSkipAction(currentStep.id, nav);
    } catch (e) {
      console.warn('[Tutorial] Skip action failed:', e);
    }
    skippingRef.current = false;

    setState((s) => {
      if (!s.currentLessonId) return s;
      return { ...s, currentStepIndex: s.currentStepIndex + 1 };
    });
  }, [currentStep, getNav, nextStep]);

  const exitTutorial = useCallback(() => {
    const nav = getNav();
    if (nav) {
      nav.closeAllModals();
      nav.backToWorkspace();
    }
    if (tutorialMockRef.current) {
      tutorialMockRef.current.destroy();
      tutorialMockRef.current = null;
    }
    clearTutorialMock();
    if (tutorialQueryClientRef.current) {
      tutorialQueryClientRef.current.clear();
      tutorialQueryClientRef.current = null;
    }
    setState({
      isActive: false,
      currentLessonId: null,
      currentStepIndex: 0,
      showHub: false,
    });
  }, [getNav]);

  const contextValue: TutorialContextValue = {
    state,
    currentLesson,
    currentStep,
    totalSteps,
    openHub,
    closeHub,
    startLesson,
    nextStep,
    exitTutorial,
    skipStep,
    isLessonComplete,
  };

  const content = state.isActive && tutorialQueryClientRef.current ? (
    <TutorialContext.Provider value={contextValue}>
      <QueryClientProvider client={tutorialQueryClientRef.current}>
        {children}
      </QueryClientProvider>
    </TutorialContext.Provider>
  ) : (
    <TutorialContext.Provider value={contextValue}>
      {children}
    </TutorialContext.Provider>
  );

  return (
    <TutorialNavProvider value={navigationRef}>
      {content}
    </TutorialNavProvider>
  );
}

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutorial must be used within TutorialProvider');
  return ctx;
}

export { tutorialLessons };
