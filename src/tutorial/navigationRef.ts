import { createContext, useContext, type MutableRefObject } from 'react';

export type TutorialModal =
  | 'BoxTypeSelection'
  | { type: 'CreateBox'; boxType: 'freezer' | 'slide' | 'structured_freezer' };

export interface TutorialNavigation {
  selectLocation: (locationId: string) => void;
  openBox: (boxId: string, name: string, color: string | null, type: string) => void;
  backToWorkspace: () => void;
  openSearch: (query?: string) => void;
  setInitialFolder: (folderId: string) => void;
  showModal: (modal: TutorialModal) => void;
  closeAllModals: () => void;
}

export type TutorialNavigationRef = MutableRefObject<TutorialNavigation | null>;

const TutorialNavContext = createContext<TutorialNavigationRef | null>(null);

export const TutorialNavProvider = TutorialNavContext.Provider;

export function useTutorialNavRef(): TutorialNavigationRef | null {
  return useContext(TutorialNavContext);
}
