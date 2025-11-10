import { storage } from '../storage-sqlite';
import type {
  Sector,
  Product,
  UserConsumptionReport,
  RestockPredictionReport,
  SectorMonthlyReport,
  GeneralInventoryReport,
  PredictiveAnalysis,
  ProductStockSnapshot,
  PurchaseRecommendation,
  DailyConsumptionTotal,
} from '@shared/schema';

/**
 * Reporting Service
 * Contains business logic for generating predictive reports and analytics
 */

// ============================================
// USER CONSUMPTION REPORT
// ============================================

export async function generateUserConsumptionReport(
  userId: number,
  startDate?: string,
  endDate?: string
): Promise<UserConsumptionReport> {
  const user = await storage.getUser(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Default to current month if no dates provided
  const now = new Date();
  const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // Get consumptions for the period
  const consumptions = await storage.getUserConsumptions(userId, start, end);

  // Calculate daily totals
  const dailyTotals = await storage.getDailyConsumptionTotals(userId, start, end);

  // Calculate monthly total
  const monthlyTotal = consumptions.reduce((sum, c) => sum + c.total_price, 0);

  return {
    user,
    consumptions,
    dailyTotals,
    monthlyTotal,
    period: {
      start,
      end,
    },
  };
}

// ============================================
// PREDICTIVE RESTOCK REPORT (FoodStation)
// ============================================

/**
 * Calculate linear regression slope for trend analysis
 */
function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0;
  
  const n = values.length;
  const xSum = values.reduce((sum, _, i) => sum + i, 0);
  const ySum = values.reduce((sum, val) => sum + val, 0);
  const xySum = values.reduce((sum, val, i) => sum + (i * val), 0);
  const x2Sum = values.reduce((sum, _, i) => sum + (i * i), 0);
  
  const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
  return slope;
}

/**
 * Determine trend direction based on slope
 */
function getTrendDirection(slope: number): 'increasing' | 'stable' | 'decreasing' {
  if (slope > 0.1) return 'increasing';
  if (slope < -0.1) return 'decreasing';
  return 'stable';
}

/**
 * Calculate confidence level based on consumption variance
 */
function getConfidenceLevel(values: number[]): 'high' | 'medium' | 'low' {
  if (values.length < 3) return 'low';
  
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? stdDev / mean : 1;
  
  if (coefficientOfVariation < 0.3) return 'high';
  if (coefficientOfVariation < 0.6) return 'medium';
  return 'low';
}

/**
 * Assess stockout risk based on current stock and consumption rate
 */
function assessStockoutRisk(
  currentStock: number,
  predicted15DaysConsumption: number
): 'high' | 'medium' | 'low' {
  if (currentStock <= 0) return 'high';
  
  const daysUntilStockout = predicted15DaysConsumption > 0 
    ? (currentStock / (predicted15DaysConsumption / 15)) 
    : 999;
  
  if (daysUntilStockout < 5) return 'high';
  if (daysUntilStockout < 10) return 'medium';
  return 'low';
}

/**
 * Analyze product consumption and generate predictive recommendations
 */
async function analyzePredictiveRestock(productId: number): Promise<PredictiveAnalysis | null> {
  const product = await storage.getProduct(productId);
  if (!product) return null;

  // Get last 15 days of consumption history
  const history = await storage.getProductConsumptionHistory(productId, 15);
  
  // Create array with 0 for days with no consumption
  const consumptionByDay: number[] = [];
  const today = new Date();
  
  for (let i = 14; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    
    const dayData = history.find(h => h.date.startsWith(dateStr));
    consumptionByDay.push(dayData ? dayData.qty : 0);
  }

  // Calculate average daily consumption
  const totalConsumption = consumptionByDay.reduce((sum, qty) => sum + qty, 0);
  const averageDailyConsumption = totalConsumption / 15;

  // Calculate trend
  const slope = calculateTrend(consumptionByDay);
  const trend = getTrendDirection(slope);
  
  // Apply trend multiplier for prediction
  let trendMultiplier = 1.0;
  if (trend === 'increasing') trendMultiplier = 1.2; // 20% increase
  if (trend === 'decreasing') trendMultiplier = 0.8; // 20% decrease

  // Predict next 15 days consumption
  const predicted15DaysConsumption = Math.ceil(averageDailyConsumption * 15 * trendMultiplier);

  // Calculate recommended reorder with safety stock (20% buffer)
  const safetyBuffer = Math.ceil(predicted15DaysConsumption * 0.2);
  const recommendedReorder = Math.max(
    0,
    predicted15DaysConsumption - product.stock_quantity + safetyBuffer
  );

  // Calculate confidence and risk
  const confidenceLevel = getConfidenceLevel(consumptionByDay);
  const stockoutRisk = assessStockoutRisk(product.stock_quantity, predicted15DaysConsumption);

  return {
    productId: product.id,
    productName: product.name,
    currentStock: product.stock_quantity,
    minQuantity: product.min_quantity,
    maxQuantity: product.max_quantity,
    last15DaysConsumption: consumptionByDay,
    averageDailyConsumption,
    consumptionTrend: trend,
    predicted15DaysConsumption,
    recommendedReorder,
    confidenceLevel,
    stockoutRisk,
    photoPath: product.photo_path,
  };
}

/**
 * Generate FoodStation Restock Prediction Report
 */
export async function generateRestockPredictionReport(
  sectorId: number
): Promise<RestockPredictionReport> {
  const sector = await storage.getSector(sectorId);
  if (!sector) {
    throw new Error('Sector not found');
  }

  // Get all products in the sector
  const products = await storage.getProductsBySector(sectorId);

  // Analyze each product
  const analyses: PredictiveAnalysis[] = [];
  for (const product of products) {
    const analysis = await analyzePredictiveRestock(product.id);
    if (analysis) {
      analyses.push(analysis);
    }
  }

  // Sort by stockout risk (high first) and recommended reorder quantity
  analyses.sort((a, b) => {
    const riskOrder = { high: 0, medium: 1, low: 2 };
    if (riskOrder[a.stockoutRisk] !== riskOrder[b.stockoutRisk]) {
      return riskOrder[a.stockoutRisk] - riskOrder[b.stockoutRisk];
    }
    return b.recommendedReorder - a.recommendedReorder;
  });

  const now = new Date();
  const fifteenDaysAgo = new Date(now);
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  const fifteenDaysFromNow = new Date(now);
  fifteenDaysFromNow.setDate(fifteenDaysFromNow.getDate() + 15);

  return {
    sector,
    products: analyses,
    generatedAt: now.toISOString(),
    periodAnalyzed: {
      start: fifteenDaysAgo.toISOString(),
      end: now.toISOString(),
    },
    periodProjected: {
      start: now.toISOString(),
      end: fifteenDaysFromNow.toISOString(),
    },
    totalRecommendedItems: analyses.filter(a => a.recommendedReorder > 0).length,
    highRiskItems: analyses.filter(a => a.stockoutRisk === 'high').length,
  };
}

// ============================================
// SECTOR MONTHLY/WEEKLY REPORT
// ============================================

/**
 * Calculate frequency of restock needs based on historical transactions
 */
async function calculateRestockFrequency(
  productId: number,
  days: number
): Promise<number> {
  const transactions = await storage.getProductConsumptionHistory(productId, days);
  
  // Count days with consumption
  const daysWithConsumption = transactions.filter(t => t.qty > 0).length;
  
  // Frequency = days with consumption / total days
  return daysWithConsumption / days;
}

/**
 * Generate Sector Monthly/Weekly Report (for Cleaning, Coffee Machine, etc.)
 */
export async function generateSectorMonthlyReport(
  sectorId: number,
  cadence: 'monthly' | 'biweekly' | 'weekly' = 'monthly'
): Promise<SectorMonthlyReport> {
  const sector = await storage.getSector(sectorId);
  if (!sector) {
    throw new Error('Sector not found');
  }

  // Calculate period based on cadence
  const now = new Date();
  let startDate: Date;
  let days: number;

  switch (cadence) {
    case 'weekly':
      days = 7;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      break;
    case 'biweekly':
      days = 14;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 14);
      break;
    case 'monthly':
    default:
      days = 30;
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const startDateStr = startDate.toISOString();
  const endDateStr = now.toISOString();

  // Get products in sector
  const products = await storage.getProductsBySector(sectorId);

  // Opening stock (snapshot at start of period - approximated from current stock + consumption)
  const consumptions = await storage.getConsumptionsBySectorAndDateRange(
    sectorId,
    startDateStr,
    endDateStr
  );

  const openingStock: ProductStockSnapshot[] = products.map(p => {
    const productConsumption = consumptions
      .filter(c => c.product_id === p.id)
      .reduce((sum, c) => sum + c.qty, 0);
    
    return {
      productId: p.id,
      productName: p.name,
      quantity: p.stock_quantity + productConsumption, // Approximate opening
      value: (p.stock_quantity + productConsumption) * p.unit_price,
      photoPath: p.photo_path,
    };
  });

  // Closing stock (current)
  const closingStock: ProductStockSnapshot[] = products.map(p => ({
    productId: p.id,
    productName: p.name,
    quantity: p.stock_quantity,
    value: p.stock_quantity * p.unit_price,
    photoPath: p.photo_path,
  }));

  // Calculate total consumption
  const totalConsumption = consumptions.reduce((sum, c) => sum + c.total_price, 0);
  const totalItemsConsumed = consumptions.reduce((sum, c) => sum + c.qty, 0);

  // Generate purchase recommendations
  const recommendedPurchases: PurchaseRecommendation[] = [];
  
  for (const product of products) {
    const analysis = await analyzePredictiveRestock(product.id);
    if (analysis && analysis.recommendedReorder > 0) {
      const priority = analysis.stockoutRisk === 'high' ? 'high' 
                     : analysis.stockoutRisk === 'medium' ? 'medium' 
                     : 'low';
      
      recommendedPurchases.push({
        productId: product.id,
        productName: product.name,
        currentStock: product.stock_quantity,
        recommendedQuantity: analysis.recommendedReorder,
        estimatedCost: analysis.recommendedReorder * product.unit_price,
        priority,
        photoPath: product.photo_path,
      });
    }
  }

  // Sort by priority
  recommendedPurchases.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  // Frequency analysis (for coffee machine, etc.)
  const frequencyAnalysis = await Promise.all(
    products.map(async (p) => ({
      productId: p.id,
      productName: p.name,
      restockFrequency: await calculateRestockFrequency(p.id, days),
      averageDailyUsage: (await storage.getProductConsumptionHistory(p.id, days))
        .reduce((sum, h) => sum + h.qty, 0) / days,
    }))
  );

  // Sort by restock frequency (highest first)
  frequencyAnalysis.sort((a, b) => b.restockFrequency - a.restockFrequency);

  return {
    sector,
    period: {
      start: startDateStr,
      end: endDateStr,
      cadence,
    },
    openingStock,
    closingStock,
    totalConsumption,
    totalItemsConsumed,
    recommendedPurchases,
    frequencyAnalysis,
  };
}

// ============================================
// GENERAL INVENTORY REPORT
// ============================================

/**
 * Generate General Inventory Overview Report
 */
export async function generateGeneralInventoryReport(): Promise<GeneralInventoryReport> {
  const stats = await storage.getGeneralInventoryStats();
  const allSectors = await storage.getAllSectors();
  const topConsumed = await storage.getTopConsumedItems(10);
  const allProducts = await storage.getAllProducts();

  // Build sector summaries
  const sectors = stats.sectorStats.map((s: any) => ({
    sector: allSectors.find(sec => sec.id === s.sector_id) || { id: s.sector_id, name: s.sector_name },
    totalProducts: s.total_products || 0,
    totalValue: s.total_value || 0,
    lowStockCount: s.low_stock_count || 0,
    outOfStockCount: s.out_of_stock_count || 0,
  }));

  // Critical alerts
  const criticalAlerts: any[] = [];
  
  // Out of stock alerts
  allProducts
    .filter(p => p.stock_quantity === 0)
    .forEach(p => {
      criticalAlerts.push({
        productId: p.id,
        productName: p.name,
        sectorName: p.sector_name || 'N/A',
        alertType: 'out_of_stock' as const,
        message: `Produto sem estoque`,
      });
    });

  // Low stock alerts
  allProducts
    .filter(p => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 10))
    .forEach(p => {
      criticalAlerts.push({
        productId: p.id,
        productName: p.name,
        sectorName: p.sector_name || 'N/A',
        alertType: 'low_stock' as const,
        message: `Estoque baixo: ${p.stock_quantity} unidades`,
      });
    });

  // Expiring soon (within 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  allProducts
    .filter(p => p.expiry_date && new Date(p.expiry_date) <= thirtyDaysFromNow)
    .forEach(p => {
      criticalAlerts.push({
        productId: p.id,
        productName: p.name,
        sectorName: p.sector_name || 'N/A',
        alertType: 'expiring_soon' as const,
        message: `Validade próxima: ${new Date(p.expiry_date!).toLocaleDateString('pt-BR')}`,
      });
    });

  // Sort alerts by priority
  const alertPriority: Record<string, number> = { out_of_stock: 0, expiring_soon: 1, low_stock: 2 };
  criticalAlerts.sort((a, b) => (alertPriority[a.alertType] || 0) - (alertPriority[b.alertType] || 0));

  return {
    generatedAt: new Date().toISOString(),
    sectors,
    overallStats: {
      totalProducts: stats.overallStats.total_products || 0,
      totalValue: stats.overallStats.total_value || 0,
      totalLowStock: stats.overallStats.total_low_stock || 0,
      totalOutOfStock: stats.overallStats.total_out_of_stock || 0,
      averageTurnover: null, // Can be enhanced later
    },
    topConsumedItems: topConsumed,
    criticalAlerts,
  };
}
