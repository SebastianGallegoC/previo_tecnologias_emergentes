-- ============================================================================
-- UberBuses (TransCúcuta Inteligente) - Datos Iniciales de Prueba (Seed)
-- ============================================================================

INSERT INTO cooperativas (id, nombre, nit, telefono) VALUES
('coop-trasan', 'Cooperativa Trasan', '890500123-1', '607-5710001'),
('coop-corta',  'Corta Distancia S.A.', '890500456-2', '607-5710002'),
('coop-micro',  'Coomicro', '890500789-3', '607-5710003');

INSERT INTO usuarios (id, nombre_completo, correo, telefono, rol, password_hash) VALUES
('usr-pas-01', 'Laura Gómez', 'laura.gomez@correo.com', '3105550101', 'pasajero', '$2b$10$demoHashPasajero01'),
('usr-con-01', 'Carlos Mendoza', 'carlos.mendoza@trasan.co', '3115550202', 'conductor', '$2b$10$demoHashConductor01'),
('usr-con-02', 'Édgar Peñaranda', 'edgar.p@cortadistancia.co', '3125550303', 'conductor', '$2b$10$demoHashConductor02'),
('usr-adm-01', 'Ana Patricia Ruiz', 'admin@uberbuses.co', '3155550404', 'administrador', '$2b$10$demoHashAdmin01');

INSERT INTO rutas (id, codigo, nombre, cooperativa_id, color_hex, tarifa_cop, descripcion, sentido_a, sentido_b, horario_operacion, frecuencia_minutos) VALUES
('R01', 'R-01', 'Los Patios - Centro - Atalaya', 'coop-trasan', '#10b981', 3400, 'Corredor troncal sur-norte por Av. 10 de Los Patios, Av. Cero, Parque Santander y Atalaya.', 'Los Patios', 'Atalaya', '05:00 AM - 10:30 PM', 5),
('R02', 'R-02', 'La Parada / Rosario - Centro - Terminal', 'coop-corta', '#2563eb', 3400, 'Conexión internacional Villa del Rosario con el centro y Terminal de Transportes.', 'La Parada', 'Terminal', '05:00 AM - 10:00 PM', 7),
('R03', 'R-03', 'La Libertad - UFPS - Hospital - Terminal', 'coop-micro', '#d97706', 3400, 'Ruta universitaria y hospitalaria por Av. Gran Colombia y Guaimaral.', 'La Libertad', 'Terminal', '05:30 AM - 09:30 PM', 8);

INSERT INTO paraderos (id, nombre, punto_referencia, municipio, latitud, longitud) VALUES
('stop-lp-1', 'Terminalito Los Patios', 'Calle 28 con Av. 10', 'Los Patios', 7.828000, -72.507500),
('stop-cu-7', 'Parque Santander / Centro', 'Calle 11 con Avenida 5ta', 'Cúcuta', 7.889100, -72.505000),
('stop-cu-4', 'UFPS - Entrada Principal', 'Av. Gran Colombia frente al Campus UFPS', 'Cúcuta', 7.899700, -72.484200),
('stop-vr-0', 'La Parada / Puente Simón Bolívar', 'Terminalito La Parada - Frontera', 'Villa del Rosario', 7.823500, -72.452500);

INSERT INTO ruta_paraderos (ruta_id, paradero_id, orden_parada, sentido) VALUES
('R01', 'stop-lp-1', 1, 'ida'),
('R01', 'stop-cu-7', 12, 'ida'),
('R02', 'stop-vr-0', 1, 'ida'),
('R02', 'stop-cu-7', 9, 'ida'),
('R03', 'stop-cu-4', 6, 'ida');

INSERT INTO vehiculos (id, codigo_interno, placa, cooperativa_id, ruta_id, conductor_id, capacidad_maxima, conteo_pasajeros, latitud_actual, longitud_actual, rumbo_grados, velocidad_kmh, estado, sentido_actual, proxima_parada_id) VALUES
('bus-tr-101', 'TR-101', 'WFB-341', 'coop-trasan', 'R01', 'usr-con-01', 28, 16, 7.845800, -72.505700, 15, 22.00, 'en_ruta', 'ida', 'stop-cu-7'),
('bus-cd-202', 'CD-202', 'THV-519', 'coop-corta', 'R02', 'usr-con-02', 28, 12, 7.833500, -72.462000, 310, 26.50, 'en_ruta', 'ida', 'stop-cu-7');

INSERT INTO billeteras (id, usuario_id, saldo_cop, estado) VALUES
('wal-pas-01', 'usr-pas-01', 35000, 'activa');

INSERT INTO transacciones_billetera (id, billetera_id, tipo, monto_cop, descripcion, codigo_referencia, metodo_pago) VALUES
('tx-init-01', 'wal-pas-01', 'recarga', 35000, 'Recarga inicial de bienvenida CúcutaPass', 'REF-CUC-2026-0001', 'Nequi'),
('tx-pay-01',  'wal-pas-01', 'pago_pasaje', 3400, 'Pasaje Ruta R-01 (TR-101)', 'REF-CUC-2026-0002', 'QR');

INSERT INTO tiquetes (id, codigo_tiquete, usuario_id, vehiculo_id, ruta_id, transaccion_id, tarifa_cop, municipio, metodo_pago, estado, datos_qr, valido_hasta) VALUES
('tk-001', 'TK-CUC-2026-84824', 'usr-pas-01', 'bus-tr-101', 'R01', 'tx-pay-01', 3400, 'Cúcuta', 'QR', 'válido', 'UBERBUSES|TK-CUC-2026-84824|R01|TR-101|3400', CURRENT_TIMESTAMP + INTERVAL '1 hour');

INSERT INTO alertas_trafico (id, vehiculo_id, reportado_por, ubicacion, municipio, severidad, descripcion) VALUES
('alt-001', 'bus-tr-101', 'usr-con-01', 'Puente y Redoma de San Rafael', 'Cúcuta', 'moderado', 'Flujo vehicular lento en sentido norte-sur por hora pico.');
