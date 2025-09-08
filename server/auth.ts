import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    const user = await storage.getUser(id);
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password),
    });

    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Erro interno do servidor" });
      }
      if (!user) {
        return res.status(401).json({ error: "Credenciais inválidas" });
      }
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ error: "Erro ao fazer login" });
        }
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}

// Middleware para verificar autenticação
export function isAuthenticated(req: any, res: any, next: any) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Autenticação necessária" });
}

// RBAC Middleware - Wave 1 Implementation
export function requireRole(...allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Autenticação necessária" });
    }

    const user = req.user!;
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ 
        error: "Acesso negado. Permissão insuficiente.",
        required: allowedRoles,
        current: user.role 
      });
    }

    next();
  };
}

// Middleware de acesso simplificado para novo modelo de papéis
export function requireClientAccess(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Autenticação necessária" });
  }

  const user = req.user!;
  
  // SUPER_ADMIN (CEO Gquicks) tem acesso total sem restrições
  if (user.role === 'SUPER_ADMIN') {
    return next();
  }

  // CLIENT_USER só acessa dados do próprio tenant
  if (user.role === 'CLIENT_USER') {
    // Filtrar automaticamente pelo tenant do usuário
    req.tenantFilter = user.tenantId;
    return next();
  }

  // Papel não reconhecido
  return res.status(403).json({ 
    error: "Papel de usuário não reconhecido." 
  });
}

// Middleware combinado para autenticação + autorização
export function authorize(roles: string[], requireClientScope = false) {
  const middlewares = [isAuthenticated, requireRole(...roles)];
  
  if (requireClientScope) {
    middlewares.push(requireClientAccess);
  }

  return middlewares;
}
