import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage-sqlite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { promises as fs } from "fs";
import path from "path";
import ExcelJS from "exceljs";
import { z } from "zod";
import {
  loginSchema,
  insertUserSchema,
  updateUserLimitSchema,
  insertSectorSchema,
  insertProductSchema,
  insertStockTransactionSchema,
  insertConsumptionSchema,
  foodStationConsumptionExportSchema,
  type User,
  type Product,
} from "@shared/schema";

// Validate JWT secret is configured
if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET environment variable must be set for JWT authentication');
}
const JWT_SECRET = process.env.SESSION_SECRET;
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
fs.mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error);

// Configure multer for file uploads
const multerStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      cb(null, UPLOAD_DIR);
    } catch (error: any) {
      cb(error, UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: multerStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Separate multer config for bulk imports (Excel/CSV)
const bulkImportUpload = multer({
  storage: multerStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit for Excel/CSV
  fileFilter: (req, file, cb) => {
    const allowedTypes = /csv|xlsx|xls/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const allowedMimes = [
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ];
    const mimetype = allowedMimes.includes(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only CSV and Excel files are allowed'));
  }
});

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// Authentication middleware
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;

  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    storage.getUser(decoded.userId).then(user => {
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }
      req.user = user;
      next();
    }).catch(() => {
      return res.status(401).json({ message: 'Invalid token' });
    });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Admin middleware
function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    const filePath = path.join(UPLOAD_DIR, path.basename(req.path));
    res.sendFile(filePath, (err) => {
      if (err) {
        res.status(404).json({ message: 'File not found' });
      }
    });
  });

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { matricula, password } = req.body;
      
      if (!matricula) {
        return res.status(400).json({ message: 'Matricula is required' });
      }

      const user = await storage.getUserByMatricula(matricula);

      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      // For admins, password is required and must be validated
      if (user.role === 'admin') {
        if (!password) {
          return res.status(401).json({ message: 'Password required for admin users' });
        }
        
        if (!user.password_hash) {
          return res.status(401).json({ message: 'Admin account not properly configured' });
        }

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) {
          return res.status(401).json({ message: 'Invalid password' });
        }
      }
      // For regular users, no password required - matricula is sufficient

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== 'development',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        sameSite: 'lax',
      });

      const { password_hash, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Login failed' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
    });
    res.json({ message: 'Logged out successfully' });
  });

  app.get('/api/auth/me', authMiddleware, (req, res) => {
    const { password_hash, ...userWithoutPassword } = req.user!;
    res.json(userWithoutPassword);
  });

  // Users routes
  app.get('/api/users', authMiddleware, async (req, res) => {
    const users = await storage.getAllUsers();
    const usersWithoutPasswords = users.map(({ password_hash, ...user }) => user);
    res.json(usersWithoutPasswords);
  });

  app.post('/api/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      const existing = await storage.getUserByMatricula(userData.matricula);
      if (existing) {
        return res.status(400).json({ message: 'Matricula already exists' });
      }

      // For admin users, password is required
      if (userData.role === 'admin' && !userData.password) {
        return res.status(400).json({ message: 'Password is required for admin users' });
      }

      // Hash password if provided
      const password_hash = userData.password ? await bcrypt.hash(userData.password, 10) : null;
      
      const user = await storage.createUser({
        ...userData,
        password_hash,
      });

      const { password_hash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to create user' });
    }
  });

  app.put('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userData = req.body;

      // Get existing user to check current password status
      const existingUser = await storage.getUser(id);
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      const updateData: any = {
        full_name: userData.full_name,
        role: userData.role,
      };

      // If promoting to admin, ensure password exists or is being set
      if (userData.role === 'admin') {
        const hasExistingPassword = !!existingUser.password_hash;
        const isSettingNewPassword = userData.password && userData.password.trim() !== '';
        
        if (!hasExistingPassword && !isSettingNewPassword) {
          return res.status(400).json({ 
            message: 'Password is required when promoting user to admin role' 
          });
        }
      }

      if (userData.password && userData.password.trim() !== '') {
        updateData.password_hash = await bcrypt.hash(userData.password, 10);
      }

      const user = await storage.updateUser(id, updateData);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const { password_hash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (req.user!.id === id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      const deleted = await storage.deleteUser(id);
      if (!deleted) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to delete user' });
    }
  });

  // Sectors routes
  app.get('/api/sectors', authMiddleware, async (req, res) => {
    const sectors = await storage.getAllSectors();
    res.json(sectors);
  });

  app.post('/api/sectors', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const sectorData = insertSectorSchema.parse(req.body);
      const sector = await storage.createSector(sectorData);
      res.json(sector);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to create sector' });
    }
  });

  app.put('/api/sectors/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const sectorData = insertSectorSchema.parse(req.body);
      const sector = await storage.updateSector(id, sectorData);
      
      if (!sector) {
        return res.status(404).json({ message: 'Sector not found' });
      }

      res.json(sector);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to update sector' });
    }
  });

  app.delete('/api/sectors/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const deleted = await storage.deleteSector(id);
      
      if (!deleted) {
        return res.status(404).json({ message: 'Sector not found' });
      }

      res.json({ message: 'Sector deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to delete sector' });
    }
  });

  // Sector details and products
  app.get('/api/sectors/:id', authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const sector = await storage.getSector(id);
      
      if (!sector) {
        return res.status(404).json({ message: 'Setor não encontrado' });
      }

      res.json(sector);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Falha ao buscar setor' });
    }
  });

  app.get('/api/sectors/:id/products', authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const products = await storage.getProductsBySector(id);
      res.json(products);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Falha ao buscar produtos do setor' });
    }
  });

  app.get('/api/sectors/:id/performance', authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const performance = await storage.getSectorPerformanceIndicators(id);
      res.json(performance);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Falha ao buscar indicadores de desempenho' });
    }
  });

  app.get('/api/sectors/:id/transactions', authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transactions = await storage.getStockTransactionsBySector(id);
      res.json(transactions);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Falha ao buscar movimentações' });
    }
  });

  // Products routes
  app.get('/api/products', authMiddleware, async (req, res) => {
    const allProducts = await storage.getAllProducts();
    
    // Filter products based on user role
    // Admin users see all products
    // Regular users only see products marked as visible_to_users
    const products = req.user?.role === 'admin' 
      ? allProducts 
      : allProducts.filter((p: any) => p.visible_to_users);
    
    res.json(products);
  });

  app.post('/api/products', authMiddleware, upload.single('photo'), async (req, res) => {
    try {
      // Parse all fields from insertProductSchema
      const productData = {
        name: req.body.name,
        sector_id: req.body.sector_id ? parseInt(req.body.sector_id) : null,
        sku: req.body.sku || null,
        category: req.body.category || null,
        unit_measure: req.body.unit_measure || null,
        unit_price: parseFloat(req.body.unit_price) || 0,
        sale_price: req.body.sale_price ? parseFloat(req.body.sale_price) : null,
        stock_quantity: parseInt(req.body.stock_quantity) || 0,
        min_quantity: req.body.min_quantity ? parseInt(req.body.min_quantity) : null,
        max_quantity: req.body.max_quantity ? parseInt(req.body.max_quantity) : null,
        low_stock_threshold: req.body.low_stock_threshold ? parseInt(req.body.low_stock_threshold) : 10,
        supplier: req.body.supplier || null,
        asset_number: req.body.asset_number || null,
        status: req.body.status || 'Ativo',
        visible_to_users: req.body.visible_to_users !== undefined ? req.body.visible_to_users === 'true' || req.body.visible_to_users === true : true,
        last_purchase_date: req.body.last_purchase_date || null,
        expiry_date: req.body.expiry_date || null,
        warranty_date: req.body.warranty_date || null,
      };

      insertProductSchema.parse(productData);

      const photo_path = req.file ? `/uploads/${req.file.filename}` : null;

      const product = await storage.createProduct({
        ...productData,
        photo_path,
        total_in: productData.stock_quantity,
        total_out: 0,
        last_count_date: null,
      });

      res.json(product);
    } catch (error: any) {
      if (req.file) {
        fs.unlink(path.join(UPLOAD_DIR, req.file.filename)).catch(console.error);
      }
      res.status(400).json({ message: error.message || 'Failed to create product' });
    }
  });

  app.put('/api/products/:id', authMiddleware, upload.single('photo'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const existing = await storage.getProduct(id);
      
      if (!existing) {
        if (req.file) {
          fs.unlink(path.join(UPLOAD_DIR, req.file.filename)).catch(console.error);
        }
        return res.status(404).json({ message: 'Product not found' });
      }

      // Parse updatable fields - only include fields present in request to preserve existing values
      const updateData: any = {};
      
      if (req.body.name !== undefined) updateData.name = req.body.name;
      if (req.body.sector_id !== undefined) {
        updateData.sector_id = req.body.sector_id ? parseInt(req.body.sector_id) : null;
      }
      if (req.body.sku !== undefined) updateData.sku = req.body.sku || null;
      if (req.body.category !== undefined) updateData.category = req.body.category || null;
      if (req.body.unit_measure !== undefined) updateData.unit_measure = req.body.unit_measure || null;
      if (req.body.unit_price !== undefined) updateData.unit_price = parseFloat(req.body.unit_price);
      if (req.body.sale_price !== undefined) {
        updateData.sale_price = req.body.sale_price ? parseFloat(req.body.sale_price) : null;
      }
      if (req.body.stock_quantity !== undefined) updateData.stock_quantity = parseInt(req.body.stock_quantity);
      if (req.body.min_quantity !== undefined) {
        updateData.min_quantity = req.body.min_quantity ? parseInt(req.body.min_quantity) : null;
      }
      if (req.body.max_quantity !== undefined) {
        updateData.max_quantity = req.body.max_quantity ? parseInt(req.body.max_quantity) : null;
      }
      if (req.body.low_stock_threshold !== undefined) {
        updateData.low_stock_threshold = req.body.low_stock_threshold ? parseInt(req.body.low_stock_threshold) : null;
      }
      if (req.body.supplier !== undefined) updateData.supplier = req.body.supplier || null;
      if (req.body.asset_number !== undefined) updateData.asset_number = req.body.asset_number || null;
      if (req.body.status !== undefined) updateData.status = req.body.status || 'Ativo';
      if (req.body.visible_to_users !== undefined) {
        updateData.visible_to_users = req.body.visible_to_users === 'true' || req.body.visible_to_users === true;
      }
      if (req.body.last_purchase_date !== undefined) updateData.last_purchase_date = req.body.last_purchase_date || null;
      if (req.body.expiry_date !== undefined) updateData.expiry_date = req.body.expiry_date || null;
      if (req.body.warranty_date !== undefined) updateData.warranty_date = req.body.warranty_date || null;

      if (req.file) {
        updateData.photo_path = `/uploads/${req.file.filename}`;
        
        if (existing.photo_path) {
          const oldFilename = path.basename(existing.photo_path);
          fs.unlink(path.join(UPLOAD_DIR, oldFilename)).catch(console.error);
        }
      }

      const product = await storage.updateProduct(id, updateData);
      res.json(product);
    } catch (error: any) {
      if (req.file) {
        fs.unlink(path.join(UPLOAD_DIR, req.file.filename)).catch(console.error);
      }
      res.status(400).json({ message: error.message || 'Failed to update product' });
    }
  });

  // Bulk import products
  app.post('/api/products/bulk-import', authMiddleware, bulkImportUpload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const ExcelJS = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(req.file.path);
      
      const worksheet = workbook.getWorksheet(1);
      if (!worksheet) {
        return res.status(400).json({ message: 'Invalid Excel file: no worksheet found' });
      }

      const products: Omit<Product, 'id' | 'created_at' | 'updated_at'>[] = [];
      const errors: string[] = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header row
        
        try {
          const name = row.getCell(1).value?.toString() || '';
          const sku = row.getCell(2).value?.toString() || '';
          const unit_price = parseFloat(row.getCell(3).value?.toString() || '0');
          const stock_quantity = parseInt(row.getCell(4).value?.toString() || '0');
          const sector_name = row.getCell(5).value?.toString() || '';
          const low_stock_threshold = parseInt(row.getCell(6).value?.toString() || '10');

          if (!name) {
            errors.push(`Row ${rowNumber}: Product name is required`);
            return;
          }

          let sector_id: number | null = null;
          if (sector_name) {
            const sector = storage.getAllSectors().then(sectors => 
              sectors.find(s => s.name.toLowerCase() === sector_name.toLowerCase())
            );
          }

          products.push({
            name,
            sku: sku || null,
            unit_price,
            stock_quantity,
            sector_id,
            total_in: stock_quantity,
            total_out: 0,
            photo_path: null,
            low_stock_threshold,
            category: null,
            unit_measure: null,
            sale_price: null,
            min_quantity: null,
            max_quantity: null,
            supplier: null,
            last_purchase_date: null,
            last_count_date: null,
            asset_number: null,
            status: 'Ativo',
            expiry_date: null,
            warranty_date: null,
            visible_to_users: true,
          });
        } catch (error: any) {
          errors.push(`Row ${rowNumber}: ${error.message}`);
        }
      });

      // Clean up uploaded file
      await fs.unlink(req.file.path);

      if (products.length === 0) {
        return res.status(400).json({ 
          message: 'No valid products found in file',
          errors 
        });
      }

      const imported = await storage.bulkCreateProducts(products);

      res.json({ 
        message: `Successfully imported ${imported} products`,
        imported,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error: any) {
      if (req.file) {
        await fs.unlink(req.file.path).catch(console.error);
      }
      res.status(400).json({ message: error.message || 'Failed to import products' });
    }
  });

  // Get low stock products
  app.get('/api/products/low-stock', authMiddleware, async (req, res) => {
    const sectorIdParam = req.query.sector_id as string | undefined;
    const sectorId = sectorIdParam && sectorIdParam !== '' && !isNaN(parseInt(sectorIdParam))
      ? parseInt(sectorIdParam) 
      : undefined;
    const products = await storage.getLowStockProductsBySector(sectorId);
    res.json(products);
  });

  app.delete('/api/products/:id', authMiddleware, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ message: 'Produto não encontrado' });
      }

      if (product.photo_path) {
        const filename = path.basename(product.photo_path);
        fs.unlink(path.join(UPLOAD_DIR, filename)).catch(console.error);
      }

      const deleted = await storage.deleteProduct(id);
      res.json({ message: 'Produto excluído com sucesso' });
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Falha ao excluir produto' });
    }
  });

  // Stock transactions routes
  app.get('/api/stock-transactions', authMiddleware, async (req, res) => {
    const transactions = await storage.getAllStockTransactions();
    res.json(transactions);
  });

  app.post('/api/stock-transactions', authMiddleware, async (req, res) => {
    try {
      const transactionData = insertStockTransactionSchema.parse(req.body);
      
      const product = await storage.getProduct(transactionData.product_id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      if (transactionData.change < 0 && product.stock_quantity < Math.abs(transactionData.change)) {
        return res.status(400).json({ message: 'Insufficient stock for this transaction' });
      }

      const transaction = await storage.createStockTransaction({
        product_id: transactionData.product_id,
        change: transactionData.change,
        user_id: transactionData.user_id ?? null,
        transaction_type: transactionData.transaction_type ?? null,
        reason: transactionData.reason || null,
        document_origin: null,
        notes: null,
      });

      res.json(transaction);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to create transaction' });
    }
  });

  // Consumptions routes
  app.get('/api/consumptions', authMiddleware, async (req, res) => {
    const consumptions = await storage.getAllConsumptions();
    res.json(consumptions);
  });

  app.get('/api/consumptions/recent', authMiddleware, async (req, res) => {
    const consumptions = await storage.getRecentConsumptions(10);
    res.json(consumptions);
  });

  app.post('/api/consumptions', authMiddleware, async (req, res) => {
    try {
      // Parse only product_id and qty from request, use authenticated user's ID
      const { product_id, qty } = insertConsumptionSchema
        .pick({ product_id: true, qty: true })
        .parse(req.body);
      
      const product = await storage.getProduct(product_id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      if (product.stock_quantity < qty) {
        return res.status(400).json({ message: 'Insufficient stock for this consumption' });
      }

      // Use sale_price (customer-facing price) with fallback to unit_price
      const price = product.sale_price ?? product.unit_price;
      
      const consumption = await storage.createConsumption({
        user_id: req.user!.id, // Use authenticated user's ID
        product_id,
        qty,
        unit_price: price,
        total_price: price * qty,
      });

      res.json(consumption);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to create consumption' });
    }
  });

  app.get('/api/consumptions/export', authMiddleware, async (req, res) => {
    try {
      const consumptions = await storage.getAllConsumptions();

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Consumptions');

      worksheet.columns = [
        { header: 'ID', key: 'id', width: 10 },
        { header: 'Product', key: 'product_name', width: 30 },
        { header: 'User', key: 'user_name', width: 25 },
        { header: 'Quantity', key: 'qty', width: 12 },
        { header: 'Unit Price', key: 'unit_price', width: 15 },
        { header: 'Total Price', key: 'total_price', width: 15 },
        { header: 'Date', key: 'consumed_at', width: 20 },
      ];

      consumptions.forEach(consumption => {
        worksheet.addRow({
          id: consumption.id,
          product_name: consumption.product_name || 'Unknown',
          user_name: consumption.user_name || 'Unknown',
          qty: consumption.qty,
          unit_price: consumption.unit_price,
          total_price: consumption.total_price,
          consumed_at: new Date(consumption.consumed_at).toLocaleString(),
        });
      });

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' },
      };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=consumptions.xlsx');

      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to export consumptions' });
    }
  });

  app.get('/api/consumptions/my', authMiddleware, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      const consumptions = await storage.getUserConsumptions(
        req.user!.id, 
        startDate as string | undefined, 
        endDate as string | undefined
      );
      res.json(consumptions);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch user consumptions' });
    }
  });

  app.get('/api/consumptions/my-monthly-total', authMiddleware, async (req, res) => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const total = await storage.getUserMonthlyTotal(req.user!.id, year, month);
      res.json({ total, year, month });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch monthly total' });
    }
  });

  app.get('/api/consumptions/top-items', authMiddleware, async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const topItems = await storage.getTopConsumedItems(limit);
      res.json(topItems);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch top consumed items' });
    }
  });

  // User limit routes
  app.patch('/api/users/me/limit', authMiddleware, async (req, res) => {
    try {
      const limitData = updateUserLimitSchema.parse(req.body);
      const updatedUser = await storage.updateUserLimit(req.user!.id, limitData);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(updatedUser);
    } catch (error: any) {
      res.status(400).json({ message: error.message || 'Failed to update limit' });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
    const sectorIdParam = req.query.sector_id as string | undefined;
    const sectorId = sectorIdParam && sectorIdParam !== '' && !isNaN(parseInt(sectorIdParam))
      ? parseInt(sectorIdParam) 
      : undefined;
    
    const products = await storage.getAllProducts();
    const consumptions = await storage.getAllConsumptions();
    
    // Filter by sector if specified
    const filteredProducts = sectorId !== undefined 
      ? products.filter(p => p.sector_id === sectorId)
      : products;
    
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyConsumptions = consumptions.filter(
      c => new Date(c.consumed_at) >= thisMonth
    ).length;

    const lowStockCount = filteredProducts.filter(p => p.stock_quantity < 10 && p.stock_quantity > 0).length;
    const totalValue = await storage.getTotalInventoryValueBySector(sectorId);

    res.json({
      totalProducts: filteredProducts.length,
      lowStockCount,
      monthlyConsumptions,
      totalValue,
    });
  });

  // Inventory routes
  app.get('/api/inventory/kpis', authMiddleware, async (req, res) => {
    try {
      const kpis = await storage.getInventoryKPIsBySector();
      const totalValue = await storage.getTotalInventoryValue();
      res.json({ kpis, totalValue });
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to fetch inventory KPIs' });
    }
  });

  // Sector report routes
  app.get('/api/sectors/:id/report', authMiddleware, async (req, res) => {
    try {
      const sectorId = parseInt(req.params.id);
      if (isNaN(sectorId)) {
        return res.status(400).json({ message: 'Invalid sector ID' });
      }
      
      const report = await storage.getSectorReport(sectorId);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate sector report' });
    }
  });

  app.get('/api/sectors/:id/export', authMiddleware, async (req, res) => {
    try {
      const sectorId = parseInt(req.params.id);
      if (isNaN(sectorId)) {
        return res.status(400).json({ message: 'Invalid sector ID' });
      }
      
      const report = await storage.getSectorReport(sectorId);
      
      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      
      // Summary sheet
      const summarySheet = workbook.addWorksheet('Resumo');
      summarySheet.columns = [
        { header: 'Métrica', key: 'metric', width: 30 },
        { header: 'Valor', key: 'value', width: 20 },
      ];
      
      summarySheet.addRows([
        { metric: 'Setor', value: report.sector.name },
        { metric: 'Total de Produtos', value: report.summary.totalProducts },
        { metric: 'Valor Total em Estoque', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(report.summary.totalValue) },
        { metric: 'Total de Entradas', value: report.summary.totalIn },
        { metric: 'Total de Saídas', value: report.summary.totalOut },
        { metric: 'Produtos com Estoque Baixo', value: report.summary.lowStockCount },
        { metric: 'Produtos Sem Estoque', value: report.summary.outOfStockCount },
      ]);
      
      // Products sheet
      const productsSheet = workbook.addWorksheet('Produtos');
      productsSheet.columns = [
        { header: 'Nome', key: 'name', width: 30 },
        { header: 'SKU', key: 'sku', width: 15 },
        { header: 'Categoria', key: 'category', width: 20 },
        { header: 'Unidade', key: 'unit_measure', width: 15 },
        { header: 'Estoque Atual', key: 'stock_quantity', width: 15 },
        { header: 'Preço Unitário', key: 'unit_price', width: 15 },
        { header: 'Valor Total', key: 'total_value', width: 15 },
        { header: 'Estoque Mínimo', key: 'min_quantity', width: 15 },
        { header: 'Estoque Máximo', key: 'max_quantity', width: 15 },
      ];
      
      productsSheet.addRows(report.products.map(p => ({
        name: p.name,
        sku: p.sku || '-',
        category: p.category || '-',
        unit_measure: p.unit_measure || '-',
        stock_quantity: p.stock_quantity,
        unit_price: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.unit_price),
        total_value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.stock_quantity * p.unit_price),
        min_quantity: p.min_quantity || '-',
        max_quantity: p.max_quantity || '-',
      })));
      
      // Stock Transactions sheet
      const transactionsSheet = workbook.addWorksheet('Movimentações de Estoque');
      transactionsSheet.columns = [
        { header: 'Data', key: 'created_at', width: 20 },
        { header: 'Produto', key: 'product_name', width: 30 },
        { header: 'Tipo', key: 'transaction_type', width: 15 },
        { header: 'Quantidade', key: 'change', width: 15 },
        { header: 'Responsável', key: 'user_name', width: 25 },
        { header: 'Motivo', key: 'reason', width: 40 },
      ];
      
      transactionsSheet.addRows(report.stockTransactions.map(t => ({
        created_at: new Date(t.created_at).toLocaleString('pt-BR'),
        product_name: t.product_name,
        transaction_type: t.transaction_type || '-',
        change: t.change,
        user_name: t.user_name || '-',
        reason: t.reason || '-',
      })));
      
      // Consumptions sheet
      const consumptionsSheet = workbook.addWorksheet('Consumos');
      consumptionsSheet.columns = [
        { header: 'Data', key: 'consumed_at', width: 20 },
        { header: 'Produto', key: 'product_name', width: 30 },
        { header: 'Quantidade', key: 'qty', width: 15 },
        { header: 'Preço Unitário', key: 'unit_price', width: 15 },
        { header: 'Preço Total', key: 'total_price', width: 15 },
        { header: 'Usuário', key: 'user_name', width: 25 },
      ];
      
      consumptionsSheet.addRows(report.consumptions.map(c => ({
        consumed_at: new Date(c.consumed_at).toLocaleString('pt-BR'),
        product_name: c.product_name,
        qty: c.qty,
        unit_price: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.unit_price),
        total_price: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.total_price),
        user_name: c.user_name,
      })));
      
      // Set response headers for Excel download
      const fileName = `Relatorio_${report.sector.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      // Write to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to export sector report' });
    }
  });

  // ============================================
  // REPORTING MODULE ROUTES
  // ============================================

  // Import reporting service
  const {
    generateUserConsumptionReport,
    generateRestockPredictionReport,
    generateSectorMonthlyReport,
    generateFoodStationConsumptionsReport,
    generateFoodStationOverviewReport,
    generateCleaningSectorReport,
    generateCoffeeMachineReport,
    generateGeneralInventoryReportNew,
    generateFoodStationConsumptionControlReport,
    generateSectorProductManagementReport,
    generateFoodStationConsumptionWorkbook,
  } = await import('./services/reporting');

  // User Consumption Report (FoodStation)
  app.get('/api/reports/foodstation/consumption', authMiddleware, async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : req.user!.id;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const report = await generateUserConsumptionReport(userId, startDate, endDate);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate user consumption report' });
    }
  });

  // Restock Prediction Report (FoodStation)
  app.get('/api/reports/foodstation/restock', authMiddleware, async (req, res) => {
    try {
      // Find FoodStation sector
      const sectors = await storage.getAllSectors();
      const foodStationSector = sectors.find(s => s.name.toLowerCase().includes('foodstation'));
      
      if (!foodStationSector) {
        return res.status(404).json({ message: 'FoodStation sector not found' });
      }

      const report = await generateRestockPredictionReport(foodStationSector.id);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate restock prediction report' });
    }
  });

  // Sector Monthly/Weekly Report (Cleaning, Coffee, etc.)
  app.get('/api/reports/sector/:id/monthly', authMiddleware, async (req, res) => {
    try {
      const sectorId = parseInt(req.params.id);
      const cadence = (req.query.cadence as 'monthly' | 'biweekly' | 'weekly') || 'monthly';

      if (isNaN(sectorId)) {
        return res.status(400).json({ message: 'Invalid sector ID' });
      }

      const report = await generateSectorMonthlyReport(sectorId, cadence);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate sector monthly report' });
    }
  });

  // General Inventory Report
  app.get('/api/reports/inventory/general', authMiddleware, async (req, res) => {
    try {
      const report = await generateGeneralInventoryReportNew();
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate general inventory report' });
    }
  });

  // ============================================
  // NEW REPORTS - FOODSTATION & CLEANING
  // ============================================

  // FoodStation Consumptions Report (Customizable)
  app.get('/api/reports/foodstation/consumptions', authMiddleware, async (req, res) => {
    try {
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const groupBy = (req.query.groupBy as 'user' | 'product' | 'date' | 'none') || 'none';

      const report = await generateFoodStationConsumptionsReport(startDate, endDate, groupBy);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate FoodStation consumptions report' });
    }
  });

  // FoodStation Overview Report (with Prediction)
  app.get('/api/reports/foodstation/overview', authMiddleware, async (req, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const report = await generateFoodStationOverviewReport(days);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate FoodStation overview report' });
    }
  });

  // Cleaning Sector Report (Bimonthly)
  app.get('/api/reports/sector/cleaning', authMiddleware, async (req, res) => {
    try {
      const month = req.query.month as string; // YYYY-MM
      const cadence = (req.query.cadence as 'first_half' | 'second_half' | 'full_month') || 'full_month';
      const sectorId = req.query.sectorId ? parseInt(req.query.sectorId as string) : undefined;
      const compareWithPrevious = req.query.compareWithPrevious === 'true';

      if (!month) {
        return res.status(400).json({ message: 'Month parameter (YYYY-MM) is required' });
      }

      const report = await generateCleaningSectorReport(month, cadence, sectorId, compareWithPrevious);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate cleaning sector report' });
    }
  });

  // ============================================
  // COFFEE MACHINE & GENERAL INVENTORY REPORTS
  // ============================================

  // Coffee Machine Report (Weekly/Biweekly)
  app.get('/api/reports/sector/coffee', authMiddleware, async (req, res) => {
    try {
      // Validate query parameters
      const querySchema = z.object({
        sectorId: z.coerce.number().positive().optional(),
        cadence: z.enum(['weekly', 'biweekly']).optional().default('weekly'),
        weeks: z.coerce.number().positive().int().min(1).max(52).optional().default(4),
      });

      const validationResult = querySchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid query parameters', 
          errors: validationResult.error.errors 
        });
      }

      const { sectorId, cadence, weeks } = validationResult.data;
      const report = await generateCoffeeMachineReport(sectorId, cadence, weeks);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate coffee machine report' });
    }
  });

  // General Inventory Report (Refactored with Filters)
  app.get('/api/reports/inventory/general-new', authMiddleware, async (req, res) => {
    try {
      // Validate query parameters
      const querySchema = z.object({
        sectorId: z.coerce.number().positive().optional(),
        keyword: z.string().min(1).optional(),
        includeOutOfStock: z.coerce.boolean().optional().default(true),
      });

      const validationResult = querySchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid query parameters', 
          errors: validationResult.error.errors 
        });
      }

      const { sectorId, keyword, includeOutOfStock } = validationResult.data;
      const report = await generateGeneralInventoryReportNew(sectorId, keyword, includeOutOfStock);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate general inventory report' });
    }
  });

  // FoodStation Consumption Control Report
  app.get('/api/reports/foodstation/consumption-control', authMiddleware, async (req, res) => {
    try {
      // Validate query parameters
      const querySchema = z.object({
        userId: z.coerce.number().positive().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      });

      const validationResult = querySchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid query parameters', 
          errors: validationResult.error.errors 
        });
      }

      const { userId, startDate, endDate } = validationResult.data;
      const report = await generateFoodStationConsumptionControlReport(userId, startDate, endDate);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate FoodStation consumption control report' });
    }
  });

  // Export FoodStation Consumption Control Report to Excel
  app.post('/api/reports/foodstation/consumption-control/export', authMiddleware, async (req, res) => {
    try {
      // Validate request body
      const validationResult = foodStationConsumptionExportSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid export options', 
          errors: validationResult.error.errors 
        });
      }

      const exportOptions = validationResult.data;
      
      // Extract filter parameters from body, fallback to authenticated user for userId
      const userId = exportOptions.userId;
      const startDate = exportOptions.startDate;
      const endDate = exportOptions.endDate;

      // Generate the report
      const report = await generateFoodStationConsumptionControlReport(userId, startDate, endDate);

      // Generate Excel workbook
      const workbook = await generateFoodStationConsumptionWorkbook(report, exportOptions);

      // Set response headers for file download
      const startFormatted = report.period.start.split('T')[0];
      const endFormatted = report.period.end.split('T')[0];
      const fileName = `Relatorio_Consumo_FoodStation_${startFormatted}_${endFormatted}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

      // Stream workbook to response
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to export FoodStation consumption report' });
    }
  });

  // Sector Product Management Report
  app.get('/api/reports/sector-management', authMiddleware, async (req, res) => {
    try {
      // Validate query parameters
      const querySchema = z.object({
        sectorId: z.coerce.number().positive(),
        days: z.coerce.number().positive().optional().default(30),
      });

      const validationResult = querySchema.safeParse(req.query);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid query parameters', 
          errors: validationResult.error.errors 
        });
      }

      const { sectorId, days } = validationResult.data;
      const report = await generateSectorProductManagementReport(sectorId, days);
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to generate sector product management report' });
    }
  });

  // Export User Consumption Report to Excel
  app.get('/api/reports/foodstation/consumption/export', authMiddleware, async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : req.user!.id;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;

      const report = await generateUserConsumptionReport(userId, startDate, endDate);

      const workbook = new ExcelJS.Workbook();
      
      // Summary sheet
      const summarySheet = workbook.addWorksheet('Resumo');
      summarySheet.columns = [
        { header: 'Campo', key: 'field', width: 30 },
        { header: 'Valor', key: 'value', width: 30 },
      ];
      
      summarySheet.addRows([
        { field: 'Usuário', value: report.user.full_name },
        { field: 'Matrícula', value: report.user.matricula },
        { field: 'Período', value: `${new Date(report.period.start).toLocaleDateString('pt-BR')} - ${new Date(report.period.end).toLocaleDateString('pt-BR')}` },
        { field: 'Total Consumido', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(report.monthlyTotal) },
        { field: 'Total de Itens', value: report.consumptions.length },
      ]);

      // Consumptions sheet
      const consumptionsSheet = workbook.addWorksheet('Consumos');
      consumptionsSheet.columns = [
        { header: 'Data/Hora', key: 'consumed_at', width: 20 },
        { header: 'Produto', key: 'product_name', width: 30 },
        { header: 'Quantidade', key: 'qty', width: 12 },
        { header: 'Preço Unitário', key: 'unit_price', width: 15 },
        { header: 'Preço Total', key: 'total_price', width: 15 },
      ];
      
      consumptionsSheet.addRows(report.consumptions.map(c => ({
        consumed_at: new Date(c.consumed_at).toLocaleString('pt-BR'),
        product_name: c.product_name,
        qty: c.qty,
        unit_price: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.unit_price),
        total_price: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.total_price),
      })));

      // Daily totals sheet
      const dailySheet = workbook.addWorksheet('Totais Diários');
      dailySheet.columns = [
        { header: 'Data', key: 'date', width: 15 },
        { header: 'Total', key: 'totalValue', width: 15 },
        { header: 'Itens', key: 'itemCount', width: 10 },
      ];
      
      dailySheet.addRows(report.dailyTotals.map(d => ({
        date: new Date(d.date).toLocaleDateString('pt-BR'),
        totalValue: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(d.totalValue),
        itemCount: d.itemCount,
      })));

      const fileName = `Consumo_${report.user.matricula}_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to export consumption report' });
    }
  });

  // Export Restock Prediction Report to Excel
  app.get('/api/reports/foodstation/restock/export', authMiddleware, async (req, res) => {
    try {
      const sectors = await storage.getAllSectors();
      const foodStationSector = sectors.find(s => s.name.toLowerCase().includes('foodstation'));
      
      if (!foodStationSector) {
        return res.status(404).json({ message: 'FoodStation sector not found' });
      }

      const report = await generateRestockPredictionReport(foodStationSector.id);

      const workbook = new ExcelJS.Workbook();
      
      // Summary sheet
      const summarySheet = workbook.addWorksheet('Resumo');
      summarySheet.columns = [
        { header: 'Campo', key: 'field', width: 30 },
        { header: 'Valor', key: 'value', width: 30 },
      ];
      
      summarySheet.addRows([
        { field: 'Setor', value: report.sector.name },
        { field: 'Data de Geração', value: new Date(report.generatedAt).toLocaleString('pt-BR') },
        { field: 'Período Analisado', value: `${new Date(report.periodAnalyzed.start).toLocaleDateString('pt-BR')} - ${new Date(report.periodAnalyzed.end).toLocaleDateString('pt-BR')}` },
        { field: 'Período Projetado', value: `${new Date(report.periodProjected.start).toLocaleDateString('pt-BR')} - ${new Date(report.periodProjected.end).toLocaleDateString('pt-BR')}` },
        { field: 'Itens Recomendados', value: report.totalRecommendedItems },
        { field: 'Itens Alto Risco', value: report.highRiskItems },
      ]);

      // Predictions sheet
      const predictionsSheet = workbook.addWorksheet('Previsões');
      predictionsSheet.columns = [
        { header: 'Produto', key: 'productName', width: 30 },
        { header: 'Estoque Atual', key: 'currentStock', width: 15 },
        { header: 'Consumo Médio/Dia', key: 'averageDaily', width: 18 },
        { header: 'Tendência', key: 'trend', width: 15 },
        { header: 'Consumo Previsto 15d', key: 'predicted', width: 20 },
        { header: 'Recomendação Compra', key: 'recommended', width: 20 },
        { header: 'Risco Ruptura', key: 'risk', width: 15 },
        { header: 'Confiança', key: 'confidence', width: 12 },
      ];
      
      predictionsSheet.addRows(report.products.map(p => ({
        productName: p.productName,
        currentStock: p.currentStock,
        averageDaily: p.averageDailyConsumption.toFixed(2),
        trend: p.consumptionTrend === 'increasing' ? 'Crescente' : p.consumptionTrend === 'decreasing' ? 'Decrescente' : 'Estável',
        predicted: p.predicted15DaysConsumption,
        recommended: p.recommendedReorder,
        risk: p.stockoutRisk === 'high' ? 'Alto' : p.stockoutRisk === 'medium' ? 'Médio' : 'Baixo',
        confidence: p.confidenceLevel === 'high' ? 'Alta' : p.confidenceLevel === 'medium' ? 'Média' : 'Baixa',
      })));

      const fileName = `Reposicao_FoodStation_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to export restock report' });
    }
  });

  // Export Sector Monthly Report to Excel
  app.get('/api/reports/sector/:id/monthly/export', authMiddleware, async (req, res) => {
    try {
      const sectorId = parseInt(req.params.id);
      const cadence = (req.query.cadence as 'monthly' | 'biweekly' | 'weekly') || 'monthly';

      if (isNaN(sectorId)) {
        return res.status(400).json({ message: 'Invalid sector ID' });
      }

      const report = await generateSectorMonthlyReport(sectorId, cadence);

      const workbook = new ExcelJS.Workbook();
      
      // Summary sheet
      const summarySheet = workbook.addWorksheet('Resumo');
      summarySheet.columns = [
        { header: 'Campo', key: 'field', width: 30 },
        { header: 'Valor', key: 'value', width: 30 },
      ];
      
      const cadenceLabel = cadence === 'monthly' ? 'Mensal' : cadence === 'biweekly' ? 'Quinzenal' : 'Semanal';
      
      summarySheet.addRows([
        { field: 'Setor', value: report.sector.name },
        { field: 'Cadência', value: cadenceLabel },
        { field: 'Período', value: `${new Date(report.period.start).toLocaleDateString('pt-BR')} - ${new Date(report.period.end).toLocaleDateString('pt-BR')}` },
        { field: 'Consumo Total', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(report.totalConsumption) },
        { field: 'Itens Consumidos', value: report.totalItemsConsumed },
      ]);

      // Purchase recommendations sheet
      const purchasesSheet = workbook.addWorksheet('Recomendações de Compra');
      purchasesSheet.columns = [
        { header: 'Produto', key: 'productName', width: 30 },
        { header: 'Estoque Atual', key: 'currentStock', width: 15 },
        { header: 'Quantidade Recomendada', key: 'recommended', width: 22 },
        { header: 'Custo Estimado', key: 'cost', width: 18 },
        { header: 'Prioridade', key: 'priority', width: 12 },
      ];
      
      purchasesSheet.addRows(report.recommendedPurchases.map(r => ({
        productName: r.productName,
        currentStock: r.currentStock,
        recommended: r.recommendedQuantity,
        cost: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.estimatedCost),
        priority: r.priority === 'high' ? 'Alta' : r.priority === 'medium' ? 'Média' : 'Baixa',
      })));

      // Frequency analysis sheet (if available)
      if (report.frequencyAnalysis && report.frequencyAnalysis.length > 0) {
        const frequencySheet = workbook.addWorksheet('Análise de Frequência');
        frequencySheet.columns = [
          { header: 'Produto', key: 'productName', width: 30 },
          { header: 'Frequência de Reposição', key: 'frequency', width: 25 },
          { header: 'Uso Médio Diário', key: 'dailyUsage', width: 20 },
        ];
        
        frequencySheet.addRows(report.frequencyAnalysis.map(f => ({
          productName: f.productName,
          frequency: (f.restockFrequency * 100).toFixed(1) + '%',
          dailyUsage: f.averageDailyUsage.toFixed(2),
        })));
      }

      const fileName = `Relatorio_${report.sector.name.replace(/\s+/g, '_')}_${cadence}_${new Date().toISOString().split('T')[0]}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      
      await workbook.xlsx.write(res);
      res.end();
    } catch (error: any) {
      res.status(500).json({ message: error.message || 'Failed to export sector monthly report' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
