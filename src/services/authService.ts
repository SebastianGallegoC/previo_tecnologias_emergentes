import { UserRole } from '../types/transit';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

interface StoredUser extends AuthUser {
  password: string;
}

const USERS_KEY = 'uberbuses_auth_users_v1';
const SESSION_KEY = 'uberbuses_auth_session_v1';

const DEFAULT_USERS: StoredUser[] = [
  {
    id: 'usr-pas-01',
    username: 'pasajero',
    email: 'pasajero@uberbuses.co',
    password: '123456',
    role: 'pasajero',
  },
  {
    id: 'usr-con-01',
    username: 'conductor',
    email: 'conductor@uberbuses.co',
    password: '123456',
    role: 'conductor',
  },
  {
    id: 'usr-adm-01',
    username: 'admin',
    email: 'admin@uberbuses.co',
    password: 'admin123',
    role: 'administrador',
  },
];

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) {
      localStorage.setItem(USERS_KEY, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    }
    const parsed = JSON.parse(raw) as StoredUser[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_USERS;
  } catch {
    return DEFAULT_USERS;
  }
}

function saveUsers(users: StoredUser[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    // Ignore storage quota errors in restricted modes
  }
}

export const authService = {
  getSession(): AuthUser | null {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },

  login(
    identifier: string,
    password: string,
    portal: 'usuario' | 'administrador'
  ): { ok: true; user: AuthUser } | { ok: false; error: string } {
    const cleanId = identifier.trim().toLowerCase();
    if (!cleanId || !password) {
      return { ok: false, error: 'Ingresa tu correo o usuario y tu contraseña.' };
    }

    const users = loadUsers();
    const found = users.find(
      (u) =>
        (u.email.toLowerCase() === cleanId || u.username.toLowerCase() === cleanId) &&
        u.password === password
    );

    if (!found) {
      return { ok: false, error: 'Credenciales incorrectas. Verifica tus datos.' };
    }

    if (portal === 'administrador' && found.role !== 'administrador') {
      return {
        ok: false,
        error: 'Esta cuenta no tiene permisos de administrador.',
      };
    }

    const sessionUser: AuthUser = {
      id: found.id,
      username: found.username,
      email: found.email,
      role: found.role,
    };

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    } catch {
      // Ignore storage errors
    }

    return { ok: true, user: sessionUser };
  },

  register(
    email: string,
    username: string,
    password: string
  ): { ok: true; user: AuthUser } | { ok: false; error: string } {
    const cleanEmail = email.trim().toLowerCase();
    const cleanUser = username.trim();

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { ok: false, error: 'Ingresa un correo electrónico válido.' };
    }
    if (cleanUser.length < 3) {
      return { ok: false, error: 'El usuario debe tener al menos 3 caracteres.' };
    }
    if (password.length < 6) {
      return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }

    const users = loadUsers();
    const exists = users.some(
      (u) =>
        u.email.toLowerCase() === cleanEmail ||
        u.username.toLowerCase() === cleanUser.toLowerCase()
    );
    if (exists) {
      return { ok: false, error: 'El correo o usuario ya se encuentra registrado.' };
    }

    const newUser: StoredUser = {
      id: `usr-${Date.now()}`,
      username: cleanUser,
      email: cleanEmail,
      password,
      role: 'pasajero',
    };

    saveUsers([...users, newUser]);

    const sessionUser: AuthUser = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
    };

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    } catch {
      // Ignore storage errors
    }

    return { ok: true, user: sessionUser };
  },

  logout(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // Ignore storage errors
    }
  },
};
