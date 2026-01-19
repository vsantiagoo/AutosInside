import { db, pool } from "./db";
import { eq, and, gte, lte, sql, desc, asc, ilike, or } from "drizzle-orm";
import {
  users, sectors, products, stockTransactions, consumptions,
  type User, type InsertUser, type UpdateUserLimit,
  type Sector, type InsertSector,
  type Product, type ProductWithSector,
  type Consumption, type ConsumptionWithDetails,
  type StockTransaction, type InsertStockTransaction, type StockTransactionWithProduct,
  type SectorReport, type TopConsumedItem,
  type SectorPerformanceIndicators, type ProductDetailedInfo,
  type DailyConsumptionTotal, type StockSnapshot, type StockMovementFilters,
  type PurchaseRecommendation,
} from "@shared/schema";
import bcrypt from "bcryptjs";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByMatricula(matricula: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser & { password_hash: string | null }): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser> & { password_hash?: string }): Promise<User | undefined>;
  updateUserLimit(userId: number, limit: UpdateUserLimit): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getSector(id: number): Promise<Sector | undefined>;
  getAllSectors(): Promise<Sector[]>;
  createSector(sector: InsertSector): Promise<Sector>;
  updateSector(id: number, sector: InsertSector): Promise<Sector | undefined>;
  deleteSector(id: number): Promise<boolean>;
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<ProductWithSector[]>;
  getProductsBySector(sectorId: number): Promise<ProductDetailedInfo[]>;
  createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product>;
  bulkCreateProducts(products: Omit<Product, 'id' | 'created_at' | 'updated_at'>[]): Promise<number>;
  getLowStockProducts(): Promise<ProductWithSector[]>;
  getLowStockProductsBySector(sectorId?: number): Promise<ProductWithSector[]>;
  updateProduct(id: number, product: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;
  getStockTransaction(id: number): Promise<StockTransaction | undefined>;
  getAllStockTransactions(): Promise<StockTransactionWithProduct[]>;
  getStockTransactionsByPeriod(startDate: string, endDate: string): Promise<StockTransactionWithProduct[]>;
  getStockTransactionsWithFilters(filters: StockMovementFilters): Promise<StockTransactionWithProduct[]>;
  createStockTransaction(transaction: Omit<StockTransaction, 'id' | 'created_at'>): Promise<StockTransaction>;
  getStockSnapshots(sectorId?: number): Promise<StockSnapshot[]>;
  getPurchaseRecommendations(sectorId?: number): Promise<PurchaseRecommendation[]>;
  getConsumption(id: number): Promise<Consumption | undefined>;
  getAllConsumptions(): Promise<ConsumptionWithDetails[]>;
  getRecentConsumptions(limit: number): Promise<ConsumptionWithDetails[]>;
  getUserConsumptions(userId: number, startDate?: string, endDate?: string): Promise<ConsumptionWithDetails[]>;
  getConsumptionsByPeriod(startDate: string, endDate: string): Promise<ConsumptionWithDetails[]>;
  getUserMonthlyTotal(userId: number, year: number, month: number): Promise<number>;
  getTopConsumedItems(limit: number): Promise<TopConsumedItem[]>;
  createConsumption(consumption: Omit<Consumption, 'id' | 'consumed_at'>): Promise<Consumption>;
  getInventoryKPIsBySector(): Promise<any[]>;
  getTotalInventoryValue(): Promise<number>;
  getTotalInventoryValueBySector(sectorId?: number): Promise<number>;
  getSectorPerformanceIndicators(sectorId: number): Promise<SectorPerformanceIndicators>;
  getSectorReport(sectorId: number): Promise<SectorReport>;
  getStockTransactionsBySector(sectorId: number): Promise<StockTransactionWithProduct[]>;
  getConsumptionsBySectorAndDateRange(sectorId: number, startDate: string, endDate: string): Promise<ConsumptionWithDetails[]>;
  getDailyConsumptionTotals(userId: number, startDate: string, endDate: string): Promise<DailyConsumptionTotal[]>;
  getProductConsumptionHistory(productId: number, days: number): Promise<{date: string; qty: number}[]>;
  getGeneralInventoryStats(): Promise<any>;
}

function formatTimestamp(date: Date | null): string {
  if (!date) return new Date().toISOString();
  return date.toISOString();
}

function normalizeUser(row: any): User {
  return {
    id: row.id,
    full_name: row.full_name,
    matricula: row.matricula,
    email: row.email,
    password_hash: row.password_hash,
    role: row.role,
    monthly_limit: row.monthly_limit,
    limit_enabled: Boolean(row.limit_enabled),
    created_at: formatTimestamp(row.created_at),
  };
}

function normalizeProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    sector_id: row.sector_id,
    sku: row.sku,
    category: row.category,
    unit_measure: row.unit_measure,
    unit_price: row.unit_price || 0,
    sale_price: row.sale_price,
    stock_quantity: row.stock_quantity || 0,
    min_quantity: row.min_quantity,
    max_quantity: row.max_quantity,
    total_in: row.total_in || 0,
    total_out: row.total_out || 0,
    photo_path: row.photo_path,
    low_stock_threshold: row.low_stock_threshold,
    supplier: row.supplier,
    last_purchase_date: row.last_purchase_date,
    last_count_date: row.last_count_date,
    expiry_date: row.expiry_date,
    warranty_date: row.warranty_date,
    asset_number: row.asset_number,
    status: row.status,
    visible_to_users: Boolean(row.visible_to_users),
    created_at: formatTimestamp(row.created_at),
    updated_at: formatTimestamp(row.updated_at),
  };
}

class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id));
    return row ? normalizeUser(row) : undefined;
  }

  async getUserByMatricula(matricula: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(ilike(users.matricula, matricula));
    return row ? normalizeUser(row) : undefined;
  }

  async getAllUsers(): Promise<User[]> {
    const rows = await db.select().from(users).orderBy(desc(users.created_at));
    return rows.map(normalizeUser);
  }

  async createUser(insertUser: InsertUser & { password_hash: string | null }): Promise<User> {
    const [row] = await db.insert(users).values({
      full_name: insertUser.full_name,
      matricula: insertUser.matricula,
      email: insertUser.email || null,
      password_hash: insertUser.password_hash,
      role: insertUser.role || 'user',
    }).returning();
    return normalizeUser(row);
  }

  async updateUser(id: number, updateData: Partial<InsertUser> & { password_hash?: string }): Promise<User | undefined> {
    const updateValues: any = {};
    if (updateData.full_name !== undefined) updateValues.full_name = updateData.full_name;
    if (updateData.matricula !== undefined) updateValues.matricula = updateData.matricula;
    if (updateData.email !== undefined) updateValues.email = updateData.email || null;
    if (updateData.role !== undefined) updateValues.role = updateData.role;
    if (updateData.password_hash !== undefined) updateValues.password_hash = updateData.password_hash;
    
    if (Object.keys(updateValues).length === 0) return this.getUser(id);
    
    await db.update(users).set(updateValues).where(eq(users.id, id));
    return this.getUser(id);
  }

  async updateUserLimit(userId: number, limit: UpdateUserLimit): Promise<User | undefined> {
    await db.update(users).set({
      monthly_limit: limit.monthly_limit,
      limit_enabled: limit.limit_enabled,
    }).where(eq(users.id, userId));
    return this.getUser(userId);
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getSector(id: number): Promise<Sector | undefined> {
    const [row] = await db.select().from(sectors).where(eq(sectors.id, id));
    return row;
  }

  async getAllSectors(): Promise<Sector[]> {
    return await db.select().from(sectors).orderBy(asc(sectors.name));
  }

  async createSector(insertSector: InsertSector): Promise<Sector> {
    const [row] = await db.insert(sectors).values({ name: insertSector.name }).returning();
    return row;
  }

  async updateSector(id: number, updateData: InsertSector): Promise<Sector | undefined> {
    await db.update(sectors).set({ name: updateData.name }).where(eq(sectors.id, id));
    return this.getSector(id);
  }

  async deleteSector(id: number): Promise<boolean> {
    const result = await db.delete(sectors).where(eq(sectors.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [row] = await db.select().from(products).where(eq(products.id, id));
    return row ? normalizeProduct(row) : undefined;
  }

  async getAllProducts(): Promise<ProductWithSector[]> {
    const rows = await db.select({
      id: products.id,
      name: products.name,
      sector_id: products.sector_id,
      sku: products.sku,
      category: products.category,
      unit_measure: products.unit_measure,
      unit_price: products.unit_price,
      sale_price: products.sale_price,
      stock_quantity: products.stock_quantity,
      min_quantity: products.min_quantity,
      max_quantity: products.max_quantity,
      total_in: products.total_in,
      total_out: products.total_out,
      photo_path: products.photo_path,
      low_stock_threshold: products.low_stock_threshold,
      supplier: products.supplier,
      last_purchase_date: products.last_purchase_date,
      last_count_date: products.last_count_date,
      expiry_date: products.expiry_date,
      warranty_date: products.warranty_date,
      asset_number: products.asset_number,
      status: products.status,
      visible_to_users: products.visible_to_users,
      created_at: products.created_at,
      updated_at: products.updated_at,
      sector_name: sectors.name,
    }).from(products)
      .leftJoin(sectors, eq(products.sector_id, sectors.id))
      .orderBy(desc(products.created_at));
    
    return rows.map(row => ({
      ...normalizeProduct(row),
      sector_name: row.sector_name ?? undefined,
    }));
  }

  async getProductsBySector(sectorId: number): Promise<ProductDetailedInfo[]> {
    const rows = await db.select({
      id: products.id,
      name: products.name,
      sector_id: products.sector_id,
      sku: products.sku,
      category: products.category,
      unit_measure: products.unit_measure,
      unit_price: products.unit_price,
      sale_price: products.sale_price,
      stock_quantity: products.stock_quantity,
      min_quantity: products.min_quantity,
      max_quantity: products.max_quantity,
      total_in: products.total_in,
      total_out: products.total_out,
      photo_path: products.photo_path,
      low_stock_threshold: products.low_stock_threshold,
      supplier: products.supplier,
      last_purchase_date: products.last_purchase_date,
      last_count_date: products.last_count_date,
      expiry_date: products.expiry_date,
      warranty_date: products.warranty_date,
      asset_number: products.asset_number,
      status: products.status,
      visible_to_users: products.visible_to_users,
      created_at: products.created_at,
      updated_at: products.updated_at,
      sector_name: sectors.name,
    }).from(products)
      .leftJoin(sectors, eq(products.sector_id, sectors.id))
      .where(eq(products.sector_id, sectorId))
      .orderBy(asc(products.name));

    return rows.map(row => {
      const product = normalizeProduct(row);
      const inventory_value = product.stock_quantity * product.unit_price;
      let stock_status: 'OK' | 'Baixo' | 'Zerado' | 'Excesso' = 'OK';
      if (product.stock_quantity === 0) stock_status = 'Zerado';
      else if (product.low_stock_threshold && product.stock_quantity <= product.low_stock_threshold) stock_status = 'Baixo';
      else if (product.max_quantity && product.stock_quantity > product.max_quantity) stock_status = 'Excesso';
      
      return {
        ...product,
        sector_name: row.sector_name ?? undefined,
        inventory_value,
        stock_status,
        turnover_rate: null,
        coverage_days: null,
      };
    });
  }

  async createProduct(insertProduct: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    const [row] = await db.insert(products).values({
      name: insertProduct.name,
      sector_id: insertProduct.sector_id,
      sku: insertProduct.sku,
      category: insertProduct.category,
      unit_measure: insertProduct.unit_measure,
      unit_price: insertProduct.unit_price || 0,
      sale_price: insertProduct.sale_price,
      stock_quantity: insertProduct.stock_quantity || 0,
      min_quantity: insertProduct.min_quantity,
      max_quantity: insertProduct.max_quantity,
      total_in: insertProduct.total_in || 0,
      total_out: insertProduct.total_out || 0,
      photo_path: insertProduct.photo_path,
      low_stock_threshold: insertProduct.low_stock_threshold || 10,
      supplier: insertProduct.supplier,
      last_purchase_date: insertProduct.last_purchase_date,
      last_count_date: insertProduct.last_count_date,
      expiry_date: insertProduct.expiry_date,
      warranty_date: insertProduct.warranty_date,
      asset_number: insertProduct.asset_number,
      status: insertProduct.status || 'Ativo',
      visible_to_users: insertProduct.visible_to_users ?? true,
    }).returning();
    return normalizeProduct(row);
  }

  async bulkCreateProducts(productList: Omit<Product, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
    if (productList.length === 0) return 0;
    const values = productList.map(p => ({
      name: p.name,
      sector_id: p.sector_id,
      sku: p.sku,
      category: p.category,
      unit_measure: p.unit_measure,
      unit_price: p.unit_price || 0,
      sale_price: p.sale_price,
      stock_quantity: p.stock_quantity || 0,
      min_quantity: p.min_quantity,
      max_quantity: p.max_quantity,
      total_in: p.total_in || 0,
      total_out: p.total_out || 0,
      photo_path: p.photo_path,
      low_stock_threshold: p.low_stock_threshold || 10,
      supplier: p.supplier,
      last_purchase_date: p.last_purchase_date,
      last_count_date: p.last_count_date,
      expiry_date: p.expiry_date,
      warranty_date: p.warranty_date,
      asset_number: p.asset_number,
      status: p.status || 'Ativo',
      visible_to_users: p.visible_to_users ?? true,
    }));
    await db.insert(products).values(values);
    return productList.length;
  }

  async getLowStockProducts(): Promise<ProductWithSector[]> {
    const rows = await db.select({
      id: products.id,
      name: products.name,
      sector_id: products.sector_id,
      sku: products.sku,
      category: products.category,
      unit_measure: products.unit_measure,
      unit_price: products.unit_price,
      sale_price: products.sale_price,
      stock_quantity: products.stock_quantity,
      min_quantity: products.min_quantity,
      max_quantity: products.max_quantity,
      total_in: products.total_in,
      total_out: products.total_out,
      photo_path: products.photo_path,
      low_stock_threshold: products.low_stock_threshold,
      supplier: products.supplier,
      last_purchase_date: products.last_purchase_date,
      last_count_date: products.last_count_date,
      expiry_date: products.expiry_date,
      warranty_date: products.warranty_date,
      asset_number: products.asset_number,
      status: products.status,
      visible_to_users: products.visible_to_users,
      created_at: products.created_at,
      updated_at: products.updated_at,
      sector_name: sectors.name,
    }).from(products)
      .leftJoin(sectors, eq(products.sector_id, sectors.id))
      .where(sql`${products.stock_quantity} <= ${products.low_stock_threshold}`)
      .orderBy(asc(products.stock_quantity));
    
    return rows.map(row => ({
      ...normalizeProduct(row),
      sector_name: row.sector_name ?? undefined,
    }));
  }

  async getLowStockProductsBySector(sectorId?: number): Promise<ProductWithSector[]> {
    if (sectorId === undefined) return this.getLowStockProducts();
    
    const rows = await db.select({
      id: products.id,
      name: products.name,
      sector_id: products.sector_id,
      sku: products.sku,
      category: products.category,
      unit_measure: products.unit_measure,
      unit_price: products.unit_price,
      sale_price: products.sale_price,
      stock_quantity: products.stock_quantity,
      min_quantity: products.min_quantity,
      max_quantity: products.max_quantity,
      total_in: products.total_in,
      total_out: products.total_out,
      photo_path: products.photo_path,
      low_stock_threshold: products.low_stock_threshold,
      supplier: products.supplier,
      last_purchase_date: products.last_purchase_date,
      last_count_date: products.last_count_date,
      expiry_date: products.expiry_date,
      warranty_date: products.warranty_date,
      asset_number: products.asset_number,
      status: products.status,
      visible_to_users: products.visible_to_users,
      created_at: products.created_at,
      updated_at: products.updated_at,
      sector_name: sectors.name,
    }).from(products)
      .leftJoin(sectors, eq(products.sector_id, sectors.id))
      .where(and(
        sql`${products.stock_quantity} <= ${products.low_stock_threshold}`,
        eq(products.sector_id, sectorId)
      ))
      .orderBy(asc(products.stock_quantity));
    
    return rows.map(row => ({
      ...normalizeProduct(row),
      sector_name: row.sector_name ?? undefined,
    }));
  }

  async updateProduct(id: number, updateData: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Promise<Product | undefined> {
    const updateValues: any = { updated_at: new Date() };
    
    if (updateData.name !== undefined) updateValues.name = updateData.name;
    if (updateData.sector_id !== undefined) updateValues.sector_id = updateData.sector_id;
    if (updateData.sku !== undefined) updateValues.sku = updateData.sku;
    if (updateData.category !== undefined) updateValues.category = updateData.category;
    if (updateData.unit_measure !== undefined) updateValues.unit_measure = updateData.unit_measure;
    if (updateData.unit_price !== undefined) updateValues.unit_price = updateData.unit_price;
    if (updateData.sale_price !== undefined) updateValues.sale_price = updateData.sale_price;
    if (updateData.stock_quantity !== undefined) updateValues.stock_quantity = updateData.stock_quantity;
    if (updateData.min_quantity !== undefined) updateValues.min_quantity = updateData.min_quantity;
    if (updateData.max_quantity !== undefined) updateValues.max_quantity = updateData.max_quantity;
    if (updateData.total_in !== undefined) updateValues.total_in = updateData.total_in;
    if (updateData.total_out !== undefined) updateValues.total_out = updateData.total_out;
    if (updateData.photo_path !== undefined) updateValues.photo_path = updateData.photo_path;
    if (updateData.low_stock_threshold !== undefined) updateValues.low_stock_threshold = updateData.low_stock_threshold;
    if (updateData.supplier !== undefined) updateValues.supplier = updateData.supplier;
    if (updateData.last_purchase_date !== undefined) updateValues.last_purchase_date = updateData.last_purchase_date;
    if (updateData.last_count_date !== undefined) updateValues.last_count_date = updateData.last_count_date;
    if (updateData.expiry_date !== undefined) updateValues.expiry_date = updateData.expiry_date;
    if (updateData.warranty_date !== undefined) updateValues.warranty_date = updateData.warranty_date;
    if (updateData.asset_number !== undefined) updateValues.asset_number = updateData.asset_number;
    if (updateData.status !== undefined) updateValues.status = updateData.status;
    if (updateData.visible_to_users !== undefined) updateValues.visible_to_users = updateData.visible_to_users;
    
    await db.update(products).set(updateValues).where(eq(products.id, id));
    return this.getProduct(id);
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getStockTransaction(id: number): Promise<StockTransaction | undefined> {
    const [row] = await db.select().from(stockTransactions).where(eq(stockTransactions.id, id));
    if (!row) return undefined;
    return {
      ...row,
      created_at: formatTimestamp(row.created_at),
    };
  }

  async getAllStockTransactions(): Promise<StockTransactionWithProduct[]> {
    const rows = await db.select({
      id: stockTransactions.id,
      product_id: stockTransactions.product_id,
      user_id: stockTransactions.user_id,
      transaction_type: stockTransactions.transaction_type,
      change: stockTransactions.change,
      reason: stockTransactions.reason,
      document_origin: stockTransactions.document_origin,
      notes: stockTransactions.notes,
      created_at: stockTransactions.created_at,
      product_name: products.name,
      photo_path: products.photo_path,
      sector_id: products.sector_id,
      sector_name: sectors.name,
      user_name: users.full_name,
    }).from(stockTransactions)
      .leftJoin(products, eq(stockTransactions.product_id, products.id))
      .leftJoin(sectors, eq(products.sector_id, sectors.id))
      .leftJoin(users, eq(stockTransactions.user_id, users.id))
      .orderBy(desc(stockTransactions.created_at));
    
    return rows.map(row => ({
      id: row.id,
      product_id: row.product_id,
      user_id: row.user_id,
      transaction_type: row.transaction_type,
      change: row.change,
      reason: row.reason,
      document_origin: row.document_origin,
      notes: row.notes,
      created_at: formatTimestamp(row.created_at),
      product_name: row.product_name ?? undefined,
      photo_path: row.photo_path,
      sector_id: row.sector_id,
      sector_name: row.sector_name ?? undefined,
      user_name: row.user_name ?? undefined,
    }));
  }

  async getStockTransactionsByPeriod(startDate: string, endDate: string): Promise<StockTransactionWithProduct[]> {
    const rows = await db.select({
      id: stockTransactions.id,
      product_id: stockTransactions.product_id,
      user_id: stockTransactions.user_id,
      transaction_type: stockTransactions.transaction_type,
      change: stockTransactions.change,
      reason: stockTransactions.reason,
      document_origin: stockTransactions.document_origin,
      notes: stockTransactions.notes,
      created_at: stockTransactions.created_at,
      product_name: products.name,
      photo_path: products.photo_path,
      sector_id: products.sector_id,
      sector_name: sectors.name,
      user_name: users.full_name,
    }).from(stockTransactions)
      .leftJoin(products, eq(stockTransactions.product_id, products.id))
      .leftJoin(sectors, eq(products.sector_id, sectors.id))
      .leftJoin(users, eq(stockTransactions.user_id, users.id))
      .where(and(
        gte(sql`DATE(${stockTransactions.created_at})`, startDate),
        lte(sql`DATE(${stockTransactions.created_at})`, endDate)
      ))
      .orderBy(desc(stockTransactions.created_at));
    
    return rows.map(row => ({
      id: row.id,
      product_id: row.product_id,
      user_id: row.user_id,
      transaction_type: row.transaction_type,
      change: row.change,
      reason: row.reason,
      document_origin: row.document_origin,
      notes: row.notes,
      created_at: formatTimestamp(row.created_at),
      product_name: row.product_name ?? undefined,
      photo_path: row.photo_path,
      sector_id: row.sector_id,
      sector_name: row.sector_name ?? undefined,
      user_name: row.user_name ?? undefined,
    }));
  }

  async getStockTransactionsWithFilters(filters: StockMovementFilters): Promise<StockTransactionWithProduct[]> {
    const conditions = [];
    
    if (filters.sector_id !== undefined) {
      conditions.push(eq(products.sector_id, filters.sector_id));
    }
    if (filters.product_id !== undefined) {
      conditions.push(eq(stockTransactions.product_id, filters.product_id));
    }
    if (filters.transaction_type) {
      conditions.push(eq(stockTransactions.transaction_type, filters.transaction_type));
    }
    if (filters.user_id !== undefined) {
      conditions.push(eq(stockTransactions.user_id, filters.user_id));
    }
    if (filters.start_date) {
      conditions.push(gte(sql`DATE(${stockTransactions.created_at})`, filters.start_date));
    }
    if (filters.end_date) {
      conditions.push(lte(sql`DATE(${stockTransactions.created_at})`, filters.end_date));
    }
    
    const rows = await db.select({
      id: stockTransactions.id,
      product_id: stockTransactions.product_id,
      user_id: stockTransactions.user_id,
      transaction_type: stockTransactions.transaction_type,
      change: stockTransactions.change,
      reason: stockTransactions.reason,
      document_origin: stockTransactions.document_origin,
      notes: stockTransactions.notes,
      created_at: stockTransactions.created_at,
      product_name: products.name,
      photo_path: products.photo_path,
      sector_id: products.sector_id,
      sector_name: sectors.name,
      user_name: users.full_name,
    }).from(stockTransactions)
      .leftJoin(products, eq(stockTransactions.product_id, products.id))
      .leftJoin(sectors, eq(products.sector_id, sectors.id))
      .leftJoin(users, eq(stockTransactions.user_id, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(stockTransactions.created_at));
    
    return rows.map(row => ({
      id: row.id,
      product_id: row.product_id,
      user_id: row.user_id,
      transaction_type: row.transaction_type,
      change: row.change,
      reason: row.reason,
      document_origin: row.document_origin,
      notes: row.notes,
      created_at: formatTimestamp(row.created_at),
      product_name: row.product_name ?? undefined,
      photo_path: row.photo_path,
      sector_id: row.sector_id,
      sector_name: row.sector_name ?? undefined,
      user_name: row.user_name ?? undefined,
    }));
  }

  async createStockTransaction(transaction: Omit<StockTransaction, 'id' | 'created_at'>): Promise<StockTransaction> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const insertResult = await client.query(
        `INSERT INTO stock_transactions (product_id, user_id, transaction_type, change, reason, document_origin, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [transaction.product_id, transaction.user_id, transaction.transaction_type, transaction.change, transaction.reason, transaction.document_origin, transaction.notes]
      );
      
      if (transaction.change > 0) {
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity + $1, total_in = total_in + $1, updated_at = NOW() WHERE id = $2`,
          [transaction.change, transaction.product_id]
        );
      } else if (transaction.change < 0) {
        await client.query(
          `UPDATE products SET stock_quantity = stock_quantity + $1, total_out = total_out + $2, updated_at = NOW() WHERE id = $3`,
          [transaction.change, Math.abs(transaction.change), transaction.product_id]
        );
      }
      
      await client.query('COMMIT');
      
      const row = insertResult.rows[0];
      return {
        ...row,
        created_at: formatTimestamp(row.created_at),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getStockSnapshots(sectorId?: number): Promise<StockSnapshot[]> {
    const conditions = sectorId !== undefined ? eq(products.sector_id, sectorId) : undefined;
    
    const rows = await db.select({
      product_id: products.id,
      product_name: products.name,
      sector_id: products.sector_id,
      sector_name: sectors.name,
      current_stock: products.stock_quantity,
      min_quantity: products.min_quantity,
      low_stock_threshold: products.low_stock_threshold,
      total_in: products.total_in,
      total_out: products.total_out,
      unit_price: products.unit_price,
      photo_path: products.photo_path,
    }).from(products)
      .leftJoin(sectors, eq(products.sector_id, sectors.id))
      .where(conditions)
      .orderBy(asc(products.name));
    
    return rows.map(row => ({
      product_id: row.product_id,
      product_name: row.product_name,
      sector_id: row.sector_id,
      sector_name: row.sector_name,
      current_stock: row.current_stock || 0,
      min_quantity: row.min_quantity,
      low_stock_threshold: row.low_stock_threshold,
      total_in: row.total_in || 0,
      total_out: row.total_out || 0,
      unit_price: row.unit_price || 0,
      inventory_value: (row.current_stock || 0) * (row.unit_price || 0),
      is_low_stock: (row.current_stock || 0) <= (row.low_stock_threshold || 0),
      is_out_of_stock: (row.current_stock || 0) === 0,
      needs_purchase: (row.min_quantity !== null && (row.current_stock || 0) <= row.min_quantity) || (row.current_stock || 0) === 0,
      photo_path: row.photo_path,
    }));
  }

  async getPurchaseRecommendations(sectorId?: number): Promise<PurchaseRecommendation[]> {
    const snapshots = await this.getStockSnapshots(sectorId);
    return snapshots
      .filter(s => s.needs_purchase)
      .map(s => {
        const recommendedQty = s.min_quantity ? Math.max(s.min_quantity - s.current_stock, 0) : 10;
        let priority: 'high' | 'medium' | 'low' = 'low';
        if (s.is_out_of_stock || (s.min_quantity && s.current_stock <= s.min_quantity * 0.5)) {
          priority = 'high';
        } else if (s.min_quantity && s.current_stock <= s.min_quantity) {
          priority = 'medium';
        }
        return {
          productId: s.product_id,
          productName: s.product_name,
          currentStock: s.current_stock,
          recommendedQuantity: recommendedQty,
          estimatedCost: recommendedQty * s.unit_price,
          priority,
          photoPath: s.photo_path || null,
        };
      })
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
  }

  async getConsumption(id: number): Promise<Consumption | undefined> {
    const [row] = await db.select().from(consumptions).where(eq(consumptions.id, id));
    if (!row) return undefined;
    return {
      ...row,
      consumed_at: formatTimestamp(row.consumed_at),
    };
  }

  async getAllConsumptions(): Promise<ConsumptionWithDetails[]> {
    const rows = await db.select({
      id: consumptions.id,
      user_id: consumptions.user_id,
      product_id: consumptions.product_id,
      qty: consumptions.qty,
      unit_price: consumptions.unit_price,
      total_price: consumptions.total_price,
      consumed_at: consumptions.consumed_at,
      user_name: users.full_name,
      user_matricula: users.matricula,
      product_name: products.name,
      photo_path: products.photo_path,
    }).from(consumptions)
      .leftJoin(users, eq(consumptions.user_id, users.id))
      .leftJoin(products, eq(consumptions.product_id, products.id))
      .orderBy(desc(consumptions.consumed_at));
    
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      product_id: row.product_id,
      qty: row.qty,
      unit_price: row.unit_price,
      total_price: row.total_price,
      consumed_at: formatTimestamp(row.consumed_at),
      user_name: row.user_name ?? undefined,
      user_matricula: row.user_matricula ?? undefined,
      product_name: row.product_name ?? undefined,
      photo_path: row.photo_path,
    }));
  }

  async getRecentConsumptions(limit: number): Promise<ConsumptionWithDetails[]> {
    const rows = await db.select({
      id: consumptions.id,
      user_id: consumptions.user_id,
      product_id: consumptions.product_id,
      qty: consumptions.qty,
      unit_price: consumptions.unit_price,
      total_price: consumptions.total_price,
      consumed_at: consumptions.consumed_at,
      user_name: users.full_name,
      user_matricula: users.matricula,
      product_name: products.name,
      photo_path: products.photo_path,
    }).from(consumptions)
      .leftJoin(users, eq(consumptions.user_id, users.id))
      .leftJoin(products, eq(consumptions.product_id, products.id))
      .orderBy(desc(consumptions.consumed_at))
      .limit(limit);
    
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      product_id: row.product_id,
      qty: row.qty,
      unit_price: row.unit_price,
      total_price: row.total_price,
      consumed_at: formatTimestamp(row.consumed_at),
      user_name: row.user_name ?? undefined,
      user_matricula: row.user_matricula ?? undefined,
      product_name: row.product_name ?? undefined,
      photo_path: row.photo_path,
    }));
  }

  async getUserConsumptions(userId: number, startDate?: string, endDate?: string): Promise<ConsumptionWithDetails[]> {
    const conditions = [eq(consumptions.user_id, userId)];
    if (startDate) conditions.push(gte(sql`DATE(${consumptions.consumed_at})`, startDate));
    if (endDate) conditions.push(lte(sql`DATE(${consumptions.consumed_at})`, endDate));
    
    const rows = await db.select({
      id: consumptions.id,
      user_id: consumptions.user_id,
      product_id: consumptions.product_id,
      qty: consumptions.qty,
      unit_price: consumptions.unit_price,
      total_price: consumptions.total_price,
      consumed_at: consumptions.consumed_at,
      user_name: users.full_name,
      user_matricula: users.matricula,
      product_name: products.name,
      photo_path: products.photo_path,
    }).from(consumptions)
      .leftJoin(users, eq(consumptions.user_id, users.id))
      .leftJoin(products, eq(consumptions.product_id, products.id))
      .where(and(...conditions))
      .orderBy(desc(consumptions.consumed_at));
    
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      product_id: row.product_id,
      qty: row.qty,
      unit_price: row.unit_price,
      total_price: row.total_price,
      consumed_at: formatTimestamp(row.consumed_at),
      user_name: row.user_name ?? undefined,
      user_matricula: row.user_matricula ?? undefined,
      product_name: row.product_name ?? undefined,
      photo_path: row.photo_path,
    }));
  }

  async getConsumptionsByPeriod(startDate: string, endDate: string): Promise<ConsumptionWithDetails[]> {
    const rows = await db.select({
      id: consumptions.id,
      user_id: consumptions.user_id,
      product_id: consumptions.product_id,
      qty: consumptions.qty,
      unit_price: consumptions.unit_price,
      total_price: consumptions.total_price,
      consumed_at: consumptions.consumed_at,
      user_name: users.full_name,
      user_matricula: users.matricula,
      product_name: products.name,
      photo_path: products.photo_path,
    }).from(consumptions)
      .leftJoin(users, eq(consumptions.user_id, users.id))
      .leftJoin(products, eq(consumptions.product_id, products.id))
      .where(and(
        gte(sql`DATE(${consumptions.consumed_at})`, startDate),
        lte(sql`DATE(${consumptions.consumed_at})`, endDate)
      ))
      .orderBy(desc(consumptions.consumed_at));
    
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      product_id: row.product_id,
      qty: row.qty,
      unit_price: row.unit_price,
      total_price: row.total_price,
      consumed_at: formatTimestamp(row.consumed_at),
      user_name: row.user_name ?? undefined,
      user_matricula: row.user_matricula ?? undefined,
      product_name: row.product_name ?? undefined,
      photo_path: row.photo_path,
    }));
  }

  async getUserMonthlyTotal(userId: number, year: number, month: number): Promise<number> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0];
    
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${consumptions.total_price}), 0)`,
    }).from(consumptions)
      .where(and(
        eq(consumptions.user_id, userId),
        gte(sql`DATE(${consumptions.consumed_at})`, startDate),
        lte(sql`DATE(${consumptions.consumed_at})`, endDate)
      ));
    
    return result[0]?.total || 0;
  }

  async getTopConsumedItems(limit: number): Promise<TopConsumedItem[]> {
    const rows = await db.select({
      product_id: consumptions.product_id,
      product_name: products.name,
      sector_name: sectors.name,
      total_qty: sql<number>`SUM(${consumptions.qty})`,
      total_value: sql<number>`SUM(${consumptions.total_price})`,
      consumption_count: sql<number>`COUNT(*)`,
      photo_path: products.photo_path,
    }).from(consumptions)
      .leftJoin(products, eq(consumptions.product_id, products.id))
      .leftJoin(sectors, eq(products.sector_id, sectors.id))
      .groupBy(consumptions.product_id, products.name, sectors.name, products.photo_path)
      .orderBy(desc(sql`SUM(${consumptions.qty})`))
      .limit(limit);
    
    return rows.map(row => ({
      product_id: row.product_id,
      product_name: row.product_name || '',
      sector_name: row.sector_name,
      total_qty: Number(row.total_qty) || 0,
      total_value: Number(row.total_value) || 0,
      consumption_count: Number(row.consumption_count) || 0,
      photo_path: row.photo_path,
    }));
  }

  async createConsumption(consumption: Omit<Consumption, 'id' | 'consumed_at'>): Promise<Consumption> {
    const [row] = await db.insert(consumptions).values({
      user_id: consumption.user_id,
      product_id: consumption.product_id,
      qty: consumption.qty,
      unit_price: consumption.unit_price,
      total_price: consumption.total_price,
    }).returning();
    
    await db.update(products).set({
      stock_quantity: sql`${products.stock_quantity} - ${consumption.qty}`,
      total_out: sql`${products.total_out} + ${consumption.qty}`,
      updated_at: new Date(),
    }).where(eq(products.id, consumption.product_id));
    
    return {
      ...row,
      consumed_at: formatTimestamp(row.consumed_at),
    };
  }

  async getInventoryKPIsBySector(): Promise<any[]> {
    const rows = await db.select({
      sector_id: products.sector_id,
      sector_name: sectors.name,
      total_products: sql<number>`COUNT(*)`,
      total_value: sql<number>`SUM(${products.stock_quantity} * ${products.unit_price})`,
      low_stock_count: sql<number>`SUM(CASE WHEN ${products.stock_quantity} <= ${products.low_stock_threshold} AND ${products.stock_quantity} > 0 THEN 1 ELSE 0 END)`,
      out_of_stock_count: sql<number>`SUM(CASE WHEN ${products.stock_quantity} = 0 THEN 1 ELSE 0 END)`,
    }).from(products)
      .leftJoin(sectors, eq(products.sector_id, sectors.id))
      .groupBy(products.sector_id, sectors.name);
    
    return rows.map(row => ({
      sector_id: row.sector_id,
      sector_name: row.sector_name || 'Sem Setor',
      total_products: Number(row.total_products) || 0,
      total_value: Number(row.total_value) || 0,
      low_stock_count: Number(row.low_stock_count) || 0,
      out_of_stock_count: Number(row.out_of_stock_count) || 0,
      turnover_rate: null,
      coverage_days: null,
    }));
  }

  async getTotalInventoryValue(): Promise<number> {
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${products.stock_quantity} * ${products.unit_price}), 0)`,
    }).from(products);
    return result[0]?.total || 0;
  }

  async getTotalInventoryValueBySector(sectorId?: number): Promise<number> {
    const conditions = sectorId !== undefined ? eq(products.sector_id, sectorId) : undefined;
    const result = await db.select({
      total: sql<number>`COALESCE(SUM(${products.stock_quantity} * ${products.unit_price}), 0)`,
    }).from(products).where(conditions);
    return result[0]?.total || 0;
  }

  async getSectorPerformanceIndicators(sectorId: number): Promise<SectorPerformanceIndicators> {
    const sector = await this.getSector(sectorId);
    const prods = await this.getProductsBySector(sectorId);
    
    const total_products = prods.length;
    const total_inventory_value = prods.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0);
    const low_stock_count = prods.filter(p => p.stock_status === 'Baixo').length;
    const out_of_stock_count = prods.filter(p => p.stock_status === 'Zerado').length;
    
    return {
      sector_id: sectorId,
      sector_name: sector?.name || '',
      total_products,
      total_inventory_value,
      low_stock_count,
      out_of_stock_count,
      stock_turnover: null,
      coverage_days: null,
      stockout_frequency: out_of_stock_count,
      immobilized_value: total_inventory_value,
    };
  }

  async getSectorReport(sectorId: number): Promise<SectorReport> {
    const sector = await this.getSector(sectorId);
    if (!sector) throw new Error('Sector not found');
    
    const prods = await this.getProductsBySector(sectorId);
    const transactions = await this.getStockTransactionsBySector(sectorId);
    const allConsumptions = await this.getAllConsumptions();
    const sectorConsumptions = allConsumptions.filter(c => {
      const prod = prods.find(p => p.id === c.product_id);
      return !!prod;
    });
    
    return {
      sector,
      products: prods,
      stockTransactions: transactions,
      consumptions: sectorConsumptions,
      summary: {
        totalProducts: prods.length,
        totalValue: prods.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0),
        totalIn: prods.reduce((sum, p) => sum + (p.total_in || 0), 0),
        totalOut: prods.reduce((sum, p) => sum + (p.total_out || 0), 0),
        lowStockCount: prods.filter(p => p.stock_status === 'Baixo').length,
        outOfStockCount: prods.filter(p => p.stock_status === 'Zerado').length,
      },
    };
  }

  async getStockTransactionsBySector(sectorId: number): Promise<StockTransactionWithProduct[]> {
    return this.getStockTransactionsWithFilters({ sector_id: sectorId });
  }

  async getConsumptionsBySectorAndDateRange(sectorId: number, startDate: string, endDate: string): Promise<ConsumptionWithDetails[]> {
    const rows = await db.select({
      id: consumptions.id,
      user_id: consumptions.user_id,
      product_id: consumptions.product_id,
      qty: consumptions.qty,
      unit_price: consumptions.unit_price,
      total_price: consumptions.total_price,
      consumed_at: consumptions.consumed_at,
      user_name: users.full_name,
      user_matricula: users.matricula,
      product_name: products.name,
      photo_path: products.photo_path,
    }).from(consumptions)
      .leftJoin(users, eq(consumptions.user_id, users.id))
      .leftJoin(products, eq(consumptions.product_id, products.id))
      .where(and(
        eq(products.sector_id, sectorId),
        gte(sql`DATE(${consumptions.consumed_at})`, startDate),
        lte(sql`DATE(${consumptions.consumed_at})`, endDate)
      ))
      .orderBy(desc(consumptions.consumed_at));
    
    return rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      product_id: row.product_id,
      qty: row.qty,
      unit_price: row.unit_price,
      total_price: row.total_price,
      consumed_at: formatTimestamp(row.consumed_at),
      user_name: row.user_name ?? undefined,
      user_matricula: row.user_matricula ?? undefined,
      product_name: row.product_name ?? undefined,
      photo_path: row.photo_path,
    }));
  }

  async getDailyConsumptionTotals(userId: number, startDate: string, endDate: string): Promise<DailyConsumptionTotal[]> {
    const rows = await db.select({
      date: sql<string>`DATE(${consumptions.consumed_at})`,
      totalValue: sql<number>`SUM(${consumptions.total_price})`,
      itemCount: sql<number>`COUNT(*)`,
    }).from(consumptions)
      .where(and(
        eq(consumptions.user_id, userId),
        gte(sql`DATE(${consumptions.consumed_at})`, startDate),
        lte(sql`DATE(${consumptions.consumed_at})`, endDate)
      ))
      .groupBy(sql`DATE(${consumptions.consumed_at})`)
      .orderBy(asc(sql`DATE(${consumptions.consumed_at})`));
    
    return rows.map(row => ({
      date: String(row.date),
      totalValue: Number(row.totalValue) || 0,
      itemCount: Number(row.itemCount) || 0,
    }));
  }

  async getProductConsumptionHistory(productId: number, days: number): Promise<{date: string; qty: number}[]> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const rows = await db.select({
      date: sql<string>`DATE(${consumptions.consumed_at})`,
      qty: sql<number>`SUM(${consumptions.qty})`,
    }).from(consumptions)
      .where(and(
        eq(consumptions.product_id, productId),
        gte(sql`DATE(${consumptions.consumed_at})`, startDate.toISOString().split('T')[0]),
        lte(sql`DATE(${consumptions.consumed_at})`, endDate.toISOString().split('T')[0])
      ))
      .groupBy(sql`DATE(${consumptions.consumed_at})`)
      .orderBy(asc(sql`DATE(${consumptions.consumed_at})`));
    
    return rows.map(row => ({
      date: String(row.date),
      qty: Number(row.qty) || 0,
    }));
  }

  async getGeneralInventoryStats(): Promise<any> {
    const allProducts = await this.getAllProducts();
    const allSectors = await this.getAllSectors();
    
    const total_products = allProducts.length;
    const total_sectors = allSectors.length;
    const total_inventory_value = allProducts.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0);
    const low_stock_items = allProducts.filter(p => p.stock_quantity <= (p.low_stock_threshold || 0) && p.stock_quantity > 0).length;
    const out_of_stock_items = allProducts.filter(p => p.stock_quantity === 0).length;
    
    return {
      kpis: {
        total_products,
        total_sectors,
        total_inventory_value,
        low_stock_items,
        out_of_stock_items,
      },
      bySector: allSectors.map(sector => {
        const sectorProducts = allProducts.filter(p => p.sector_id === sector.id);
        return {
          sector_id: sector.id,
          sector_name: sector.name,
          total_products: sectorProducts.length,
          total_value: sectorProducts.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0),
          products: sectorProducts,
        };
      }),
      allProducts,
      generatedAt: new Date().toISOString(),
    };
  }
}

export const storage = new DatabaseStorage();

export async function seedDatabase(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    console.log('\n📦 PRODUCTION MODE');
    console.log('⚠️  No default users created. Please create an admin user manually.\n');
    return;
  }

  console.log('\n⚠️  DEVELOPMENT MODE - Seeding test data');
  
  const adminMatricula = 'admin';
  const adminPassword = 'Admin123';
  const pwHash = await bcrypt.hash(adminPassword, 10);
  
  try {
    const existing = await storage.getUserByMatricula(adminMatricula);
    if (!existing) {
      await storage.createUser({
        full_name: 'System Administrator',
        matricula: adminMatricula,
        email: null,
        password: adminPassword,
        role: 'admin',
        password_hash: pwHash,
      });
      console.log('✅ Default admin user created (DEVELOPMENT ONLY):');
      console.log('   Matricula: admin');
      console.log('   Password: Admin123');
      console.log('   ⚠️  WARNING: This is a test account. DO NOT use in production!');
    }
  } catch (e: any) {
    console.error('Error seeding admin:', e.message);
  }
  
  const sampleSectors = ['FoodStation', 'Limpeza', 'Materiais de Escritório', 'Máquina de Café', 'Máquinas e Equipamentos'];
  for (const sectorName of sampleSectors) {
    try {
      const allSectors = await storage.getAllSectors();
      const exists = allSectors.find(s => s.name === sectorName);
      if (!exists) {
        await storage.createSector({ name: sectorName });
      }
    } catch (e: any) {
      // Sector already exists or error, continue
    }
  }
  console.log('✅ Sample sectors created\n');
}
