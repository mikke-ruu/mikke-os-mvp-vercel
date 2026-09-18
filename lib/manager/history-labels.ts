const customerVisibleHistorySourceLabels: Record<string, string> = {
  market_note: "MarketNote",
  marketnote: "MarketNote"
};

export function getManagerHistorySourceLabel(sourceService: string) {
  return customerVisibleHistorySourceLabels[sourceService.trim().toLowerCase()] ?? "mikkeOS";
}
