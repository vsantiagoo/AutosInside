import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage-sqlite";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { promises as fs } from "fs";
import path from "path";
import ExcelJS from "exceljs";
import {
  loginSchema,
  insertUserSchema,
  insertSectorSchema,
  insertProductSchema,
  insertStockTransactionSchema,
  insertConsumptionSchema,
  type User,
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
      const password_hash = userData.password ? await bcrypt.hash(userData.password, 10) : undefined;
      
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

  // Products routes
  app.get('/api/products', authMiddleware, async (req, res) => {
    const products = await storage.getAllProducts();
    res.json(products);
  });

  app.post('/api/products', authMiddleware, upload.single('photo'), async (req, res) => {
    try {
      const productData = {
        name: req.body.name,
        sector_id: req.body.sector_id ? parseInt(req.body.sector_id) : null,
        sku: req.body.sku || null,
        unit_price: parseFloat(req.body.unit_price) || 0,
        stock_quantity: parseInt(req.body.stock_quantity) || 0,
      };

      insertProductSchema.parse(productData);

      const photo_path = req.file ? `/uploads/${req.file.filename}` : null;

      const product = await storage.createProduct({
        ...productData,
        photo_path,
        total_in: productData.stock_quantity,
        total_out: 0,
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

      const updateData: any = {
        name: req.body.name,
        sector_id: req.body.sector_id ? parseInt(req.body.sector_id) : null,
        sku: req.body.sku || null,
        unit_price: parseFloat(req.body.unit_price),
        stock_quantity: parseInt(req.body.stock_quantity),
      };

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
    const products = await storage.getLowStockProducts();
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
      if (error.message && error.message.includes('FOREIGN KEY constraint failed')) {
        return res.status(400).json({ 
          message: 'Não é possível excluir este produto porque ele possui consumos registrados. Você pode excluir os consumos relacionados primeiro ou manter o produto no sistema.' 
        });
      }
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
        ...transactionData,
        reason: transactionData.reason || null,
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

      const consumption = await storage.createConsumption({
        user_id: req.user!.id, // Use authenticated user's ID
        product_id,
        qty,
        unit_price: product.unit_price,
        total_price: product.unit_price * qty,
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

  // Dashboard stats
  app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
    const products = await storage.getAllProducts();
    const consumptions = await storage.getAllConsumptions();
    
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const monthlyConsumptions = consumptions.filter(
      c => new Date(c.consumed_at) >= thisMonth
    ).length;

    const lowStockCount = products.filter(p => p.stock_quantity < 10 && p.stock_quantity > 0).length;
    const totalValue = products.reduce((sum, p) => sum + (p.unit_price * p.stock_quantity), 0);

    res.json({
      totalProducts: products.length,
      lowStockCount,
      monthlyConsumptions,
      totalValue,
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}
