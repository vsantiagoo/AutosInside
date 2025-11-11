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
  user_matricula?: string;
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

// ============================================
// NEW REPORTS - FOODSTATION & CLEANING
// ============================================

// FoodStation Consumption Report (Customizable)
export type FoodStationConsumptionRecord = {
  consumption_id: number;
  matricula: string;
  user_name: string;
  product_name: string;
  unit_price: number;
  quantity: number;
  total_value: number;
  consumed_at: string;
  sector_name: string;
};

export type FoodStationConsumptionSummary = {
  matricula: string;
  user_name: string;
  total_consumed_value: number;
  total_items: number;
  consumption_count: number;
};

export type FoodStationConsumptionReport = {
  records: FoodStationConsumptionRecord[];
  summary?: FoodStationConsumptionSummary[];
  period: {
    start: string;
    end: string;
  };
  generatedAt: string;
};

export const foodStationConsumptionQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  fields: z.string().optional(), // comma-separated: matricula,user_name,total_value
  groupBy: z.enum(['user', 'product', 'date', 'none']).optional().default('none'),
});

export type FoodStationConsumptionQuery = z.infer<typeof foodStationConsumptionQuerySchema>;

// FoodStation Overview Report (with Prediction)
export type FoodStationProductOverview = {
  product_id: number;
  product_name: string;
  category: string | null;
  current_stock: number;
  min_stock: number | null;
  unit_price: number;
  total_exits_month: number;
  total_value_exits_month: number;
  avg_daily_consumption_15d: number;
  predicted_consumption_15d: number;
  recommended_reorder: number;
  stock_status: 'OK' | 'Baixo' | 'Zerado' | 'Crítico';
  stockout_risk: 'high' | 'medium' | 'low';
  days_until_stockout: number | null;
  photo_path: string | null;
};

export type FoodStationOverviewKPIs = {
  total_exits_month: number;
  total_value_month: number;
  unique_products_consumed: number;
  total_restock_value: number;
  high_risk_items: number;
};

export type FoodStationOverviewReport = {
  kpis: FoodStationOverviewKPIs;
  products: FoodStationProductOverview[];
  topConsumed: {
    product_id: number;
    product_name: string;
    total_qty: number;
    total_value: number;
    photo_path: string | null;
  }[];
  period: {
    start: string;
    end: string;
    days: number;
  };
  generatedAt: string;
};

export const foodStationOverviewQuerySchema = z.object({
  days: z.enum(['7', '15', '30']).optional().default('30'),
});

export type FoodStationOverviewQuery = z.infer<typeof foodStationOverviewQuerySchema>;

// Cleaning Sector Report (Bimonthly)
export type CleaningProductSnapshot = {
  product_id: number;
  product_name: string;
  category: string | null;
  opening_stock: number;
  entries: number;
  exits: number;
  closing_stock: number;
  consumption_total: number;
  unit_price: number;
  consumption_value: number;
  recommended_purchase: number;
  estimated_cost: number;
  photo_path: string | null;
};

export type CleaningReportComparison = {
  product_id: number;
  product_name: string;
  current_month_consumption: number;
  previous_month_consumption: number;
  variance: number;
  variance_percent: number;
};

export type CleaningReportSummary = {
  total_products: number;
  total_consumption_value: number;
  total_items_consumed: number;
  total_purchase_value: number;
  total_entries: number;
  total_exits: number;
};

export type CleaningSectorReport = {
  sector: Sector;
  period: {
    start: string;
    end: string;
    cadence: 'first_half' | 'second_half' | 'full_month';
  };
  products: CleaningProductSnapshot[];
  comparison?: CleaningReportComparison[];
  summary: CleaningReportSummary;
  generatedAt: string;
};

export const cleaningReportQuerySchema = z.object({
  month: z.string(), // YYYY-MM format
  cadence: z.enum(['first_half', 'second_half', 'full_month']).optional().default('full_month'),
  sectorId: z.number().optional(),
  compareWithPrevious: z.boolean().optional().default(false),
});

export type CleaningReportQuery = z.infer<typeof cleaningReportQuerySchema>;

// ============================================
// COFFEE MACHINE SECTOR REPORT
// ============================================

export type CoffeeMachineProductReport = {
  product_id: number;
  product_name: string;
  category: string | null;
  opening_stock: number;
  entries: number;
  exits: number;
  current_stock: number;
  weekly_avg_consumption: number;
  biweekly_avg_consumption: number;
  consumption_frequency: 'high' | 'medium' | 'low';
  suggested_reorder_cadence: 'weekly' | 'biweekly' | 'monthly';
  unit_price: number;
  photo_path: string | null;
};

export type CoffeeMachineReportKPIs = {
  total_products: number;
  total_exits: number;
  total_value_exits: number;
  high_frequency_items: number;
  avg_weekly_consumption: number;
};

export type CoffeeMachineReport = {
  sector: Sector;
  period: {
    start: string;
    end: string;
    cadence: 'weekly' | 'biweekly';
    weeks: number;
  };
  kpis: CoffeeMachineReportKPIs;
  products: CoffeeMachineProductReport[];
  topConsumed: {
    product_id: number;
    product_name: string;
    total_qty: number;
    frequency: 'high' | 'medium' | 'low';
    photo_path: string | null;
  }[];
  generatedAt: string;
};

export const coffeeMachineReportQuerySchema = z.object({
  sectorId: z.number().optional(),
  cadence: z.enum(['weekly', 'biweekly']).optional().default('weekly'),
  weeks: z.number().optional().default(4), // Number of weeks to analyze
});

export type CoffeeMachineReportQuery = z.infer<typeof coffeeMachineReportQuerySchema>;

// ============================================
// GENERAL INVENTORY REPORT
// ============================================

export type GeneralInventoryProduct = {
  product_id: number;
  product_name: string;
  sector_id: number;
  sector_name: string;
  category: string | null;
  current_stock: number;
  unit_price: number;
  total_value: number;
  stock_status: 'OK' | 'Baixo' | 'Zerado' | 'Crítico';
  photo_path: string | null;
};

export type GeneralInventoryBySector = {
  sector_id: number;
  sector_name: string;
  total_products: number;
  total_value: number;
  products: GeneralInventoryProduct[];
};

export type GeneralInventoryKPIs = {
  total_products: number;
  total_sectors: number;
  total_inventory_value: number;
  low_stock_items: number;
  out_of_stock_items: number;
};

export type GeneralInventoryReport = {
  kpis: GeneralInventoryKPIs;
  bySector: GeneralInventoryBySector[];
  allProducts: GeneralInventoryProduct[];
  generatedAt: string;
};

export const generalInventoryQuerySchema = z.object({
  sectorId: z.number().optional(),
  keyword: z.string().optional(),
  includeOutOfStock: z.boolean().optional().default(true),
});

export type GeneralInventoryQuery = z.infer<typeof generalInventoryQuerySchema>;

// ============================================
// FOODSTATION CONSUMPTION CONTROL REPORT
// ============================================

export type FoodStationConsumptionControlRecord = {
  consumption_id: number;
  matricula: string;
  user_name: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_value: number;
  consumed_at: string;
  photo_path: string | null;
};

export type FoodStationConsumptionControlReport = {
  userId: number | null;
  userName: string | null;
  records: FoodStationConsumptionControlRecord[];
  monthlyTotals: MonthlyUserTotal[];
  monthlyTotal: number;
  totalItems: number;
  period: {
    start: string;
    end: string;
  };
  generatedAt: string;
};

export const foodStationConsumptionControlQuerySchema = z.object({
  userId: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type FoodStationConsumptionControlQuery = z.infer<typeof foodStationConsumptionControlQuerySchema>;

// ============================================
// SECTOR PRODUCT MANAGEMENT REPORT
// ============================================

export type SectorProductManagementProduct = {
  product_id: number;
  product_name: string;
  category: string | null;
  current_stock: number;
  total_entries: number;
  total_exits: number;
  unit_price: number;
  total_value: number;
  avg_daily_consumption_30d: number;
  predicted_consumption_30d: number;
  recommended_reorder: number;
  days_until_stockout: number | null;
  next_order_date: string | null;
  stock_status: 'OK' | 'Baixo' | 'Zerado' | 'Crítico';
  photo_path: string | null;
};

export type SectorProductManagementKPIs = {
  total_products: number;
  total_entries: number;
  total_exits: number;
  total_inventory_value: number;
  total_reorder_value: number;
};

export type SectorProductManagementReport = {
  sector: Sector;
  kpis: SectorProductManagementKPIs;
  products: SectorProductManagementProduct[];
  topExits: {
    product_id: number;
    product_name: string;
    total_qty: number;
    total_value: number;
    photo_path: string | null;
  }[];
  period: {
    start: string;
    end: string;
    days: number;
  };
  generatedAt: string;
};

export const sectorProductManagementQuerySchema = z.object({
  sectorId: z.number(),
  days: z.number().optional().default(30),
});

export type SectorProductManagementQuery = z.infer<typeof sectorProductManagementQuerySchema>;

// ============================================
// FOODSTATION CONSUMPTION EXPORT
// ============================================

export const exportFormatEnum = z.enum(['consolidated', 'detailed']);
export type ExportFormat = z.infer<typeof exportFormatEnum>;

export const foodStationConsumptionExportSchema = z.object({
  format: exportFormatEnum.default('consolidated'),
  filters: z.object({
    userId: z.number().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export type FoodStationConsumptionExportOptions = z.infer<typeof foodStationConsumptionExportSchema>;

export type MonthlyUserTotal = {
  matricula: string;
  user_name: string;
  monthly_total: number;
};
