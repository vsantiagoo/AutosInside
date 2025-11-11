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
  FoodStationConsumptionReport,
  FoodStationOverviewReport,
  CleaningSectorReport,
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
// NEW REPORTS - FOODSTATION & CLEANING
// ============================================

/**
 * Generate FoodStation Consumption Report (Customizable)
 * Allows filtering and selecting specific fields
 */
export async function generateFoodStationConsumptionsReport(
  startDate?: string,
  endDate?: string,
  groupBy?: 'user' | 'product' | 'date' | 'none'
): Promise<FoodStationConsumptionReport> {
  // Find FoodStation sector
  const sectors = await storage.getAllSectors();
  const foodStationSector = sectors.find(s => s.name.toLowerCase().includes('foodstation'));
  
  if (!foodStationSector) {
    throw new Error('FoodStation sector not found');
  }

  // Default to current month if no dates provided
  const now = new Date();
  const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // Get all consumptions for FoodStation
  const consumptions = await storage.getConsumptionsBySectorAndDateRange(
    foodStationSector.id,
    start,
    end
  );

  // Fetch all unique user IDs and batch fetch users
  const uniqueUserIds = Array.from(new Set(consumptions.map(c => c.user_id).filter(Boolean)));
  const usersMap = new Map<number, any>();
  
  for (const userId of uniqueUserIds) {
    const user = await storage.getUser(userId);
    if (user) {
      usersMap.set(userId, user);
    }
  }

  // Transform to report records with matriculas
  const records = consumptions.map(c => {
    const user = c.user_id ? usersMap.get(c.user_id) : null;
    return {
      consumption_id: c.id,
      matricula: user?.matricula || '',
      user_name: c.user_name || '',
      product_name: c.product_name || '',
      unit_price: c.unit_price,
      quantity: c.qty,
      total_value: c.total_price,
      consumed_at: c.consumed_at,
      sector_name: foodStationSector.name,
    };
  });

  // Generate summary if groupBy is 'user'
  let summary = undefined;
  if (groupBy === 'user') {
    const userGroups = new Map<string, { total: number; items: number; count: number }>();
    
    records.forEach(r => {
      const key = `${r.matricula}|${r.user_name}`;
      const existing = userGroups.get(key) || { total: 0, items: 0, count: 0 };
      existing.total += r.total_value;
      existing.items += r.quantity;
      existing.count += 1;
      userGroups.set(key, existing);
    });

    summary = Array.from(userGroups.entries()).map(([key, data]) => {
      const [matricula, user_name] = key.split('|');
      return {
        matricula,
        user_name,
        total_consumed_value: data.total,
        total_items: data.items,
        consumption_count: data.count,
      };
    });
  }

  return {
    records,
    summary,
    period: {
      start,
      end,
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate FoodStation Overview Report with Prediction
 * Includes KPIs, top consumed, and restock predictions
 */
export async function generateFoodStationOverviewReport(
  days: number = 30
): Promise<FoodStationOverviewReport> {
  // Find FoodStation sector
  const sectors = await storage.getAllSectors();
  const foodStationSector = sectors.find(s => s.name.toLowerCase().includes('foodstation'));
  
  if (!foodStationSector) {
    throw new Error('FoodStation sector not found');
  }

  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);

  // Get products in FoodStation
  const products = await storage.getProductsBySector(foodStationSector.id);
  
  // Calculate consumption for each product
  const productOverviews = await Promise.all(
    products.map(async (product) => {
      // Get consumption history (15 days for prediction)
      const history = await storage.getProductConsumptionHistory(product.id, 15);
      
      // Create daily consumption array
      const consumptionByDay: number[] = [];
      for (let i = 14; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayData = history.find(h => h.date.startsWith(dateStr));
        consumptionByDay.push(dayData ? dayData.qty : 0);
      }

      // Calculate metrics
      const totalConsumption = consumptionByDay.reduce((sum, qty) => sum + qty, 0);
      const avgDaily = totalConsumption / 15;
      const predicted15d = Math.ceil(avgDaily * 15);
      
      // Calculate stock status
      const minStock = product.low_stock_threshold || 10;
      let stockStatus: 'OK' | 'Baixo' | 'Zerado' | 'Crítico' = 'OK';
      if (product.stock_quantity === 0) stockStatus = 'Zerado';
      else if (product.stock_quantity <= minStock / 2) stockStatus = 'Crítico';
      else if (product.stock_quantity <= minStock) stockStatus = 'Baixo';

      // Calculate stockout risk
      const daysUntilStockout = avgDaily > 0 ? product.stock_quantity / avgDaily : 999;
      let stockoutRisk: 'high' | 'medium' | 'low' = 'low';
      if (daysUntilStockout < 5) stockoutRisk = 'high';
      else if (daysUntilStockout < 10) stockoutRisk = 'medium';

      // Calculate recommended reorder with 20% safety buffer
      const safetyBuffer = Math.ceil(predicted15d * 0.2);
      const recommendedReorder = Math.max(
        0,
        predicted15d - product.stock_quantity + safetyBuffer
      );

      // Get total exits for the month
      const monthlyHistory = await storage.getProductConsumptionHistory(product.id, days);
      const totalExitsMonth = monthlyHistory.reduce((sum, h) => sum + h.qty, 0);

      return {
        product_id: product.id,
        product_name: product.name,
        category: product.category,
        current_stock: product.stock_quantity,
        min_stock: product.low_stock_threshold,
        unit_price: product.unit_price,
        total_exits_month: totalExitsMonth,
        total_value_exits_month: totalExitsMonth * product.unit_price,
        avg_daily_consumption_15d: avgDaily,
        predicted_consumption_15d: predicted15d,
        recommended_reorder: recommendedReorder,
        stock_status: stockStatus,
        stockout_risk: stockoutRisk,
        days_until_stockout: avgDaily > 0 ? Math.floor(daysUntilStockout) : null,
        photo_path: product.photo_path,
      };
    })
  );

  // Calculate KPIs
  const kpis = {
    total_exits_month: productOverviews.reduce((sum, p) => sum + p.total_exits_month, 0),
    total_value_month: productOverviews.reduce((sum, p) => sum + p.total_value_exits_month, 0),
    unique_products_consumed: productOverviews.filter(p => p.total_exits_month > 0).length,
    total_restock_value: productOverviews.reduce((sum, p) => 
      sum + (p.recommended_reorder * p.unit_price), 0),
    high_risk_items: productOverviews.filter(p => p.stockout_risk === 'high').length,
  };

  // Get top consumed (top 5)
  const topConsumed = productOverviews
    .filter(p => p.total_exits_month > 0)
    .sort((a, b) => b.total_exits_month - a.total_exits_month)
    .slice(0, 5)
    .map(p => ({
      product_id: p.product_id,
      product_name: p.product_name,
      total_qty: p.total_exits_month,
      total_value: p.total_value_exits_month,
      photo_path: p.photo_path,
    }));

  return {
    kpis,
    products: productOverviews,
    topConsumed,
    period: {
      start: startDate.toISOString(),
      end: now.toISOString(),
      days,
    },
    generatedAt: now.toISOString(),
  };
}

/**
 * Generate Cleaning Sector Report (Bimonthly)
 * Tracks entries, exits, and purchase recommendations
 */
export async function generateCleaningSectorReport(
  month: string, // YYYY-MM
  cadence: 'first_half' | 'second_half' | 'full_month' = 'full_month',
  sectorId?: number,
  compareWithPrevious: boolean = false
): Promise<CleaningSectorReport> {
  // Find Cleaning sector if not provided
  let sector: Sector | undefined;
  if (sectorId) {
    sector = await storage.getSector(sectorId);
  } else {
    const sectors = await storage.getAllSectors();
    sector = sectors.find(s => s.name.toLowerCase().includes('limpeza') || s.name.toLowerCase().includes('cleaning'));
  }
  
  if (!sector) {
    throw new Error('Cleaning sector not found');
  }

  // Parse month and calculate date range
  const [year, monthNum] = month.split('-').map(Number);
  let startDate: Date;
  let endDate: Date;

  if (cadence === 'first_half') {
    startDate = new Date(year, monthNum - 1, 1);
    endDate = new Date(year, monthNum - 1, 15, 23, 59, 59);
  } else if (cadence === 'second_half') {
    startDate = new Date(year, monthNum - 1, 16);
    endDate = new Date(year, monthNum, 0, 23, 59, 59); // Last day of month
  } else {
    startDate = new Date(year, monthNum - 1, 1);
    endDate = new Date(year, monthNum, 0, 23, 59, 59);
  }

  // Get all products in sector
  const products = await storage.getProductsBySector(sector.id);
  
  // Calculate snapshots for each product
  const productSnapshots = await Promise.all(
    products.map(async (product) => {
      // Get stock transactions for the period
      const allTransactions = await storage.getStockTransactionsBySector(sector.id);
      const productTransactions = allTransactions.filter(st => st.product_id === product.id);
      const periodTransactions = productTransactions.filter(t => {
        const tDate = new Date(t.created_at);
        return tDate >= startDate && tDate <= endDate;
      });

      // Get consumptions for the period using sector date range
      const sectorConsumptions = await storage.getConsumptionsBySectorAndDateRange(
        sector.id,
        startDate.toISOString(),
        endDate.toISOString()
      );
      const periodConsumptions = sectorConsumptions.filter(c => c.product_id === product.id);

      // Calculate entries and exits
      const entries = periodTransactions
        .filter((t: any) => t.change > 0)
        .reduce((sum: number, t: any) => sum + t.change, 0);
      
      const exits = periodConsumptions.reduce((sum: number, c: any) => sum + c.qty, 0);

      // Calculate opening and closing stock
      // Opening = current - entries + exits
      const closingStock = product.stock_quantity;
      const openingStock = closingStock - entries + exits;

      const consumptionTotal = exits;
      const consumptionValue = consumptionTotal * product.unit_price;

      // Calculate recommended purchase for next period
      // Based on average consumption
      const recommendedPurchase = Math.ceil(consumptionTotal * 1.1); // 10% buffer
      const estimatedCost = recommendedPurchase * product.unit_price;

      return {
        product_id: product.id,
        product_name: product.name,
        category: product.category,
        opening_stock: openingStock,
        entries,
        exits,
        closing_stock: closingStock,
        consumption_total: consumptionTotal,
        unit_price: product.unit_price,
        consumption_value: consumptionValue,
        recommended_purchase: recommendedPurchase,
        estimated_cost: estimatedCost,
        photo_path: product.photo_path,
      };
    })
  );

  // Calculate summary
  const summary = {
    total_products: productSnapshots.length,
    total_consumption_value: productSnapshots.reduce((sum, p) => sum + p.consumption_value, 0),
    total_items_consumed: productSnapshots.reduce((sum, p) => sum + p.consumption_total, 0),
    total_purchase_value: productSnapshots.reduce((sum, p) => sum + p.estimated_cost, 0),
    total_entries: productSnapshots.reduce((sum, p) => sum + p.entries, 0),
    total_exits: productSnapshots.reduce((sum, p) => sum + p.exits, 0),
  };

  // Get comparison with previous month if requested
  let comparison = undefined;
  if (compareWithPrevious) {
    const prevMonth = monthNum === 1 ? 12 : monthNum - 1;
    const prevYear = monthNum === 1 ? year - 1 : year;
    const prevMonthStr = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
    
    try {
      const prevReport = await generateCleaningSectorReport(
        prevMonthStr,
        cadence,
        sector.id,
        false
      );

      comparison = productSnapshots.map(current => {
        const previous = prevReport.products.find(p => p.product_id === current.product_id);
        const prevConsumption = previous?.consumption_total || 0;
        const variance = current.consumption_total - prevConsumption;
        const variancePercent = prevConsumption > 0 
          ? (variance / prevConsumption) * 100 
          : 0;

        return {
          product_id: current.product_id,
          product_name: current.product_name,
          current_month_consumption: current.consumption_total,
          previous_month_consumption: prevConsumption,
          variance,
          variance_percent: variancePercent,
        };
      });
    } catch (error) {
      // Previous month data not available
      comparison = undefined;
    }
  }

  return {
    sector,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      cadence,
    },
    products: productSnapshots,
    comparison,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================
// COFFEE MACHINE REPORT
// ============================================

/**
 * Generate Coffee Machine Sector Report
 * Weekly or biweekly monitoring with consumption frequency analysis
 */
export async function generateCoffeeMachineReport(
  sectorId?: number,
  cadence: 'weekly' | 'biweekly' = 'weekly',
  weeks: number = 4
): Promise<import('@shared/schema').CoffeeMachineReport> {
  // Find coffee machine sector
  const allSectors = await storage.getAllSectors();
  let sector;
  
  if (sectorId) {
    sector = allSectors.find(s => s.id === sectorId);
    if (!sector) {
      throw new Error('Sector not found');
    }
  } else {
    sector = allSectors.find(s => s.name.toLowerCase().includes('café') || s.name.toLowerCase().includes('coffee'));
    if (!sector) {
      throw new Error('Coffee Machine sector not found');
    }
  }

  // Calculate period
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (weeks * 7));

  // Get all products in sector
  const products = await storage.getProductsBySector(sector.id);

  // Get all stock transactions and consumptions for the period
  const allTransactions = await storage.getStockTransactionsBySector(sector.id);
  const allConsumptions = await storage.getConsumptionsBySectorAndDateRange(
    sector.id,
    startDate.toISOString(),
    endDate.toISOString()
  );

  // Calculate metrics for each product
  const productReports = await Promise.all(
    products.map(async (product) => {
      const productTransactions = allTransactions.filter(st => st.product_id === product.id);
      const periodTransactions = productTransactions.filter(t => {
        const tDate = new Date(t.created_at);
        return tDate >= startDate && tDate <= endDate;
      });

      const periodConsumptions = allConsumptions.filter(c => c.product_id === product.id);

      // Calculate entries and exits
      const entries = periodTransactions
        .filter((t: any) => t.change > 0)
        .reduce((sum: number, t: any) => sum + t.change, 0);
      
      const exits = periodConsumptions.reduce((sum: number, c: any) => sum + c.qty, 0);

      // Calculate opening and closing stock
      const closingStock = product.stock_quantity;
      const openingStock = closingStock - entries + exits;

      // Calculate weekly and biweekly averages
      const weeklyAvg = exits / weeks;
      const biweeklyAvg = exits / (weeks / 2);

      // Determine consumption frequency based on weekly average
      let consumptionFrequency: 'high' | 'medium' | 'low';
      if (weeklyAvg >= 10) consumptionFrequency = 'high';
      else if (weeklyAvg >= 5) consumptionFrequency = 'medium';
      else consumptionFrequency = 'low';

      // Suggest reorder cadence based on consumption pattern
      let suggestedReorderCadence: 'weekly' | 'biweekly' | 'monthly';
      if (consumptionFrequency === 'high') suggestedReorderCadence = 'weekly';
      else if (consumptionFrequency === 'medium') suggestedReorderCadence = 'biweekly';
      else suggestedReorderCadence = 'monthly';

      return {
        product_id: product.id,
        product_name: product.name,
        category: product.category,
        opening_stock: openingStock,
        entries,
        exits,
        current_stock: closingStock,
        weekly_avg_consumption: weeklyAvg,
        biweekly_avg_consumption: biweeklyAvg,
        consumption_frequency: consumptionFrequency,
        suggested_reorder_cadence: suggestedReorderCadence,
        unit_price: product.unit_price,
        photo_path: product.photo_path,
      };
    })
  );

  // Calculate KPIs
  const totalExits = productReports.reduce((sum, p) => sum + p.exits, 0);
  const totalValueExits = productReports.reduce((sum, p) => sum + (p.exits * p.unit_price), 0);
  const highFrequencyItems = productReports.filter(p => p.consumption_frequency === 'high').length;
  const avgWeeklyConsumption = totalExits / weeks;

  // Get top consumed items
  const topConsumed = productReports
    .map(p => ({
      product_id: p.product_id,
      product_name: p.product_name,
      total_qty: p.exits,
      frequency: p.consumption_frequency,
      photo_path: p.photo_path,
    }))
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, 5);

  return {
    sector,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      cadence,
      weeks,
    },
    kpis: {
      total_products: productReports.length,
      total_exits: totalExits,
      total_value_exits: totalValueExits,
      high_frequency_items: highFrequencyItems,
      avg_weekly_consumption: avgWeeklyConsumption,
    },
    products: productReports,
    topConsumed,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================
// GENERAL INVENTORY REPORT (REFACTORED)
// ============================================

/**
 * Helper function to determine stock status
 */
function getStockStatus(
  currentStock: number,
  lowStockThreshold: number | null,
  maxQuantity: number | null
): 'OK' | 'Baixo' | 'Zerado' | 'Crítico' {
  if (currentStock === 0) return 'Zerado';
  if (lowStockThreshold && currentStock <= lowStockThreshold) return 'Baixo';
  if (maxQuantity && currentStock > maxQuantity) return 'Crítico';
  return 'OK';
}

/**
 * Generate General Inventory Report (REFACTORED)
 * Consolidates all products from all sectors with filtering
 */
export async function generateGeneralInventoryReportNew(
  sectorId?: number,
  keyword?: string,
  includeOutOfStock: boolean = true
): Promise<import('@shared/schema').GeneralInventoryReport> {
  // Fetch all products with sector information
  let allProductsRaw = await storage.getAllProducts();

  // Filter products with valid sector_id (not null)
  allProductsRaw = allProductsRaw.filter(p => p.sector_id !== null);

  // Apply sector filter
  if (sectorId) {
    allProductsRaw = allProductsRaw.filter(p => p.sector_id === sectorId);
  }

  // Apply keyword filter (search in product name and category)
  if (keyword) {
    const keywordLower = keyword.toLowerCase();
    allProductsRaw = allProductsRaw.filter(p => 
      p.name.toLowerCase().includes(keywordLower) ||
      (p.category && p.category.toLowerCase().includes(keywordLower))
    );
  }

  // Apply out-of-stock filter
  if (!includeOutOfStock) {
    allProductsRaw = allProductsRaw.filter(p => p.stock_quantity > 0);
  }

  // Transform to GeneralInventoryProduct format
  const allProducts: import('@shared/schema').GeneralInventoryProduct[] = allProductsRaw.map(p => ({
    product_id: p.id,
    product_name: p.name,
    sector_id: p.sector_id!,  // Safe after filtering
    sector_name: p.sector_name || 'N/A',
    category: p.category,
    current_stock: p.stock_quantity,
    unit_price: p.unit_price,
    total_value: p.stock_quantity * p.unit_price,
    stock_status: getStockStatus(p.stock_quantity, p.low_stock_threshold, p.max_quantity),
    photo_path: p.photo_path,
  }));

  // Group by sector
  const bySectorMap = new Map<number, import('@shared/schema').GeneralInventoryBySector>();
  
  for (const product of allProducts) {
    const existing = bySectorMap.get(product.sector_id);
    if (existing) {
      existing.total_products += 1;
      existing.total_value += product.total_value;
      existing.products.push(product);
    } else {
      bySectorMap.set(product.sector_id, {
        sector_id: product.sector_id,
        sector_name: product.sector_name,
        total_products: 1,
        total_value: product.total_value,
        products: [product],
      });
    }
  }

  const bySector = Array.from(bySectorMap.values());

  // Calculate KPIs
  const totalInventoryValue = allProducts.reduce((sum, p) => sum + p.total_value, 0);
  const lowStockItems = allProducts.filter(p => p.stock_status === 'Baixo').length;
  const outOfStockItems = allProducts.filter(p => p.stock_status === 'Zerado').length;

  return {
    kpis: {
      total_products: allProducts.length,
      total_sectors: bySector.length,
      total_inventory_value: totalInventoryValue,
      low_stock_items: lowStockItems,
      out_of_stock_items: outOfStockItems,
    },
    bySector,
    allProducts,
    generatedAt: new Date().toISOString(),
  };
}

// ============================================
// FOODSTATION CONSUMPTION CONTROL REPORT
// ============================================

/**
 * Generate FoodStation Consumption Control Report
 * Shows detailed consumption records for a user with filtering
 */
export async function generateFoodStationConsumptionControlReport(
  userId?: number,
  startDate?: string,
  endDate?: string
): Promise<import('@shared/schema').FoodStationConsumptionControlReport> {
  // Default to current month if no dates provided
  const now = new Date();
  const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  // Get consumptions for the period
  let consumptions: any[];
  let userName: string | null = null;
  
  if (userId) {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    userName = user.full_name;
    consumptions = await storage.getUserConsumptions(userId, start, end);
  } else {
    // Get all consumptions in period (for admin overview)
    consumptions = await storage.getConsumptionsByPeriod(start, end);
  }

  // Transform to report format
  const records: import('@shared/schema').FoodStationConsumptionControlRecord[] = consumptions.map(c => ({
    consumption_id: c.id,
    matricula: c.user_matricula || '',
    user_name: c.user_name || '',
    product_name: c.product_name || '',
    quantity: c.qty,
    unit_price: c.unit_price,
    total_value: c.total_price,
    consumed_at: c.consumed_at,
    photo_path: c.photo_path || null,
  }));

  // Calculate totals
  const monthlyTotal = records.reduce((sum, r) => sum + r.total_value, 0);
  const totalItems = records.reduce((sum, r) => sum + r.quantity, 0);

  // Calculate monthly totals per user (group by matricula)
  const monthlyTotalsMap = new Map<string, { matricula: string; user_name: string; monthly_total: number }>();
  
  for (const record of records) {
    const key = record.matricula;
    if (!monthlyTotalsMap.has(key)) {
      monthlyTotalsMap.set(key, {
        matricula: record.matricula,
        user_name: record.user_name,
        monthly_total: 0,
      });
    }
    const userTotal = monthlyTotalsMap.get(key)!;
    userTotal.monthly_total += record.total_value;
  }

  const monthlyTotals: import('@shared/schema').MonthlyUserTotal[] = Array.from(monthlyTotalsMap.values())
    .sort((a, b) => b.monthly_total - a.monthly_total); // Sort by highest total first

  return {
    userId: userId || null,
    userName,
    records,
    monthlyTotals,
    monthlyTotal,
    totalItems,
    period: {
      start,
      end,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ============================================
// SECTOR PRODUCT MANAGEMENT REPORT
// ============================================

/**
 * Generate Sector Product Management Report
 * Shows entries, exits, top products, and reorder predictions for a sector
 */
export async function generateSectorProductManagementReport(
  sectorId: number,
  days: number = 30
): Promise<import('@shared/schema').SectorProductManagementReport> {
  // Get sector
  const sector = await storage.getSector(sectorId);
  if (!sector) {
    throw new Error('Sector not found');
  }

  // Get products for sector
  const products = await storage.getProductsBySector(sectorId);
  
  // Calculate period
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Get stock transactions for the period
  const transactions = await storage.getStockTransactionsByPeriod(
    startDate.toISOString(),
    endDate.toISOString()
  );

  // Get consumptions for the period
  const consumptions = await storage.getConsumptionsByPeriod(
    startDate.toISOString(),
    endDate.toISOString()
  );

  // Process each product
  const productReports: import('@shared/schema').SectorProductManagementProduct[] = [];
  let totalEntries = 0;
  let totalExits = 0;
  let totalInventoryValue = 0;
  let totalReorderValue = 0;

  for (const product of products) {
    // Calculate entries (positive transactions)
    const productEntries = transactions
      .filter(t => t.product_id === product.id && t.change > 0)
      .reduce((sum, t) => sum + t.change, 0);

    // Calculate exits (negative transactions + consumptions)
    const productExitsFromTransactions = transactions
      .filter(t => t.product_id === product.id && t.change < 0)
      .reduce((sum, t) => sum + Math.abs(t.change), 0);
    
    const productExitsFromConsumptions = consumptions
      .filter(c => c.product_id === product.id)
      .reduce((sum, c) => sum + c.qty, 0);
    
    const productExits = productExitsFromTransactions + productExitsFromConsumptions;

    // Calculate daily consumption average
    const avgDailyConsumption = productExits / days;

    // Predict next 30 days consumption
    const predicted30DaysConsumption = avgDailyConsumption * 30;

    // Calculate days until stockout
    const daysUntilStockout = avgDailyConsumption > 0 
      ? Math.floor(product.stock_quantity / avgDailyConsumption)
      : null;

    // Calculate next order date
    const nextOrderDate = daysUntilStockout !== null && daysUntilStockout < 60
      ? new Date(Date.now() + (daysUntilStockout - 7) * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Calculate recommended reorder (with 20% buffer)
    const recommendedReorder = Math.ceil(predicted30DaysConsumption * 1.2);

    // Determine stock status
    const stockStatus = getStockStatus(
      product.stock_quantity,
      product.low_stock_threshold,
      product.max_quantity
    );

    const productValue = product.stock_quantity * product.unit_price;
    const reorderValue = recommendedReorder * product.unit_price;

    totalEntries += productEntries;
    totalExits += productExits;
    totalInventoryValue += productValue;
    totalReorderValue += reorderValue;

    productReports.push({
      product_id: product.id,
      product_name: product.name,
      category: product.category,
      current_stock: product.stock_quantity,
      total_entries: productEntries,
      total_exits: productExits,
      unit_price: product.unit_price,
      total_value: productValue,
      avg_daily_consumption_30d: avgDailyConsumption,
      predicted_consumption_30d: predicted30DaysConsumption,
      recommended_reorder: recommendedReorder,
      days_until_stockout: daysUntilStockout,
      next_order_date: nextOrderDate,
      stock_status: stockStatus,
      photo_path: product.photo_path,
    });
  }

  // Get top 5 products by exits
  const topExits = productReports
    .sort((a, b) => b.total_exits - a.total_exits)
    .slice(0, 5)
    .map(p => ({
      product_id: p.product_id,
      product_name: p.product_name,
      total_qty: p.total_exits,
      total_value: p.total_exits * p.unit_price,
      photo_path: p.photo_path,
    }));

  return {
    sector,
    kpis: {
      total_products: products.length,
      total_entries: totalEntries,
      total_exits: totalExits,
      total_inventory_value: totalInventoryValue,
      total_reorder_value: totalReorderValue,
    },
    products: productReports,
    topExits,
    period: {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      days,
    },
    generatedAt: new Date().toISOString(),
  };
}

// ============================================
// FOODSTATION CONSUMPTION EXPORT
// ============================================

/**
 * Generate Excel Workbook for FoodStation Consumption Control Report
 * Supports customizable field selection and monthly totals
 */
export async function generateFoodStationConsumptionWorkbook(
  report: import('@shared/schema').FoodStationConsumptionControlReport,
  options: import('@shared/schema').FoodStationConsumptionExportOptions
): Promise<any> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  // Determine which fields to include
  const fieldsToInclude = options.type === 'complete' 
    ? ['matricula', 'nome', 'produto', 'quantidade', 'precoUnitario', 'precoTotal', 'dataHora'] as const
    : options.fields!;

  // Define column mappings
  const columnDefinitions = {
    matricula: { header: 'Matrícula', key: 'matricula', width: 15 },
    nome: { header: 'Nome Completo', key: 'nome', width: 30 },
    produto: { header: 'Produto', key: 'produto', width: 30 },
    quantidade: { header: 'Quantidade', key: 'quantidade', width: 12 },
    precoUnitario: { header: 'Preço Unitário', key: 'precoUnitario', width: 18 },
    precoTotal: { header: 'Preço Total', key: 'precoTotal', width: 18 },
    dataHora: { header: 'Data e Hora', key: 'dataHora', width: 22 },
  };

  // Create Detailed Consumptions Sheet
  const detailsSheet = workbook.addWorksheet('Consumos Detalhados');
  
  // Set columns based on selected fields (maintaining order)
  detailsSheet.columns = fieldsToInclude.map(field => columnDefinitions[field as keyof typeof columnDefinitions]);

  // Add data rows
  report.records.forEach(record => {
    const row: any = {};
    
    if (fieldsToInclude.includes('matricula')) row.matricula = record.matricula;
    if (fieldsToInclude.includes('nome')) row.nome = record.user_name;
    if (fieldsToInclude.includes('produto')) row.produto = record.product_name;
    if (fieldsToInclude.includes('quantidade')) row.quantidade = record.quantity;
    if (fieldsToInclude.includes('precoUnitario')) row.precoUnitario = `R$ ${record.unit_price.toFixed(2)}`;
    if (fieldsToInclude.includes('precoTotal')) row.precoTotal = `R$ ${record.total_value.toFixed(2)}`;
    if (fieldsToInclude.includes('dataHora')) {
      const date = new Date(record.consumed_at);
      row.dataHora = date.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }

    detailsSheet.addRow(row);
  });

  // Style header row
  detailsSheet.getRow(1).font = { bold: true };
  detailsSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4CAF50' }, // Green
  };
  detailsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  // Create Monthly Totals Sheet (always included for complete report)
  if (options.type === 'complete' && report.monthlyTotals.length > 0) {
    const totalsSheet = workbook.addWorksheet('Totais Mensais');
    
    totalsSheet.columns = [
      { header: 'Matrícula', key: 'matricula', width: 15 },
      { header: 'Nome Completo', key: 'nome', width: 30 },
      { header: 'Total Mês', key: 'total', width: 18 },
    ];

    report.monthlyTotals.forEach(userTotal => {
      totalsSheet.addRow({
        matricula: userTotal.matricula,
        nome: userTotal.user_name,
        total: `R$ ${userTotal.monthly_total.toFixed(2)}`,
      });
    });

    // Style header row
    totalsSheet.getRow(1).font = { bold: true };
    totalsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2196F3' }, // Blue
    };
    totalsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  }

  return workbook;
}
