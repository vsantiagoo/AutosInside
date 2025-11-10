import { z } from "zod";

// Users Schema
export const userSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  matricula: z.string(),
  password_hash: z.string().optional(),
  role: z.enum(['admin', 'user']),
  monthly_limit: z.number().nullable(),
  limit_enabled: z.boolean(),
  created_at: z.string(),
});

export const insertUserSchema = z.object({
  full_name: z.string().min(1, "Full name is required"),
  matricula: z.string().min(1, "Matricula is required"),
  password: z.string().optional().refine(
    (val) => !val || val.length >= 6,
    { message: "Password must be at least 6 characters if provided" }
  ),
  role: z.enum(['admin', 'user']).default('user'),
});

export const loginSchema = z.object({
  matricula: z.string().min(1, "Matricula is required"),
  password: z.string().optional(),
});

export const updateUserLimitSchema = z.object({
  monthly_limit: z.number().min(0, "Limite deve ser maior ou igual a zero").nullable(),
  limit_enabled: z.boolean(),
});

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;
export type UpdateUserLimit = z.infer<typeof updateUserLimitSchema>;

// Sectors Schema
export const sectorSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const insertSectorSchema = z.object({
  name: z.string().min(1, "Sector name is required"),
});

export type Sector = z.infer<typeof sectorSchema>;
export type InsertSector = z.infer<typeof insertSectorSchema>;

// Products Schema
export const productSchema = z.object({
  id: z.number(),
  name: z.string(),
  sector_id: z.number().nullable(),
  sku: z.string().nullable(),
  category: z.string().nullable(),
  unit_measure: z.string().nullable(),
  unit_price: z.number(),
  sale_price: z.number().nullable(),
  stock_quantity: z.number(),
  min_quantity: z.number().nullable(),
  max_quantity: z.number().nullable(),
  total_in: z.number(),
  total_out: z.number(),
  photo_path: z.string().nullable(),
  low_stock_threshold: z.number().nullable(),
  supplier: z.string().nullable(),
  last_purchase_date: z.string().nullable(),
  last_count_date: z.string().nullable(),
  expiry_date: z.string().nullable(),
  warranty_date: z.string().nullable(),
  asset_number: z.string().nullable(),
  status: z.string().nullable(),
  visible_to_users: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const insertProductSchema = z.object({
  name: z.string().min(1, "Nome do produto é obrigatório"),
  sector_id: z.number().nullable().optional(),
  sku: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  unit_measure: z.string().nullable().optional(),
  unit_price: z.number().min(0, "Preço unitário deve ser positivo").default(0),
  sale_price: z.number().min(0).nullable().optional(),
  stock_quantity: z.number().int().min(0, "Quantidade em estoque não pode ser negativa").default(0),
  min_quantity: z.number().int().min(0).nullable().optional(),
  max_quantity: z.number().int().min(0).nullable().optional(),
  low_stock_threshold: z.number().int().min(0).optional().default(10),
  supplier: z.string().nullable().optional(),
  last_purchase_date: z.string().nullable().optional(),
  last_count_date: z.string().nullable().optional(),
  expiry_date: z.string().nullable().optional(),
  warranty_date: z.string().nullable().optional(),
  asset_number: z.string().nullable().optional(),
  status: z.enum(['Ativo', 'Inativo']).nullable().optional().default('Ativo'),
  visible_to_users: z.boolean().default(true),
});

export type Product = z.infer<typeof productSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// Stock Transactions Schema
export const stockTransactionSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  user_id: z.number().nullable(),
  transaction_type: z.string().nullable(),
  change: z.number(),
  reason: z.string().nullable(),
  document_origin: z.string().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
});

export const insertStockTransactionSchema = z.object({
  product_id: z.number(),
  user_id: z.number().nullable().optional(),
  transaction_type: z.enum(['entrada', 'saida', 'ajuste', 'devolucao']).optional(),
  change: z.number().int().refine((val) => val !== 0, "Change cannot be zero"),
  reason: z.string().optional(),
  document_origin: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type StockTransaction = z.infer<typeof stockTransactionSchema>;
export type InsertStockTransaction = z.infer<typeof insertStockTransactionSchema>;

// Consumptions Schema
export const consumptionSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  product_id: z.number(),
  qty: z.number(),
  unit_price: z.number(),
  total_price: z.number(),
  consumed_at: z.string(),
});

export const insertConsumptionSchema = z.object({
  user_id: z.number(),
  product_id: z.number(),
  qty: z.number().int().min(1, "Quantity must be at least 1"),
});

export type Consumption = z.infer<typeof consumptionSchema>;
export type InsertConsumption = z.infer<typeof insertConsumptionSchema>;

// Extended types for frontend display with joined data
export type ProductWithSector = Product & {
  sector_name?: string;
};

export type ConsumptionWithDetails = Consumption & {
  user_name?: string;
  product_name?: string;
  photo_path?: string | null;
};

export type StockTransactionWithProduct = StockTransaction & {
  product_name?: string;
  user_name?: string;
  photo_path?: string | null;
};

// Inventory KPIs and Reports
export type InventoryKPI = {
  sector_id: number | null;
  sector_name: string;
  total_products: number;
  total_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  turnover_rate: number | null;
  coverage_days: number | null;
};

export type ProductInventoryDetails = Product & {
  sector_name?: string;
  inventory_value: number;
  stock_status: 'OK' | 'Baixo' | 'Zerado' | 'Excesso';
};

export type InventoryKPIResponse = {
  kpis: InventoryKPI[];
  totalValue: number;
};

export type SectorReportSummary = {
  totalProducts: number;
  totalValue: number;
  totalIn: number;
  totalOut: number;
  lowStockCount: number;
  outOfStockCount: number;
};

export type SectorReport = {
  sector: Sector;
  products: ProductWithSector[];
  stockTransactions: StockTransactionWithProduct[];
  consumptions: ConsumptionWithDetails[];
  summary: SectorReportSummary;
};

export type TopConsumedItem = {
  product_id: number;
  product_name: string;
  sector_name: string | null;
  total_qty: number;
  total_value: number;
  consumption_count: number;
  photo_path?: string | null;
};

// Sector Details with Performance Indicators
export type SectorPerformanceIndicators = {
  sector_id: number;
  sector_name: string;
  total_products: number;
  total_inventory_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  stock_turnover: number | null; // Giro de estoque
  coverage_days: number | null; // Cobertura de estoque (dias)
  stockout_frequency: number; // Frequência de ruptura
  immobilized_value: number; // Valor imobilizado
};

// Product Details with all information
export type ProductDetailedInfo = Product & {
  sector_name?: string;
  inventory_value: number;
  stock_status: 'OK' | 'Baixo' | 'Zerado' | 'Excesso';
  turnover_rate: number | null;
  coverage_days: number | null;
};

// ============================================
// REPORTING MODULE SCHEMAS
// ============================================

// Predictive Analysis for Restock Recommendations
export type PredictiveAnalysis = {
  productId: number;
  productName: string;
  currentStock: number;
  minQuantity: number | null;
  maxQuantity: number | null;
  last15DaysConsumption: number[]; // Daily consumption for last 15 days
  averageDailyConsumption: number;
  consumptionTrend: 'increasing' | 'stable' | 'decreasing';
  predicted15DaysConsumption: number;
  recommendedReorder: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  stockoutRisk: 'high' | 'medium' | 'low';
  photoPath: string | null;
};

// Daily Consumption Total for User Report
export type DailyConsumptionTotal = {
  date: string; // YYYY-MM-DD
  totalValue: number;
  itemCount: number;
};

// User Consumption Report (FoodStation)
export type UserConsumptionReport = {
  user: User;
  consumptions: ConsumptionWithDetails[];
  dailyTotals: DailyConsumptionTotal[];
  monthlyTotal: number;
  period: {
    start: string;
    end: string;
  };
};

// Restock Prediction Report (FoodStation)
export type RestockPredictionReport = {
  sector: Sector;
  products: PredictiveAnalysis[];
  generatedAt: string;
  periodAnalyzed: {
    start: string;
    end: string;
  };
  periodProjected: {
    start: string;
    end: string;
  };
  totalRecommendedItems: number;
  highRiskItems: number;
};

// Product Stock Snapshot (for monthly/weekly reports)
export type ProductStockSnapshot = {
  productId: number;
  productName: string;
  quantity: number;
  value: number;
  photoPath: string | null;
};

// Purchase Recommendation
export type PurchaseRecommendation = {
  productId: number;
  productName: string;
  currentStock: number;
  recommendedQuantity: number;
  estimatedCost: number;
  priority: 'high' | 'medium' | 'low';
  photoPath: string | null;
};

// Sector Monthly Report (Cleaning, Coffee Machine, etc.)
export type SectorMonthlyReport = {
  sector: Sector;
  period: {
    start: string;
    end: string;
    cadence: 'monthly' | 'biweekly' | 'weekly';
  };
  openingStock: ProductStockSnapshot[];
  closingStock: ProductStockSnapshot[];
  totalConsumption: number;
  totalItemsConsumed: number;
  recommendedPurchases: PurchaseRecommendation[];
  frequencyAnalysis?: {
    productId: number;
    productName: string;
    restockFrequency: number; // times per period
    averageDailyUsage: number;
  }[];
};

// General Inventory Report
export type GeneralInventoryReport = {
  generatedAt: string;
  sectors: {
    sector: Sector;
    totalProducts: number;
    totalValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  }[];
  overallStats: {
    totalProducts: number;
    totalValue: number;
    totalLowStock: number;
    totalOutOfStock: number;
    averageTurnover: number | null;
  };
  topConsumedItems: TopConsumedItem[];
  criticalAlerts: {
    productId: number;
    productName: string;
    sectorName: string;
    alertType: 'out_of_stock' | 'low_stock' | 'expiring_soon';
    message: string;
  }[];
};

// Query Parameters Schemas
export const reportDateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  month: z.string().optional(), // YYYY-MM format
});

export const sectorReportCadenceSchema = z.object({
  cadence: z.enum(['monthly', 'biweekly', 'weekly']).default('monthly'),
});

export type ReportDateRange = z.infer<typeof reportDateRangeSchema>;
export type SectorReportCadence = z.infer<typeof sectorReportCadenceSchema>;
