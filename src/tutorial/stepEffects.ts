import type { TutorialNavigation } from './navigationRef';
import { clickTarget, fillTarget, delay, waitForTarget } from './tutorialDomActions';
import { TUTORIAL_BOX_ID, TUTORIAL_LOCATION_ID } from './mockData';
import { getClient } from '../lib/supabase';

export async function executeStepEnterEffect(_stepId: string): Promise<void> {
}

export async function executeSkipAction(stepId: string, nav: TutorialNavigation): Promise<void> {
  switch (stepId) {
    case 'fb-1':
      await clickTarget('workspace-add-box-btn');
      break;

    case 'fb-2':
      await clickTarget('box-type-continue-btn');
      break;

    case 'fb-3':
      await fillTarget('create-box-name-input', 'Sample Box 1');
      break;

    case 'fb-4':
      await clickTarget('create-box-save-btn');
      await delay(200);
      await waitForTarget('workspace-box-card-tutorial', 3000).catch(() => {});
      break;

    case 'fb-5': {
      const client = getClient();
      const { data: existing } = await client
        .from('boxes')
        .select('id')
        .eq('id', TUTORIAL_BOX_ID)
        .maybeSingle();
      if (!existing) {
        await client.from('boxes').insert({
          id: TUTORIAL_BOX_ID,
          name: 'Sample Box 1',
          location_id: TUTORIAL_LOCATION_ID,
          rows: 8,
          columns: 12,
          box_type: 'freezer',
          accent_color: null,
          description: '',
        });
      }
      nav.openBox(TUTORIAL_BOX_ID, 'Sample Box 1', null, 'freezer');
      await delay(100);
      break;
    }

    case 'fb-6':
      await clickTarget('grid-cell-A1');
      break;

    case 'fb-7':
      await fillTarget('input-name-field', 'HeLa');
      break;

    case 'fb-8':
      await fillTarget('input-info-field', '2M\n30% FBS');
      break;

    case 'fb-9':
      await clickTarget('input-date-type-date');
      break;

    case 'fb-10': {
      const today = new Date().toISOString().split('T')[0];
      await fillTarget('input-date-field', today);
      break;
    }

    case 'fb-11':
      await clickTarget('input-save-btn');
      await delay(150);
      break;

    case 'fb-12':
      await clickTarget('grid-cell-B1');
      break;

    case 'fb-13':
      await fillTarget('input-info-field', 'Alexa 488');
      break;

    case 'fb-14':
      await clickTarget('input-date-type-expiration');
      break;

    case 'fb-15': {
      const today = new Date().toISOString().split('T')[0];
      await fillTarget('input-date-field', today);
      break;
    }

    case 'fb-16':
      await clickTarget('color-swatch-red');
      break;

    case 'fb-17':
      await clickTarget('input-save-btn');
      await delay(150);
      break;

    case 'fb-18':
      await clickTarget('grid-cell-C1');
      break;

    case 'fb-19':
      await fillTarget('input-info-field', 'BSA');
      break;

    case 'fb-20':
      await clickTarget('input-save-btn');
      await delay(150);
      break;

    case 'fb-21':
      await clickTarget('grid-cell-B1');
      break;

    case 'fb-22':
      await clickTarget('input-cross-btn');
      await delay(100);
      break;

    case 'fb-23':
      await clickTarget('grid-cell-B1');
      break;

    case 'fb-24':
      await clickTarget('input-save-btn');
      await delay(150);
      break;

    case 'fb-25':
      await clickTarget('grid-cell-B1');
      break;

    case 'fb-26':
      await clickTarget('input-clear-btn');
      await delay(150);
      break;

    case 'fb-27':
      await clickTarget('grid-cell-A3');
      break;

    case 'fb-28':
      await clickTarget('input-save-btn');
      await delay(150);
      break;

    case 'fb-29':
      await clickTarget('grid-cell-A4');
      break;

    case 'fb-30':
      await fillTarget('input-info-field', '2M');
      break;

    case 'fb-31':
      await clickTarget('input-save-btn');
      await delay(150);
      break;

    case 'fb-32':
      await clickTarget('grid-cell-A1');
      break;

    case 'fb-33':
      await fillTarget('input-name-field', 'HeLa GFP+');
      break;

    case 'fb-34':
      await clickTarget('input-save-btn');
      await delay(150);
      break;
  }
}
