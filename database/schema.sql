-- ============================================================================
-- UberBuses (TransCúcuta Inteligente) - Script de Creación de Base de Datos
-- Motor objetivo: PostgreSQL 15+ (compatible con estándar ANSI SQL)
-- ============================================================================

-- 1. Cooperativas / Empresas de Transporte
CREATE TABLE cooperativas (
    id              VARCHAR(36) PRIMARY KEY,
    nombre          VARCHAR(120) NOT NULL UNIQUE,
    nit             VARCHAR(30) UNIQUE,
    telefono        VARCHAR(30),
    activa          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Usuarios del Sistema (Pasajeros, Conductores, Administradores)
CREATE TABLE usuarios (
    id              VARCHAR(36) PRIMARY KEY,
    username        VARCHAR(80) UNIQUE,
    nombre_completo VARCHAR(120) NOT NULL,
    correo          VARCHAR(150) NOT NULL UNIQUE,
    telefono        VARCHAR(30),
    rol             VARCHAR(20) NOT NULL CHECK (rol IN ('pasajero', 'administrador')),
    password_hash   VARCHAR(255) NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Rutas Metropolitanas (Cúcuta, Los Patios, Villa del Rosario)
CREATE TABLE rutas (
    id                  VARCHAR(20) PRIMARY KEY,
    codigo              VARCHAR(16) NOT NULL UNIQUE,
    nombre              VARCHAR(150) NOT NULL,
    cooperativa_id      VARCHAR(36) NOT NULL REFERENCES cooperativas(id) ON UPDATE CASCADE,
    color_hex           VARCHAR(10) NOT NULL DEFAULT '#10b981',
    tarifa_cop          INTEGER NOT NULL CHECK (tarifa_cop > 0),
    descripcion         TEXT,
    sentido_a           VARCHAR(120) NOT NULL,
    sentido_b           VARCHAR(120) NOT NULL,
    horario_operacion   VARCHAR(80) NOT NULL,
    frecuencia_minutos  INTEGER NOT NULL CHECK (frecuencia_minutos > 0),
    activa              BOOLEAN NOT NULL DEFAULT TRUE
);

-- 4. Paraderos Oficiales
CREATE TABLE paraderos (
    id              VARCHAR(36) PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    punto_referencia VARCHAR(180),
    municipio       VARCHAR(40) NOT NULL CHECK (municipio IN ('Cúcuta', 'Los Patios', 'Villa del Rosario')),
    latitud         DECIMAL(9, 6) NOT NULL,
    longitud        DECIMAL(9, 6) NOT NULL
);

-- 5. Relación Ordenada Ruta <-> Paraderos (N:M)
CREATE TABLE ruta_paraderos (
    ruta_id         VARCHAR(20) NOT NULL REFERENCES rutas(id) ON DELETE CASCADE,
    paradero_id     VARCHAR(36) NOT NULL REFERENCES paraderos(id) ON DELETE CASCADE,
    orden_parada    INTEGER NOT NULL CHECK (orden_parada > 0),
    sentido         VARCHAR(10) NOT NULL DEFAULT 'ida' CHECK (sentido IN ('ida', 'vuelta')),
    PRIMARY KEY (ruta_id, paradero_id, sentido)
);

-- 6. Vehículos / Busetas y Telemetría en Tiempo Real
CREATE TABLE vehiculos (
    id                  VARCHAR(36) PRIMARY KEY,
    codigo_interno      VARCHAR(20) NOT NULL UNIQUE,
    placa               VARCHAR(15) NOT NULL UNIQUE,
    cooperativa_id      VARCHAR(36) NOT NULL REFERENCES cooperativas(id),
    ruta_id             VARCHAR(20) NOT NULL REFERENCES rutas(id),
    conductor_id        VARCHAR(36) REFERENCES usuarios(id) ON DELETE SET NULL,
    capacidad_maxima    INTEGER NOT NULL DEFAULT 28 CHECK (capacidad_maxima > 0),
    conteo_pasajeros    INTEGER NOT NULL DEFAULT 0 CHECK (conteo_pasajeros >= 0),
    latitud_actual      DECIMAL(9, 6) NOT NULL,
    longitud_actual     DECIMAL(9, 6) NOT NULL,
    rumbo_grados        INTEGER NOT NULL DEFAULT 0 CHECK (rumbo_grados BETWEEN 0 AND 359),
    velocidad_kmh       DECIMAL(5, 2) NOT NULL DEFAULT 0,
    estado              VARCHAR(20) NOT NULL DEFAULT 'en_ruta'
                        CHECK (estado IN ('en_ruta', 'en_parada', 'despacho', 'congestión')),
    sentido_actual      VARCHAR(10) NOT NULL DEFAULT 'ida' CHECK (sentido_actual IN ('ida', 'vuelta')),
    proxima_parada_id   VARCHAR(36) REFERENCES paraderos(id) ON DELETE SET NULL,
    ultima_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Billetera Digital CúcutaPass
CREATE TABLE billeteras (
    id              VARCHAR(36) PRIMARY KEY,
    usuario_id      VARCHAR(36) NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    saldo_cop       INTEGER NOT NULL DEFAULT 0 CHECK (saldo_cop >= 0),
    estado          VARCHAR(20) NOT NULL DEFAULT 'activa' CHECK (estado IN ('activa', 'bloqueada')),
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Movimientos / Transacciones de Billetera
CREATE TABLE transacciones_billetera (
    id              VARCHAR(36) PRIMARY KEY,
    billetera_id    VARCHAR(36) NOT NULL REFERENCES billeteras(id) ON DELETE CASCADE,
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('pago_pasaje', 'recarga')),
    monto_cop       INTEGER NOT NULL CHECK (monto_cop > 0),
    descripcion     VARCHAR(200) NOT NULL,
    codigo_referencia VARCHAR(60) NOT NULL UNIQUE,
    metodo_pago     VARCHAR(40),
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Tiquetes Digitales (QR / NFC)
CREATE TABLE tiquetes (
    id              VARCHAR(36) PRIMARY KEY,
    codigo_tiquete  VARCHAR(40) NOT NULL UNIQUE,
    usuario_id      VARCHAR(36) NOT NULL REFERENCES usuarios(id),
    vehiculo_id     VARCHAR(36) NOT NULL REFERENCES vehiculos(id),
    ruta_id         VARCHAR(20) NOT NULL REFERENCES rutas(id),
    transaccion_id  VARCHAR(36) REFERENCES transacciones_billetera(id) ON DELETE SET NULL,
    tarifa_cop      INTEGER NOT NULL CHECK (tarifa_cop > 0),
    municipio       VARCHAR(40) NOT NULL,
    metodo_pago     VARCHAR(30) NOT NULL CHECK (metodo_pago IN ('NFC', 'QR', 'Saldo Billetera')),
    estado          VARCHAR(20) NOT NULL DEFAULT 'válido' CHECK (estado IN ('válido', 'usado', 'vencido')),
    datos_qr        TEXT NOT NULL,
    fecha_emision   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valido_hasta    TIMESTAMP NOT NULL
);

-- 10. Alertas Viales y Novedades en Ruta
CREATE TABLE alertas_trafico (
    id              VARCHAR(36) PRIMARY KEY,
    vehiculo_id     VARCHAR(36) REFERENCES vehiculos(id) ON DELETE SET NULL,
    reportado_por   VARCHAR(36) REFERENCES usuarios(id) ON DELETE SET NULL,
    ubicacion       VARCHAR(160) NOT NULL,
    municipio       VARCHAR(40) NOT NULL CHECK (municipio IN ('Cúcuta', 'Los Patios', 'Villa del Rosario')),
    severidad       VARCHAR(20) NOT NULL CHECK (severidad IN ('moderado', 'alto', 'desvío')),
    descripcion     TEXT NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Índices para consultas frecuentes de telemetría, rutas y tiquetes
CREATE INDEX idx_vehiculos_ruta_estado ON vehiculos(ruta_id, estado);
CREATE INDEX idx_paraderos_municipio ON paraderos(municipio);
CREATE INDEX idx_transacciones_billetera_fecha ON transacciones_billetera(billetera_id, created_at DESC);
CREATE INDEX idx_tiquetes_usuario_estado ON tiquetes(usuario_id, estado);
CREATE INDEX idx_alertas_municipio_fecha ON alertas_trafico(municipio, created_at DESC);
