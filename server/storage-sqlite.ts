import db from './db';
import type {
  User,
  InsertUser,
  UpdateUserLimit,
  Sector,
  InsertSector,
  Product,
  InsertProduct,
  ProductWithSector,
  Consumption,
  InsertConsumption,
  ConsumptionWithDetails,
  StockTransaction,
  InsertStockTransaction,
  StockTransactionWithProduct,
  SectorReport,
  TopConsumedItem,
  SectorPerformanceIndicators,
  ProductDetailedInfo,
  UserConsumptionReport,
  RestockPredictionReport,
  SectorMonthlyReport,
  GeneralInventoryReport,
  DailyConsumptionTotal,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByMatricula(matricula: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser & { password_hash: string | null }): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser> & { password_hash?: string }): Promise<User | undefined>;
  updateUserLimit(userId: number, limit: UpdateUserLimit): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;

  // Sectors
  getSector(id: number): Promise<Sector | undefined>;
  getAllSectors(): Promise<Sector[]>;
  createSector(sector: InsertSector): Promise<Sector>;
  updateSector(id: number, sector: InsertSector): Promise<Sector | undefined>;
  deleteSector(id: number): Promise<boolean>;

  // Products
  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<ProductWithSector[]>;
  getProductsBySector(sectorId: number): Promise<ProductDetailedInfo[]>;
  createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product>;
  bulkCreateProducts(products: Omit<Product, 'id' | 'created_at' | 'updated_at'>[]): Promise<number>;
  getLowStockProducts(): Promise<ProductWithSector[]>;
  getLowStockProductsBySector(sectorId?: number): Promise<ProductWithSector[]>;
  updateProduct(id: number, product: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  // Stock Transactions
  getStockTransaction(id: number): Promise<StockTransaction | undefined>;
  getAllStockTransactions(): Promise<StockTransactionWithProduct[]>;
  createStockTransaction(transaction: Omit<StockTransaction, 'id' | 'created_at'>): Promise<StockTransaction>;

  // Consumptions
  getConsumption(id: number): Promise<Consumption | undefined>;
  getAllConsumptions(): Promise<ConsumptionWithDetails[]>;
  getRecentConsumptions(limit: number): Promise<ConsumptionWithDetails[]>;
  getUserConsumptions(userId: number, startDate?: string, endDate?: string): Promise<ConsumptionWithDetails[]>;
  getUserMonthlyTotal(userId: number, year: number, month: number): Promise<number>;
  getTopConsumedItems(limit: number): Promise<TopConsumedItem[]>;
  createConsumption(consumption: Omit<Consumption, 'id' | 'consumed_at'>): Promise<Consumption>;

  // Inventory KPIs
  getInventoryKPIsBySector(): Promise<any[]>;
  getTotalInventoryValue(): Promise<number>;
  getTotalInventoryValueBySector(sectorId?: number): Promise<number>;
  getSectorPerformanceIndicators(sectorId: number): Promise<SectorPerformanceIndicators>;
  
  // Sector Reports
  getSectorReport(sectorId: number): Promise<SectorReport>;
  getStockTransactionsBySector(sectorId: number): Promise<StockTransactionWithProduct[]>;
  
  // Reporting Module - New methods for analytics and predictions
  getConsumptionsBySectorAndDateRange(sectorId: number, startDate: string, endDate: string): Promise<ConsumptionWithDetails[]>;
  getDailyConsumptionTotals(userId: number, startDate: string, endDate: string): Promise<DailyConsumptionTotal[]>;
  getProductConsumptionHistory(productId: number, days: number): Promise<{date: string; qty: number}[]>;
  getGeneralInventoryStats(): Promise<any>;
}

class SqliteStorage implements IStorage {
  // Helper to convert SQLite integers to booleans for User objects
  private normalizeUser(rawUser: any): User {
    if (!rawUser) return rawUser;
    return {
      ...rawUser,
      limit_enabled: Boolean(rawUser.limit_enabled),
    };
  }

  // Helper to convert SQLite integers to booleans for Product objects
  private normalizeProduct(rawProduct: any): Product {
    if (!rawProduct) return rawProduct;
    return {
      ...rawProduct,
      visible_to_users: Boolean(rawProduct.visible_to_users),
    };
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return user ? this.normalizeUser(user) : undefined;
  }

  async getUserByMatricula(matricula: string): Promise<User | undefined> {
    // Case-insensitive matricula lookup
    const user = db.prepare('SELECT * FROM users WHERE LOWER(matricula) = LOWER(?)').get(matricula);
    return user ? this.normalizeUser(user) : undefined;
  }

  async getAllUsers(): Promise<User[]> {
    const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    return users.map(u => this.normalizeUser(u));
  }

  async createUser(insertUser: InsertUser & { password_hash: string | null }): Promise<User> {
    const result = db.prepare(`
      INSERT INTO users (full_name, matricula, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run(insertUser.full_name, insertUser.matricula, insertUser.password_hash, insertUser.role);
    
    return this.getUser(result.lastInsertRowid as number) as Promise<User>;
  }

  async updateUser(id: number, updateData: Partial<InsertUser> & { password_hash?: string }): Promise<User | undefined> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updateData.full_name !== undefined) {
      fields.push('full_name = ?');
      values.push(updateData.full_name);
    }
    if (updateData.role !== undefined) {
      fields.push('role = ?');
      values.push(updateData.role);
    }
    if (updateData.password_hash !== undefined) {
      fields.push('password_hash = ?');
      values.push(updateData.password_hash);
    }

    if (fields.length === 0) return this.getUser(id);

    values.push(id);
    db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return this.getUser(id);
  }

  async updateUserLimit(userId: number, limit: UpdateUserLimit): Promise<User | undefined> {
    db.prepare(`
      UPDATE users 
      SET monthly_limit = ?, limit_enabled = ? 
      WHERE id = ?
    `).run(limit.monthly_limit, limit.limit_enabled ? 1 : 0, userId);
    return this.getUser(userId);
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // Sectors
  async getSector(id: number): Promise<Sector | undefined> {
    return db.prepare('SELECT * FROM sectors WHERE id = ?').get(id) as Sector | undefined;
  }

  async getAllSectors(): Promise<Sector[]> {
    return db.prepare('SELECT * FROM sectors ORDER BY name').all() as Sector[];
  }

  async createSector(insertSector: InsertSector): Promise<Sector> {
    const result = db.prepare('INSERT INTO sectors (name) VALUES (?)').run(insertSector.name);
    return this.getSector(result.lastInsertRowid as number) as Promise<Sector>;
  }

  async updateSector(id: number, updateData: InsertSector): Promise<Sector | undefined> {
    db.prepare('UPDATE sectors SET name = ? WHERE id = ?').run(updateData.name, id);
    return this.getSector(id);
  }

  async deleteSector(id: number): Promise<boolean> {
    const result = db.prepare('DELETE FROM sectors WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // Products
  async getProduct(id: number): Promise<Product | undefined> {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    return product ? this.normalizeProduct(product) : undefined;
  }

  async getAllProducts(): Promise<ProductWithSector[]> {
    return db.prepare(`
      SELECT p.*, s.name as sector_name
      FROM products p
      LEFT JOIN sectors s ON p.sector_id = s.id
      ORDER BY p.created_at DESC
    `).all() as ProductWithSector[];
  }

  async createProduct(insertProduct: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product> {
    const result = db.prepare(`
      INSERT INTO products (
        name, sector_id, sku, category, unit_measure,
        unit_price, sale_price, stock_quantity, 
        min_quantity, max_quantity, total_in, total_out,
        photo_path, low_stock_threshold, supplier,
        last_purchase_date, last_count_date, expiry_date,
        warranty_date, asset_number, status, visible_to_users
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      insertProduct.name,
      insertProduct.sector_id,
      insertProduct.sku,
      insertProduct.category,
      insertProduct.unit_measure,
      insertProduct.unit_price,
      insertProduct.sale_price,
      insertProduct.stock_quantity,
      insertProduct.min_quantity,
      insertProduct.max_quantity,
      insertProduct.total_in,
      insertProduct.total_out,
      insertProduct.photo_path,
      insertProduct.low_stock_threshold || 10,
      insertProduct.supplier,
      insertProduct.last_purchase_date,
      insertProduct.last_count_date,
      insertProduct.expiry_date,
      insertProduct.warranty_date,
      insertProduct.asset_number,
      insertProduct.status,
      insertProduct.visible_to_users ? 1 : 0
    );
    
    return this.getProduct(result.lastInsertRowid as number) as Promise<Product>;
  }

  async bulkCreateProducts(products: Omit<Product, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
    const insertStmt = db.prepare(`
      INSERT INTO products (
        name, sector_id, sku, category, unit_measure,
        unit_price, sale_price, stock_quantity, 
        min_quantity, max_quantity, total_in, total_out,
        photo_path, low_stock_threshold, supplier,
        last_purchase_date, last_count_date, expiry_date,
        warranty_date, asset_number, status, visible_to_users
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((productList: Omit<Product, 'id' | 'created_at' | 'updated_at'>[]) => {
      for (const product of productList) {
        insertStmt.run(
          product.name,
          product.sector_id,
          product.sku,
          product.category,
          product.unit_measure,
          product.unit_price,
          product.sale_price,
          product.stock_quantity,
          product.min_quantity,
          product.max_quantity,
          product.total_in || 0,
          product.total_out || 0,
          product.photo_path || null,
          product.low_stock_threshold || 10,
          product.supplier,
          product.last_purchase_date,
          product.last_count_date,
          product.expiry_date,
          product.warranty_date,
          product.asset_number,
          product.status,
          product.visible_to_users ? 1 : 0
        );
      }
    });

    insertMany(products);
    return products.length;
  }

  async getLowStockProducts(): Promise<ProductWithSector[]> {
    return db.prepare(`
      SELECT p.*, s.name as sector_name
      FROM products p
      LEFT JOIN sectors s ON p.sector_id = s.id
      WHERE p.stock_quantity <= p.low_stock_threshold
      ORDER BY p.stock_quantity ASC
    `).all() as ProductWithSector[];
  }

  async getLowStockProductsBySector(sectorId?: number): Promise<ProductWithSector[]> {
    if (sectorId !== undefined) {
      return db.prepare(`
        SELECT p.*, s.name as sector_name
        FROM products p
        LEFT JOIN sectors s ON p.sector_id = s.id
        WHERE p.stock_quantity <= p.low_stock_threshold
          AND p.sector_id = ?
        ORDER BY p.stock_quantity ASC
      `).all(sectorId) as ProductWithSector[];
    } else {
      return this.getLowStockProducts();
    }
  }

  async updateProduct(id: number, updateData: Partial<Omit<Product, 'id' | 'created_at' | 'updated_at'>>): Promise<Product | undefined> {
    const fields: string[] = [];
    const values: any[] = [];

    if (updateData.name !== undefined) {
      fields.push('name = ?');
      values.push(updateData.name);
    }
    if (updateData.sector_id !== undefined) {
      fields.push('sector_id = ?');
      values.push(updateData.sector_id);
    }
    if (updateData.sku !== undefined) {
      fields.push('sku = ?');
      values.push(updateData.sku);
    }
    if (updateData.category !== undefined) {
      fields.push('category = ?');
      values.push(updateData.category);
    }
    if (updateData.unit_measure !== undefined) {
      fields.push('unit_measure = ?');
      values.push(updateData.unit_measure);
    }
    if (updateData.unit_price !== undefined) {
      fields.push('unit_price = ?');
      values.push(updateData.unit_price);
    }
    if (updateData.sale_price !== undefined) {
      fields.push('sale_price = ?');
      values.push(updateData.sale_price);
    }
    if (updateData.stock_quantity !== undefined) {
      fields.push('stock_quantity = ?');
      values.push(updateData.stock_quantity);
    }
    if (updateData.min_quantity !== undefined) {
      fields.push('min_quantity = ?');
      values.push(updateData.min_quantity);
    }
    if (updateData.max_quantity !== undefined) {
      fields.push('max_quantity = ?');
      values.push(updateData.max_quantity);
    }
    if (updateData.total_in !== undefined) {
      fields.push('total_in = ?');
      values.push(updateData.total_in);
    }
    if (updateData.total_out !== undefined) {
      fields.push('total_out = ?');
      values.push(updateData.total_out);
    }
    if (updateData.photo_path !== undefined) {
      fields.push('photo_path = ?');
      values.push(updateData.photo_path);
    }
    if (updateData.low_stock_threshold !== undefined) {
      fields.push('low_stock_threshold = ?');
      values.push(updateData.low_stock_threshold);
    }
    if (updateData.supplier !== undefined) {
      fields.push('supplier = ?');
      values.push(updateData.supplier);
    }
    if (updateData.last_purchase_date !== undefined) {
      fields.push('last_purchase_date = ?');
      values.push(updateData.last_purchase_date);
    }
    if (updateData.last_count_date !== undefined) {
      fields.push('last_count_date = ?');
      values.push(updateData.last_count_date);
    }
    if (updateData.expiry_date !== undefined) {
      fields.push('expiry_date = ?');
      values.push(updateData.expiry_date);
    }
    if (updateData.warranty_date !== undefined) {
      fields.push('warranty_date = ?');
      values.push(updateData.warranty_date);
    }
    if (updateData.asset_number !== undefined) {
      fields.push('asset_number = ?');
      values.push(updateData.asset_number);
    }
    if (updateData.status !== undefined) {
      fields.push('status = ?');
      values.push(updateData.status);
    }
    if (updateData.visible_to_users !== undefined) {
      fields.push('visible_to_users = ?');
      values.push(updateData.visible_to_users ? 1 : 0);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    if (fields.length > 1) {
      db.prepare(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    
    return this.getProduct(id);
  }

  async deleteProduct(id: number): Promise<boolean> {
    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM consumptions WHERE product_id = ?').run(id);
      db.prepare('DELETE FROM stock_transactions WHERE product_id = ?').run(id);
      const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
      return result.changes > 0;
    });
    
    return deleteTx();
  }

  async getProductsBySector(sectorId: number): Promise<ProductDetailedInfo[]> {
    // Note: inventory_value uses sale_price (customer-facing price) with fallback to unit_price
    const products = db.prepare(`
      SELECT 
        p.*,
        s.name as sector_name,
        (p.stock_quantity * COALESCE(p.sale_price, p.unit_price)) as inventory_value,
        CASE 
          WHEN p.stock_quantity = 0 THEN 'Zerado'
          WHEN p.stock_quantity <= COALESCE(p.low_stock_threshold, 10) THEN 'Baixo'
          WHEN p.max_quantity IS NOT NULL AND p.stock_quantity > p.max_quantity THEN 'Excesso'
          ELSE 'OK'
        END as stock_status
      FROM products p
      LEFT JOIN sectors s ON p.sector_id = s.id
      WHERE p.sector_id = ?
      ORDER BY p.name ASC
    `).all(sectorId) as ProductDetailedInfo[];

    // Calculate turnover and coverage for each product
    return products.map(product => {
      // Get total consumed in last 30 days
      const consumption = db.prepare(`
        SELECT COALESCE(SUM(qty), 0) as total_consumed
        FROM consumptions
        WHERE product_id = ?
          AND consumed_at >= datetime('now', '-30 days')
      `).get(product.id) as { total_consumed: number };

      const turnover_rate = consumption.total_consumed > 0 
        ? product.stock_quantity / consumption.total_consumed
        : null;

      const avg_daily_consumption = consumption.total_consumed / 30;
      const coverage_days = avg_daily_consumption > 0
        ? product.stock_quantity / avg_daily_consumption
        : null;

      return {
        ...product,
        turnover_rate,
        coverage_days,
      };
    });
  }

  async getSectorPerformanceIndicators(sectorId: number): Promise<SectorPerformanceIndicators> {
    const sector = await this.getSector(sectorId);
    if (!sector) {
      throw new Error(`Sector with ID ${sectorId} not found`);
    }

    // Get total products count
    // Note: total_inventory_value uses unit_price (acquisition cost) per accounting standards
    const productStats = db.prepare(`
      SELECT 
        COUNT(*) as total_products,
        SUM(stock_quantity * unit_price) as total_inventory_value,
        SUM(CASE WHEN stock_quantity <= COALESCE(low_stock_threshold, 10) AND stock_quantity > 0 THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count
      FROM products
      WHERE sector_id = ?
    `).get(sectorId) as {
      total_products: number;
      total_inventory_value: number;
      low_stock_count: number;
      out_of_stock_count: number;
    };

    // Calculate stock turnover (last 30 days)
    const consumptionStats = db.prepare(`
      SELECT COALESCE(SUM(c.qty), 0) as total_consumed
      FROM consumptions c
      INNER JOIN products p ON c.product_id = p.id
      WHERE p.sector_id = ?
        AND c.consumed_at >= datetime('now', '-30 days')
    `).get(sectorId) as { total_consumed: number };

    const stock_turnover = productStats.total_inventory_value > 0
      ? consumptionStats.total_consumed / productStats.total_inventory_value
      : null;

    // Calculate average daily consumption
    const avg_daily_consumption = consumptionStats.total_consumed / 30;
    const coverage_days = avg_daily_consumption > 0 && productStats.total_inventory_value > 0
      ? productStats.total_inventory_value / avg_daily_consumption
      : null;

    // Calculate stockout frequency (products that ran out in last 30 days)
    const stockoutStats = db.prepare(`
      SELECT COUNT(DISTINCT product_id) as stockout_count
      FROM stock_transactions st
      INNER JOIN products p ON st.product_id = p.id
      WHERE p.sector_id = ?
        AND st.created_at >= datetime('now', '-30 days')
        AND (
          SELECT stock_quantity 
          FROM products 
          WHERE id = st.product_id
        ) = 0
    `).get(sectorId) as { stockout_count: number };

    return {
      sector_id: sectorId,
      sector_name: sector.name,
      total_products: productStats.total_products || 0,
      total_inventory_value: productStats.total_inventory_value || 0,
      low_stock_count: productStats.low_stock_count || 0,
      out_of_stock_count: productStats.out_of_stock_count || 0,
      stock_turnover,
      coverage_days,
      stockout_frequency: stockoutStats.stockout_count || 0,
      immobilized_value: productStats.total_inventory_value || 0,
    };
  }

  async getStockTransactionsBySector(sectorId: number): Promise<StockTransactionWithProduct[]> {
    return db.prepare(`
      SELECT st.*, p.name as product_name, p.photo_path, u.full_name as user_name
      FROM stock_transactions st
      INNER JOIN products p ON st.product_id = p.id
      LEFT JOIN users u ON st.user_id = u.id
      WHERE p.sector_id = ?
      ORDER BY st.created_at DESC
    `).all(sectorId) as StockTransactionWithProduct[];
  }

  // Stock Transactions
  async getStockTransaction(id: number): Promise<StockTransaction | undefined> {
    return db.prepare('SELECT * FROM stock_transactions WHERE id = ?').get(id) as StockTransaction | undefined;
  }

  async getAllStockTransactions(): Promise<StockTransactionWithProduct[]> {
    return db.prepare(`
      SELECT st.*, p.name as product_name, p.photo_path
      FROM stock_transactions st
      LEFT JOIN products p ON st.product_id = p.id
      ORDER BY st.created_at DESC
    `).all() as StockTransactionWithProduct[];
  }

  async createStockTransaction(insertTransaction: Omit<StockTransaction, 'id' | 'created_at'>): Promise<StockTransaction> {
    // Start transaction
    const createTx = db.transaction(() => {
      // Insert stock transaction
      const result = db.prepare(`
        INSERT INTO stock_transactions (product_id, change, reason)
        VALUES (?, ?, ?)
      `).run(insertTransaction.product_id, insertTransaction.change, insertTransaction.reason);

      // Update product stock
      db.prepare(`
        UPDATE products 
        SET 
          stock_quantity = stock_quantity + ?,
          total_in = total_in + CASE WHEN ? > 0 THEN ? ELSE 0 END,
          total_out = total_out + CASE WHEN ? < 0 THEN ABS(?) ELSE 0 END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        insertTransaction.change,
        insertTransaction.change,
        insertTransaction.change,
        insertTransaction.change,
        insertTransaction.change,
        insertTransaction.product_id
      );

      return result.lastInsertRowid as number;
    });

    const txId = createTx();
    return this.getStockTransaction(txId) as Promise<StockTransaction>;
  }

  // Consumptions
  async getConsumption(id: number): Promise<Consumption | undefined> {
    return db.prepare('SELECT * FROM consumptions WHERE id = ?').get(id) as Consumption | undefined;
  }

  async getAllConsumptions(): Promise<ConsumptionWithDetails[]> {
    return db.prepare(`
      SELECT 
        c.*,
        u.full_name as user_name,
        p.name as product_name,
        p.photo_path
      FROM consumptions c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN products p ON c.product_id = p.id
      ORDER BY c.consumed_at DESC
    `).all() as ConsumptionWithDetails[];
  }

  async getRecentConsumptions(limit: number): Promise<ConsumptionWithDetails[]> {
    return db.prepare(`
      SELECT 
        c.*,
        u.full_name as user_name,
        p.name as product_name,
        p.photo_path
      FROM consumptions c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN products p ON c.product_id = p.id
      ORDER BY c.consumed_at DESC
      LIMIT ?
    `).all(limit) as ConsumptionWithDetails[];
  }

  async getUserConsumptions(userId: number, startDate?: string, endDate?: string): Promise<ConsumptionWithDetails[]> {
    let query = `
      SELECT 
        c.*,
        u.full_name as user_name,
        p.name as product_name,
        p.photo_path
      FROM consumptions c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN products p ON c.product_id = p.id
      WHERE c.user_id = ?
    `;
    const params: any[] = [userId];

    if (startDate) {
      query += ` AND date(c.consumed_at) >= date(?)`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND date(c.consumed_at) <= date(?)`;
      params.push(endDate);
    }

    query += ` ORDER BY c.consumed_at DESC`;

    return db.prepare(query).all(...params) as ConsumptionWithDetails[];
  }

  async getUserMonthlyTotal(userId: number, year: number, month: number): Promise<number> {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const result = db.prepare(`
      SELECT COALESCE(SUM(total_price), 0) as total
      FROM consumptions
      WHERE user_id = ?
        AND date(consumed_at) >= date(?)
        AND date(consumed_at) <= date(?)
    `).get(userId, startDate, endDate) as { total: number };

    return result.total;
  }

  async getTopConsumedItems(limit: number): Promise<TopConsumedItem[]> {
    return db.prepare(`
      SELECT 
        c.product_id,
        p.name as product_name,
        p.photo_path,
        s.name as sector_name,
        SUM(c.qty) as total_qty,
        SUM(c.total_price) as total_value,
        COUNT(*) as consumption_count
      FROM consumptions c
      LEFT JOIN products p ON c.product_id = p.id
      LEFT JOIN sectors s ON p.sector_id = s.id
      GROUP BY c.product_id, p.name, p.photo_path, s.name
      ORDER BY total_qty DESC
      LIMIT ?
    `).all(limit) as TopConsumedItem[];
  }

  async createConsumption(insertConsumption: Omit<Consumption, 'id' | 'consumed_at'>): Promise<Consumption> {
    // Start transaction
    const createCons = db.transaction(() => {
      // Generate timestamp in Brasília timezone (America/Sao_Paulo)
      // Get the components in Brasília timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      const parts = formatter.formatToParts(new Date());
      const partsMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
      
      // Construct ISO 8601 timestamp (Brasília doesn't observe DST, UTC-3 year-round)
      const consumedAt = `${partsMap.year}-${partsMap.month}-${partsMap.day}T${partsMap.hour}:${partsMap.minute}:${partsMap.second}-03:00`;
      
      // Insert consumption with explicit timestamp
      const result = db.prepare(`
        INSERT INTO consumptions (user_id, product_id, qty, unit_price, total_price, consumed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        insertConsumption.user_id,
        insertConsumption.product_id,
        insertConsumption.qty,
        insertConsumption.unit_price,
        insertConsumption.total_price,
        consumedAt
      );

      // Update product stock (decrease)
      db.prepare(`
        UPDATE products 
        SET 
          stock_quantity = stock_quantity - ?,
          total_out = total_out + ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(insertConsumption.qty, insertConsumption.qty, insertConsumption.product_id);

      return result.lastInsertRowid as number;
    });

    const consId = createCons();
    return this.getConsumption(consId) as Promise<Consumption>;
  }

  // Inventory KPIs
  // Note: Inventory valuation uses unit_price (acquisition cost) per GAAP/IFRS accounting standards
  async getInventoryKPIsBySector(): Promise<any[]> {
    return db.prepare(`
      SELECT 
        s.id as sector_id,
        s.name as sector_name,
        COUNT(p.id) as total_products,
        SUM(p.stock_quantity * p.unit_price) as total_value,
        SUM(CASE WHEN p.stock_quantity <= COALESCE(p.low_stock_threshold, 10) AND p.stock_quantity > 0 THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN p.stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count
      FROM sectors s
      LEFT JOIN products p ON s.id = p.sector_id
      GROUP BY s.id, s.name
      ORDER BY s.name
    `).all();
  }

  // Note: Uses unit_price (acquisition cost) for proper inventory valuation per accounting standards
  async getTotalInventoryValue(): Promise<number> {
    const result = db.prepare(`
      SELECT SUM(stock_quantity * unit_price) as total_value
      FROM products
    `).get() as { total_value: number | null };
    return result.total_value || 0;
  }

  // Note: Uses unit_price (acquisition cost) for proper inventory valuation per accounting standards
  async getTotalInventoryValueBySector(sectorId?: number): Promise<number> {
    if (sectorId !== undefined) {
      const result = db.prepare(`
        SELECT SUM(stock_quantity * unit_price) as total_value
        FROM products
        WHERE sector_id = ?
      `).get(sectorId) as { total_value: number | null };
      return result.total_value || 0;
    } else {
      return this.getTotalInventoryValue();
    }
  }

  async getSectorReport(sectorId: number) {
    // Get sector info
    const sector = await this.getSector(sectorId);
    if (!sector) {
      throw new Error('Sector not found');
    }

    // Get all products in this sector
    const products = db.prepare(`
      SELECT 
        p.*,
        s.name as sector_name
      FROM products p
      LEFT JOIN sectors s ON p.sector_id = s.id
      WHERE p.sector_id = ?
      ORDER BY p.name
    `).all(sectorId) as ProductWithSector[];

    const productIds = products.map(p => p.id);

    // Get stock transactions for products in this sector
    let stockTransactions: StockTransactionWithProduct[] = [];
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      stockTransactions = db.prepare(`
        SELECT 
          st.*,
          p.name as product_name,
          u.full_name as user_name
        FROM stock_transactions st
        LEFT JOIN products p ON st.product_id = p.id
        LEFT JOIN users u ON st.user_id = u.id
        WHERE st.product_id IN (${placeholders})
        ORDER BY st.created_at DESC
      `).all(...productIds) as StockTransactionWithProduct[];
    }

    // Get consumptions for products in this sector
    let consumptions: ConsumptionWithDetails[] = [];
    if (productIds.length > 0) {
      const placeholders = productIds.map(() => '?').join(',');
      consumptions = db.prepare(`
        SELECT 
          c.*,
          u.full_name as user_name,
          p.name as product_name
        FROM consumptions c
        LEFT JOIN users u ON c.user_id = u.id
        LEFT JOIN products p ON c.product_id = p.id
        WHERE c.product_id IN (${placeholders})
        ORDER BY c.consumed_at DESC
      `).all(...productIds) as ConsumptionWithDetails[];
    }

    // Calculate summary
    // Note: totalValue uses unit_price (acquisition cost) per accounting standards
    const summary = {
      totalProducts: products.length,
      totalValue: products.reduce((sum, p) => sum + (p.stock_quantity * p.unit_price), 0),
      totalIn: products.reduce((sum, p) => sum + (p.total_in || 0), 0),
      totalOut: products.reduce((sum, p) => sum + (p.total_out || 0), 0),
      lowStockCount: products.filter(p => 
        p.stock_quantity <= (p.low_stock_threshold || 10) && p.stock_quantity > 0
      ).length,
      outOfStockCount: products.filter(p => p.stock_quantity === 0).length,
    };

    return {
      sector,
      products,
      stockTransactions,
      consumptions,
      summary,
    };
  }

  // ============================================
  // REPORTING MODULE METHODS
  // ============================================

  async getConsumptionsBySectorAndDateRange(
    sectorId: number,
    startDate: string,
    endDate: string
  ): Promise<ConsumptionWithDetails[]> {
    const consumptions = db.prepare(`
      SELECT 
        c.*,
        u.full_name as user_name,
        p.name as product_name,
        p.photo_path
      FROM consumptions c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN products p ON c.product_id = p.id
      WHERE p.sector_id = ?
        AND c.consumed_at >= ?
        AND c.consumed_at <= ?
      ORDER BY c.consumed_at DESC
    `).all(sectorId, startDate, endDate) as ConsumptionWithDetails[];
    
    return consumptions;
  }

  async getDailyConsumptionTotals(
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<DailyConsumptionTotal[]> {
    const totals = db.prepare(`
      SELECT 
        DATE(consumed_at) as date,
        SUM(total_price) as totalValue,
        COUNT(*) as itemCount
      FROM consumptions
      WHERE user_id = ?
        AND consumed_at >= ?
        AND consumed_at <= ?
      GROUP BY DATE(consumed_at)
      ORDER BY date
    `).all(userId, startDate, endDate) as DailyConsumptionTotal[];
    
    return totals;
  }

  async getProductConsumptionHistory(
    productId: number,
    days: number
  ): Promise<{date: string; qty: number}[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startDateStr = startDate.toISOString();
    
    const history = db.prepare(`
      SELECT 
        DATE(consumed_at) as date,
        SUM(qty) as qty
      FROM consumptions
      WHERE product_id = ?
        AND consumed_at >= ?
      GROUP BY DATE(consumed_at)
      ORDER BY date
    `).all(productId, startDateStr) as {date: string; qty: number}[];
    
    return history;
  }

  async getGeneralInventoryStats(): Promise<any> {
    // Get all sectors with their stats
    const sectorStats = db.prepare(`
      SELECT 
        s.id as sector_id,
        s.name as sector_name,
        COUNT(DISTINCT p.id) as total_products,
        SUM(p.stock_quantity * p.unit_price) as total_value,
        SUM(CASE WHEN p.stock_quantity <= COALESCE(p.low_stock_threshold, 10) 
                 AND p.stock_quantity > 0 THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN p.stock_quantity = 0 THEN 1 ELSE 0 END) as out_of_stock_count
      FROM sectors s
      LEFT JOIN products p ON s.id = p.sector_id
      GROUP BY s.id, s.name
      ORDER BY s.name
    `).all();
    
    // Get overall totals
    const overallStats = db.prepare(`
      SELECT 
        COUNT(*) as total_products,
        SUM(stock_quantity * unit_price) as total_value,
        SUM(CASE WHEN stock_quantity <= COALESCE(low_stock_threshold, 10) 
                 AND stock_quantity > 0 THEN 1 ELSE 0 END) as total_low_stock,
        SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) as total_out_of_stock
      FROM products
    `).get();
    
    return {
      sectorStats,
      overallStats,
    };
  }
}

export const storage = new SqliteStorage();
