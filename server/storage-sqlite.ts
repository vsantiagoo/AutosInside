import db from './db';
import type {
  User,
  InsertUser,
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
  createUser(user: InsertUser & { password_hash: string }): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser> & { password_hash?: string }): Promise<User | undefined>;
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
  createConsumption(consumption: Omit<Consumption, 'id' | 'consumed_at'>): Promise<Consumption>;
}

class SqliteStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  }

  async getUserByMatricula(matricula: string): Promise<User | undefined> {
    return db.prepare('SELECT * FROM users WHERE matricula = ?').get(matricula) as User | undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as User[];
  }

  async createUser(insertUser: InsertUser & { password_hash: string }): Promise<User> {
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
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
    return result.changes > 0;
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

  async createConsumption(insertConsumption: Omit<Consumption, 'id' | 'consumed_at'>): Promise<Consumption> {
    // Start transaction
    const createCons = db.transaction(() => {
      // Insert consumption
      const result = db.prepare(`
        INSERT INTO consumptions (user_id, product_id, qty, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        insertConsumption.user_id,
        insertConsumption.product_id,
        insertConsumption.qty,
        insertConsumption.unit_price,
        insertConsumption.total_price
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
}

export const storage = new SqliteStorage();
