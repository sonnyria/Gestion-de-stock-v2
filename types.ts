export interface Product {
  barcode: string;
  name: string;
  quantity: number;
  lastUpdated: number; // Timestamp
}

export enum ViewState {
  DASHBOARD = 'DASHBOARD',
  SCANNER = 'SCANNER',
  ADD_PRODUCT = 'ADD_PRODUCT',
  PRODUCT_DETAILS = 'PRODUCT_DETAILS'
}

export interface ScanResult {
  barcode: string | null;
  error?: string;
}

// ProductEnhancement and AI-based enhancements were removed. Keep the file lean.