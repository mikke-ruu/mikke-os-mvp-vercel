import type { LpBlock } from '@/components/mikkeos/page-builder/lp-design';

export type SalesPageDisplay = {
  priceAlign: 'left' | 'center';
  spacing: 'compact' | 'regular' | 'spacious';
  tone: 'white' | 'warm' | 'soft';
  priceHeading: string;
  scheduleHeading: string;
  applicationHeading: string;
};

export const salesPageDisplayId = 'academy-sales-page-display';
export const defaultSalesPageDisplay: SalesPageDisplay = {
  priceAlign: 'center', spacing: 'regular', tone: 'white',
  priceHeading: '料金', scheduleHeading: '開催日程', applicationHeading: 'お申込み',
};

export function salesPageContentBlocks(blocks: LpBlock[]): LpBlock[] {
  return blocks.filter(block => block.id !== salesPageDisplayId);
}

export function readSalesPageDisplay(blocks: LpBlock[]): SalesPageDisplay {
  const saved = blocks.find(block => block.id === salesPageDisplayId)?.lp?.salesDisplay;
  return {
    priceAlign: saved?.priceAlign === 'left' ? 'left' : 'center',
    spacing: saved?.spacing === 'compact' || saved?.spacing === 'spacious' ? saved.spacing : 'regular',
    tone: saved?.tone === 'warm' || saved?.tone === 'soft' ? saved.tone : 'white',
    priceHeading: saved?.priceHeading?.trim().slice(0, 60) || defaultSalesPageDisplay.priceHeading,
    scheduleHeading: saved?.scheduleHeading?.trim().slice(0, 60) || defaultSalesPageDisplay.scheduleHeading,
    applicationHeading: saved?.applicationHeading?.trim().slice(0, 60) || defaultSalesPageDisplay.applicationHeading,
  };
}

export function withSalesPageDisplay(blocks: LpBlock[], display: SalesPageDisplay): LpBlock[] {
  return [...salesPageContentBlocks(blocks), {
    id: salesPageDisplayId, type: 'paragraph', text: '',
    lp: { salesDisplay: display },
  }];
}
