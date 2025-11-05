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
  createProduct(product: Omit<Product, 'id' | 'created_at' | 'updated_at'>): Promise<Product>;
  bulkCreateProducts(products: Omit<Product, 'id' | 'created_at' | 'updated_at'>[]): Promise<number>;
  getLowStockProducts(): Promise<ProductWithSector[]>;
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
  createConsumption(consumption: Omit<Consumption, 'id' | 'consumed_at'>): Promise<Consumption>;

  // Inventory KPIs
  getInventoryKPIsBySector(): Promise<any[]>;
  getTotalInventoryValue(): Promise<number>;
}

class SqliteStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  }

  async getUserByMatricula(matricula: string): Promise<User | undefined> {
    // Case-insensitive matricula lookup
    return db.prepare('SELECT * FROM users WHERE LOWER(matricula) = LOWER(?)').get(matricula) as User | undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
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
    return db.prepare('SELECT * FROM products WHERE id = ?').get(id) as Product | undefined;
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
      INSERT INTO products (name, sector_id, sku, unit_price, stock_quantity, total_in, total_out, photo_path, low_stock_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      insertProduct.name,
      insertProduct.sector_id,
      insertProduct.sku,
      insertProduct.unit_price,
      insertProduct.stock_quantity,
      insertProduct.total_in,
      insertProduct.total_out,
      insertProduct.photo_path,
      insertProduct.low_stock_threshold || 10
    );
    
    return this.getProduct(result.lastInsertRowid as number) as Promise<Product>;
  }

  async bulkCreateProducts(products: Omit<Product, 'id' | 'created_at' | 'updated_at'>[]): Promise<number> {
    const insertStmt = db.prepare(`
      INSERT INTO products (name, sector_id, sku, unit_price, stock_quantity, total_in, total_out, photo_path, low_stock_threshold)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((productList: Omit<Product, 'id' | 'created_at' | 'updated_at'>[]) => {
      for (const product of productList) {
        insertStmt.run(
          product.name,
          product.sector_id,
          product.sku,
          product.unit_price,
          product.stock_quantity,
          product.total_in || 0,
          product.total_out || 0,
          product.photo_path || null,
          product.low_stock_threshold || 10
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
    if (updateData.unit_price !== undefined) {
      fields.push('unit_price = ?');
      values.push(updateData.unit_price);
    }
    if (updateData.stock_quantity !== undefined) {
      fields.push('stock_quantity = ?');
      values.push(updateData.stock_quantity);
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

  // Stock Transactions
  async getStockTransaction(id: number): Promise<StockTransaction | undefined> {
    return db.prepare('SELECT * FROM stock_transactions WHERE id = ?').get(id) as StockTransaction | undefined;
  }

  async getAllStockTransactions(): Promise<StockTransactionWithProduct[]> {
    return db.prepare(`
      SELECT st.*, p.name as product_name
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
        p.name as product_name
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
        p.name as product_name
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
        p.name as product_name
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

  async getTotalInventoryValue(): Promise<number> {
    const result = db.prepare(`
      SELECT SUM(stock_quantity * unit_price) as total_value
      FROM products
    `).get() as { total_value: number | null };
    return result.total_value || 0;
  }
}

export const storage = new SqliteStorage();
