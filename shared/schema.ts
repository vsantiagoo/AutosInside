import { z } from "zod";

// Users Schema
export const userSchema = z.object({
  id: z.number(),
  full_name: z.string(),
  matricula: z.string(),
  password_hash: z.string().optional(),
  role: z.enum(['admin', 'user']),
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

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginCredentials = z.infer<typeof loginSchema>;

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
  unit_price: z.number(),
  stock_quantity: z.number(),
  total_in: z.number(),
  total_out: z.number(),
  photo_path: z.string().nullable(),
  low_stock_threshold: z.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const insertProductSchema = z.object({
  name: z.string().min(1, "Nome do produto é obrigatório"),
  sector_id: z.number().nullable().optional(),
  sku: z.string().nullable().optional(),
  unit_price: z.number().min(0, "Preço unitário deve ser positivo").default(0),
  stock_quantity: z.number().int().min(0, "Quantidade em estoque não pode ser negativa").default(0),
  low_stock_threshold: z.number().int().min(0).optional().default(10),
});

export type Product = z.infer<typeof productSchema>;
export type InsertProduct = z.infer<typeof insertProductSchema>;

// Stock Transactions Schema
export const stockTransactionSchema = z.object({
  id: z.number(),
  product_id: z.number(),
  change: z.number(),
  reason: z.string().nullable(),
  created_at: z.string(),
});

export const insertStockTransactionSchema = z.object({
  product_id: z.number(),
  change: z.number().int().refine((val) => val !== 0, "Change cannot be zero"),
  reason: z.string().optional(),
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
};

export type StockTransactionWithProduct = StockTransaction & {
  product_name?: string;
};
