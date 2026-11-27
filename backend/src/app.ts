import express, { Request, Response } from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db/pool.js';

export interface DbQueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number | null;
}

export interface DbClientLike {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<DbQueryResult<T>>;
  release?: () => void;
}

export interface DbPoolLike {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<DbQueryResult<T>>;
  connect(): Promise<DbClientLike>;
}

const JWT_SECRET = process.env.JWT_SECRET || 'uberbuses-cucuta-dev-secret-2026';
const METROPOLITAN_FARE_COP = 3400;

async function verifyPassword(plain: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('demo:')) {
    return plain === storedHash.slice(5);
  }
  return bcrypt.compare(plain, storedHash);
}

export function createApp(db: DbPoolLike = pool as unknown as DbPoolLike) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Healthcheck
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      await db.query('SELECT 1');
      res.json({ ok: true, database: 'connected', service: 'uberbuses-backend' });
    } catch {
      res.status(503).json({ ok: false, database: 'disconnected', service: 'uberbuses-backend' });
    }
  });

  // POST /api/auth/login — infers role from DB credentials
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { identifier, password } = req.body as { identifier?: string; password?: string };
      const cleanId = (identifier || '').trim().toLowerCase();
      if (!cleanId || !password) {
        res.status(400).json({ error: 'Ingresa tu correo o usuario y tu contraseña.' });
        return;
      }

      const result = await db.query<{
        id: string;
        username: string | null;
        nombre_completo: string;
        correo: string;
        rol: 'pasajero' | 'administrador';
        password_hash: string;
        activo: boolean;
      }>(
        `SELECT id, username, nombre_completo, correo, rol, password_hash, activo
         FROM usuarios
         WHERE LOWER(correo) = $1 OR LOWER(COALESCE(username, '')) = $1
         LIMIT 1`,
        [cleanId]
      );

      const user = result.rows[0];
      if (!user || !user.activo) {
        res.status(401).json({ error: 'Credenciales incorrectas. Verifica tus datos.' });
        return;
      }

      const valid = await verifyPassword(password, user.password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Credenciales incorrectas. Verifica tus datos.' });
        return;
      }

      const payload = {
        id: user.id,
        username: user.username || user.nombre_completo,
        email: user.correo,
        role: user.rol,
      };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
      res.json({ user: payload, token });
    } catch (err) {
      res.status(500).json({ error: 'Error interno al iniciar sesión.' });
    }
  });

  // POST /api/auth/register — strictly correo, usuario, contraseña
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const { email, username, password } = req.body as {
      email?: string;
      username?: string;
      password?: string;
    };

    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanUser = (username || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
      return;
    }
    if (cleanUser.length < 3) {
      res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres.' });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      return;
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query(
        `SELECT id FROM usuarios WHERE LOWER(correo) = $1 OR LOWER(COALESCE(username, '')) = $2 LIMIT 1`,
        [cleanEmail, cleanUser.toLowerCase()]
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        res.status(409).json({ error: 'El correo o usuario ya se encuentra registrado.' });
        return;
      }

      const userId = `usr-${Date.now()}`;
      const walletId = `wal-${Date.now()}`;
      const passwordHash = await bcrypt.hash(password, 10);

      await client.query(
        `INSERT INTO usuarios (id, username, nombre_completo, correo, rol, password_hash)
         VALUES ($1, $2, $2, $3, 'pasajero', $4)`,
        [userId, cleanUser, cleanEmail, passwordHash]
      );

      await client.query(
        `INSERT INTO billeteras (id, usuario_id, saldo_cop, estado)
         VALUES ($1, $2, 35000, 'activa')`,
        [walletId, userId]
      );

      await client.query(
        `INSERT INTO transacciones_billetera (id, billetera_id, tipo, monto_cop, descripcion, codigo_referencia, metodo_pago)
         VALUES ($1, $2, 'recarga', 35000, 'Recarga inicial de bienvenida CúcutaPass', $3, 'Sistema')`,
        [`tx-init-${Date.now()}`, walletId, `REF-INIT-${Date.now()}`]
      );

      await client.query('COMMIT');

      const userPayload = {
        id: userId,
        username: cleanUser,
        email: cleanEmail,
        role: 'pasajero' as const,
      };
      const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '12h' });
      res.status(201).json({ user: userPayload, token });
    } catch {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Error al registrar el usuario.' });
    } finally {
      client.release?.();
    }
  });

  // GET /api/routes
  app.get('/api/routes', async (_req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT r.id, r.codigo, r.nombre, c.nombre AS cooperativa, r.color_hex, r.tarifa_cop,
                r.descripcion, r.sentido_a, r.sentido_b, r.horario_operacion, r.frecuencia_minutos
         FROM rutas r
         JOIN cooperativas c ON c.id = r.cooperativa_id
         WHERE r.activa = TRUE
         ORDER BY r.codigo ASC`
      );
      res.json({ routes: result.rows });
    } catch {
      res.status(500).json({ error: 'Error al consultar rutas.' });
    }
  });

  // GET /api/vehicles
  app.get('/api/vehicles', async (_req: Request, res: Response) => {
    try {
      const result = await db.query(
        `SELECT v.id, v.codigo_interno, v.placa, c.nombre AS cooperativa, v.ruta_id,
                v.capacidad_maxima, v.conteo_pasajeros, v.latitud_actual, v.longitud_actual,
                v.velocidad_kmh, v.estado, v.sentido_actual
         FROM vehiculos v
         JOIN cooperativas c ON c.id = v.cooperativa_id
         ORDER BY v.codigo_interno ASC`
      );
      res.json({ vehicles: result.rows });
    } catch {
      res.status(500).json({ error: 'Error al consultar vehículos.' });
    }
  });

  // GET /api/wallet/:userId
  app.get('/api/wallet/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const walletRes = await db.query<{ id: string; saldo_cop: number; estado: string }>(
        `SELECT id, saldo_cop, estado FROM billeteras WHERE usuario_id = $1 LIMIT 1`,
        [userId]
      );
      const wallet = walletRes.rows[0];
      if (!wallet) {
        res.status(404).json({ error: 'Billetera no encontrada.' });
        return;
      }

      const txRes = await db.query(
        `SELECT id, tipo, monto_cop, descripcion, codigo_referencia, metodo_pago, created_at
         FROM transacciones_billetera
         WHERE billetera_id = $1
         ORDER BY created_at DESC
         LIMIT 50`,
        [wallet.id]
      );
      res.json({ balanceCop: wallet.saldo_cop, status: wallet.estado, transactions: txRes.rows });
    } catch {
      res.status(500).json({ error: 'Error al consultar la billetera.' });
    }
  });

  // POST /api/wallet/recharge
  app.post('/api/wallet/recharge', async (req: Request, res: Response) => {
    const { userId, amountCop, method } = req.body as {
      userId?: string;
      amountCop?: number;
      method?: string;
    };
    if (!userId || !amountCop || amountCop <= 0) {
      res.status(400).json({ error: 'Datos de recarga inválidos.' });
      return;
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const wRes = await client.query<{ id: string; saldo_cop: number }>(
        `SELECT id, saldo_cop FROM billeteras WHERE usuario_id = $1 FOR UPDATE`,
        [userId]
      );
      const wallet = wRes.rows[0];
      if (!wallet) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Billetera no encontrada.' });
        return;
      }

      const newBalance = wallet.saldo_cop + amountCop;
      await client.query(`UPDATE billeteras SET saldo_cop = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
        newBalance,
        wallet.id,
      ]);

      const ref = `REF-REC-${Date.now()}`;
      await client.query(
        `INSERT INTO transacciones_billetera (id, billetera_id, tipo, monto_cop, descripcion, codigo_referencia, metodo_pago)
         VALUES ($1, $2, 'recarga', $3, $4, $5, $6)`,
        [`tx-${Date.now()}`, wallet.id, amountCop, `Recarga CúcutaPass (${method || 'PSE'})`, ref, method || 'PSE']
      );

      await client.query('COMMIT');
      res.json({ balanceCop: newBalance, referenceCode: ref });
    } catch {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Error al procesar recarga.' });
    } finally {
      client.release?.();
    }
  });

  // POST /api/tickets/pay
  app.post('/api/tickets/pay', async (req: Request, res: Response) => {
    const { userId, vehicleId, routeId, paymentMethod } = req.body as {
      userId?: string;
      vehicleId?: string;
      routeId?: string;
      paymentMethod?: 'NFC' | 'QR' | 'Saldo Billetera';
    };
    if (!userId || !vehicleId || !routeId) {
      res.status(400).json({ error: 'Faltan datos para emitir el tiquete.' });
      return;
    }

    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const wRes = await client.query<{ id: string; saldo_cop: number }>(
        `SELECT id, saldo_cop FROM billeteras WHERE usuario_id = $1 FOR UPDATE`,
        [userId]
      );
      const wallet = wRes.rows[0];
      if (!wallet) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Billetera no encontrada.' });
        return;
      }
      if (wallet.saldo_cop < METROPOLITAN_FARE_COP) {
        await client.query('ROLLBACK');
        res.status(402).json({ error: 'Saldo insuficiente en CúcutaPass.' });
        return;
      }

      const newBalance = wallet.saldo_cop - METROPOLITAN_FARE_COP;
      await client.query(`UPDATE billeteras SET saldo_cop = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
        newBalance,
        wallet.id,
      ]);

      const txId = `tx-${Date.now()}`;
      const refCode = `REF-PAY-${Date.now()}`;
      await client.query(
        `INSERT INTO transacciones_billetera (id, billetera_id, tipo, monto_cop, descripcion, codigo_referencia, metodo_pago)
         VALUES ($1, $2, 'pago_pasaje', $3, $4, $5, $6)`,
        [txId, wallet.id, METROPOLITAN_FARE_COP, `Pasaje Ruta ${routeId}`, refCode, paymentMethod || 'QR']
      );

      const ticketCode = `TK-CUC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
      const ticketId = `tk-${Date.now()}`;
      const qrData = `UBERBUSES|${ticketCode}|${routeId}|${vehicleId}|${METROPOLITAN_FARE_COP}`;

      await client.query(
        `INSERT INTO tiquetes (id, codigo_tiquete, usuario_id, vehiculo_id, ruta_id, transaccion_id, tarifa_cop, municipio, metodo_pago, estado, datos_qr, valido_hasta)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'Cúcuta', $8, 'válido', $9, CURRENT_TIMESTAMP + INTERVAL '1 hour')`,
        [ticketId, ticketCode, userId, vehicleId, routeId, txId, METROPOLITAN_FARE_COP, paymentMethod || 'QR', qrData]
      );

      await client.query('COMMIT');
      res.status(201).json({
        ticket: {
          id: ticketId,
          ticketCode,
          fareCop: METROPOLITAN_FARE_COP,
          paymentMethod: paymentMethod || 'QR',
          qrData,
          status: 'válido',
        },
        balanceCop: newBalance,
      });
    } catch {
      await client.query('ROLLBACK');
      res.status(500).json({ error: 'Error al emitir tiquete.' });
    } finally {
      client.release?.();
    }
  });

  // POST /api/alerts
  app.post('/api/alerts', async (req: Request, res: Response) => {
    const { vehicleId, userId, location, municipality, severity, description } = req.body as {
      vehicleId?: string;
      userId?: string;
      location?: string;
      municipality?: string;
      severity?: 'moderado' | 'alto' | 'desvío';
      description?: string;
    };
    if (!location || !municipality || !severity || !description) {
      res.status(400).json({ error: 'Completa todos los campos de la alerta.' });
      return;
    }

    try {
      const id = `alt-${Date.now()}`;
      await db.query(
        `INSERT INTO alertas_trafico (id, vehiculo_id, reportado_por, ubicacion, municipio, severidad, descripcion)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, vehicleId || null, userId || null, location, municipality, severity, description]
      );
      res.status(201).json({ id, ok: true });
    } catch {
      res.status(500).json({ error: 'Error al registrar alerta.' });
    }
  });

  return app;
}
