import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp, DbClientLike, DbPoolLike } from '../src/app.js';

function createMockDb(): DbPoolLike {
  const users: Array<{
    id: string;
    username: string;
    nombre_completo: string;
    correo: string;
    rol: 'pasajero' | 'administrador';
    password_hash: string;
    activo: boolean;
  }> = [
    {
      id: 'usr-adm-01',
      username: 'admin',
      nombre_completo: 'Ana Patricia Ruiz',
      correo: 'admin@uberbuses.co',
      rol: 'administrador',
      password_hash: 'demo:admin123',
      activo: true,
    },
  ];

  const wallets: Array<{ id: string; usuario_id: string; saldo_cop: number; estado: string }> = [
    { id: 'wal-adm-01', usuario_id: 'usr-adm-01', saldo_cop: 35000, estado: 'activa' },
  ];

  const txs: Array<Record<string, unknown>> = [];
  const tickets: Array<Record<string, unknown>> = [];
  const alerts: Array<Record<string, unknown>> = [];

  async function runQuery(text: string, params: unknown[] = []) {
    const sql = text.trim();
    if (sql === 'SELECT 1' || sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') {
      return { rows: [{ '?column?': 1 }], rowCount: 1 };
    }

    if (sql.includes('FROM usuarios') && sql.includes('WHERE LOWER(correo) = $1 OR LOWER')) {
      const idOrEmail = String(params[0]).toLowerCase();
      const id2 = params[1] ? String(params[1]).toLowerCase() : idOrEmail;
      const found = users.filter(
        (u) => u.correo.toLowerCase() === idOrEmail || u.username.toLowerCase() === id2
      );
      return { rows: found, rowCount: found.length };
    }

    if (sql.startsWith('INSERT INTO usuarios')) {
      const [id, username, correo, password_hash] = params as [string, string, string, string];
      users.push({
        id,
        username,
        nombre_completo: username,
        correo,
        rol: 'pasajero',
        password_hash,
        activo: true,
      });
      return { rows: [], rowCount: 1 };
    }

    if (sql.startsWith('INSERT INTO billeteras')) {
      const [id, usuario_id] = params as [string, string];
      wallets.push({ id, usuario_id, saldo_cop: 35000, estado: 'activa' });
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes('FROM billeteras WHERE usuario_id = $1')) {
      const found = wallets.filter((w) => w.usuario_id === params[0]);
      return { rows: found, rowCount: found.length };
    }

    if (sql.startsWith('UPDATE billeteras SET saldo_cop = $1')) {
      const [newBalance, walletId] = params as [number, string];
      const w = wallets.find((item) => item.id === walletId);
      if (w) w.saldo_cop = newBalance;
      return { rows: [], rowCount: 1 };
    }

    if (sql.startsWith('INSERT INTO transacciones_billetera')) {
      txs.push({
        id: params[0],
        billetera_id: params[1],
        tipo: params[2],
        monto_cop: params[3],
        descripcion: params[4],
        codigo_referencia: params[5],
        metodo_pago: params[6],
      });
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes('FROM transacciones_billetera')) {
      const found = txs.filter((t) => t.billetera_id === params[0]);
      return { rows: found, rowCount: found.length };
    }

    if (sql.startsWith('INSERT INTO tiquetes')) {
      tickets.push({ id: params[0], codigo_tiquete: params[1] });
      return { rows: [], rowCount: 1 };
    }

    if (sql.startsWith('INSERT INTO alertas_trafico')) {
      alerts.push({ id: params[0], ubicacion: params[3] });
      return { rows: [], rowCount: 1 };
    }

    if (sql.includes('FROM rutas r')) {
      return {
        rows: [{ id: 'R01', codigo: 'R-01', nombre: 'Los Patios - Centro - Atalaya', tarifa_cop: 3400 }],
        rowCount: 1,
      };
    }

    if (sql.includes('FROM vehiculos v')) {
      return {
        rows: [{ id: 'bus-tr-101', codigo_interno: 'TR-101', placa: 'WFB-341' }],
        rowCount: 1,
      };
    }

    return { rows: [], rowCount: 0 };
  }

  return {
    query: runQuery as DbPoolLike['query'],
    async connect(): Promise<DbClientLike> {
      return {
        query: runQuery as DbClientLike['query'],
        release: () => {},
      };
    },
  };
}

test('UberBuses Backend API integration suite', async (t) => {
  const app = createApp(createMockDb());
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  t.after(() => server.close());

  let createdUserId = '';

  await t.test('GET /api/health returns connected status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.database, 'connected');
  });

  await t.test('POST /api/auth/register creates pasajero with email, username, password only', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nuevo@uberbuses.co',
        username: 'nuevo_user',
        password: 'secret123',
      }),
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.user.role, 'pasajero');
    assert.equal(body.user.username, 'nuevo_user');
    assert.ok(body.token);
    createdUserId = body.user.id;
  });

  await t.test('POST /api/auth/login infers administrador role from credentials', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin',
        password: 'admin123',
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.user.role, 'administrador');
    assert.ok(body.token);
  });

  await t.test('POST /api/auth/login rejects invalid password', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'admin@uberbuses.co',
        password: 'wrong',
      }),
    });
    assert.equal(res.status, 401);
  });

  await t.test('Wallet recharge & ticket payment deduct $3.400 COP atomically', async () => {
    const rRes = await fetch(`${baseUrl}/api/wallet/recharge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: createdUserId, amountCop: 10000, method: 'Nequi' }),
    });
    assert.equal(rRes.status, 200);
    const rBody = await rRes.json();
    assert.equal(rBody.balanceCop, 45000);

    const pRes = await fetch(`${baseUrl}/api/tickets/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: createdUserId,
        vehicleId: 'bus-tr-101',
        routeId: 'R01',
        paymentMethod: 'QR',
      }),
    });
    assert.equal(pRes.status, 201);
    const pBody = await pRes.json();
    assert.equal(pBody.balanceCop, 41600);
    assert.equal(pBody.ticket.fareCop, 3400);
  });

  await t.test('GET /api/routes and /api/vehicles return catalog data', async () => {
    const routesRes = await fetch(`${baseUrl}/api/routes`);
    assert.equal(routesRes.status, 200);
    const routesBody = await routesRes.json();
    assert.equal(routesBody.routes[0].codigo, 'R-01');

    const vehRes = await fetch(`${baseUrl}/api/vehicles`);
    assert.equal(vehRes.status, 200);
    const vehBody = await vehRes.json();
    assert.equal(vehBody.vehicles[0].codigo_interno, 'TR-101');
  });
});
