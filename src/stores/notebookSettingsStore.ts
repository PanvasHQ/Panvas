import { create } from 'zustand';
import { settingsRepository } from '@/repositories/SettingsRepository';
import type { PageTemplate, ScrollDirection } from '@/components/notebook/engine/drawingTypes';

export type PaperColorOption = string;
export type PageTemplateOption = PageTemplate;
export type PageOrientationOption = 'Portrait' | 'Landscape';
export type PageSizeOption = 'A3' | 'A4' | 'A5' | 'Letter';
export type PageMarginOption = 'No Margin' | 'Narrow' | 'Normal' | 'Wide';

interface NotebookSettingsState {
  paperColor: PaperColorOption;
  template: PageTemplateOption;
  orientation: PageOrientationOption;
  pageSize: PageSizeOption;
  margins: PageMarginOption;
  scrollDirection: ScrollDirection;
  
  setPaperColor: (color: PaperColorOption) => void;
  setTemplate: (template: PageTemplateOption) => void;
  setOrientation: (orientation: PageOrientationOption) => void;
  setPageSize: (size: PageSizeOption) => void;
  setMargins: (margins: PageMarginOption) => void;
  setScrollDirection: (scrollDirection: ScrollDirection) => void;
  hydrateSettings: (settings: Record<string, unknown>) => void;
  loadSettings: () => Promise<void>;
}

export const useNotebookSettingsStore = create<NotebookSettingsState>((set) => ({
  paperColor: '#ffffff',
  template: 'Blank',
  orientation: 'Portrait',
  pageSize: 'A4',
  margins: 'Normal',
  scrollDirection: 'vertical',

  setPaperColor: (paperColor) => {
    set({ paperColor });
    settingsRepository.set('notebook_paperColor', paperColor);
  },
  setTemplate: (template) => {
    set({ template });
    settingsRepository.set('notebook_template', template);
  },
  setOrientation: (orientation) => {
    set({ orientation });
    settingsRepository.set('notebook_orientation', orientation);
  },
  setPageSize: (pageSize) => {
    set({ pageSize });
    settingsRepository.set('notebook_pageSize', pageSize);
  },
  setMargins: (margins) => {
    set({ margins });
    settingsRepository.set('notebook_margins', margins);
  },
  setScrollDirection: (scrollDirection: ScrollDirection) => {
    set({ scrollDirection: 'vertical' });
    settingsRepository.set('notebook_scrollDirection', 'vertical');
  },
  hydrateSettings: (settings: Record<string, unknown>) => {
    set(state => ({
      paperColor: typeof settings.notebook_paperColor === 'string' ? settings.notebook_paperColor : state.paperColor,
      template: typeof settings.notebook_template === 'string' ? settings.notebook_template as PageTemplateOption : state.template,
      orientation: settings.notebook_orientation === 'Portrait' || settings.notebook_orientation === 'Landscape' ? settings.notebook_orientation : state.orientation,
      pageSize: ['A3', 'A4', 'A5', 'Letter'].includes(String(settings.notebook_pageSize)) ? settings.notebook_pageSize as PageSizeOption : state.pageSize,
      margins: ['No Margin', 'Narrow', 'Normal', 'Wide'].includes(String(settings.notebook_margins)) ? settings.notebook_margins as PageMarginOption : state.margins,
      scrollDirection: 'vertical',
    }));
  },
  loadSettings: async () => {
    const paperColor = await settingsRepository.get('notebook_paperColor');
    const template = await settingsRepository.get('notebook_template');
    const orientation = await settingsRepository.get('notebook_orientation');
    const pageSize = await settingsRepository.get('notebook_pageSize');
    const margins = await settingsRepository.get('notebook_margins');
    const scrollDirection = await settingsRepository.get('notebook_scrollDirection');
    
    set(state => ({
      paperColor: paperColor ?? state.paperColor,
      template: template ?? state.template,
      orientation: orientation ?? state.orientation,
      pageSize: pageSize ?? state.pageSize,
      margins: margins ?? state.margins,
      scrollDirection: scrollDirection ?? state.scrollDirection,
    }));
  }
}));
