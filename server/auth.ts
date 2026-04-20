/**
 * MÓDULO DE AUTENTICACIÓN (MODIFICADO CON JWT)
 *
 * Sistema de autenticación basado en JWT con cookies HTTP-only
 *
 * Características:
 * - JWT con tiempo de expiración de 7 días
 * - Hashing de contraseñas con SHA-256
 * - Middleware para proteger rutas
 * - Endpoints de login/logout/verificación de sesión
 */
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cookieParser from "cookie-parser";

/**
 * Extender tipos de Express para incluir información de usuario en el request
 */
declare global{
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        firstName: string;
        lastName: string;
        role: string;
      };
    }
  }
}

/**
 * Configurar middleware de cookies y JWT
 *
 * VARIABLES DE ENTORNO REQUERIDAS:
 * - JWT_SECRET: Secret para firmar JWTs (requerido en producción)
 * - NODE_ENV: 'development' | 'production'
 */
export function setupAuth(app: Express) {
  const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-in-production";

  if (
    process.env.NODE_ENV === "production" &&
    jwtSecret === "dev-secret-change-in-production"
  ) {
    console.warn(
      "⚠️  WARNING: Usando JWT_SECRET por defecto en producción. Configure JWT_SECRET en variables de entorno."
    );
  }
  
//Middleware para parsear cookies
app.use(cookieParser());

//Middlwware para verificar JWT en cada solicitud (excepto rutas públicas))
app.use((req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies.jwt;
  if (token) {
    try{
      const decoded = jwt.verify(token, jwtSecret) as any;
      req.user =decoded;
    }catch(error){
      //Token inválido o expirado, continuar sin usarlo
      //las ruutas protegidas verifican si req.user existe
    }
  }
  next();
});
} 


/**
 * Middleware de autenticación
 * Protege rutas verificando que el usuario esté autenticado via JWT
 *
 * USO:
 * app.get('/api/protected', isAuthenticated, (req, res) => { ... });
 */
export function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.user && req.user.userId) {
    return next();
  }

  return res.status(401).json({
    message: "Unauthorized",
    error: "Debe iniciar sesión para acceder a este recurso",
  });
}

/**
 * Utilidades de hash para contraseñas con SHA256
 */
export const passwordUtils = {
  /**
   * Crear hash de contraseña usando SHA256
   * @param password - Contraseña en texto plano
   * @returns Hash SHA256 de la contraseña (hexadecimal)
   */
  hash(password: string): string{
    return crypto.createHash("sha256").update(password).digest("hex");
  },

   /**
   * Verificar contraseña contra hash
   * @param password - Contraseña en texto plano
   * @param hash - Hash almacenado en la base de datos
   * @returns true si la contraseña coincide
   */
  verify(password: string, hash: string): boolean {
    const passwordHash = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");
    return passwordHash === hash;
  },
};
/**
 * Utilidades para generar y verificar JWTs
 */
export const jwtUtils = {
  /**
   * Generar JWT para un usuario
   * @param user - Información del usuario
   * @returns JWT firmado con expiración de 7 días
   */
  generateToken(payload: any): string {
    const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-in-production";
    
    //Mapear el payload para incluir solo campos necesarios
    const finalPayload ={
      userId: payload.userId || payload.id,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      role: payload.role,
      //Incluir otros campos si es necesario(SupportMode)
      ...(payload.supportMode && { supportMode: payload.supportMode }),
    };
    return jwt.sign(finalPayload, jwtSecret, { expiresIn: "7d" });
  },
  /**
   * Verificar y decodificar JWT
   * @param token - JWT a verificar
   * @returns Payload decodificado si es válido, null si es inválido
   */
  verifyToken(token: string): any | null {
  const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-in-production";
    try {
      return jwt.verify(token, jwtSecret);
    } catch (error) {
      return null;
    }
  },
};
/**
 * Función para establecer la cookie JWT en la respuesta
 * @param res - Objeto de respuesta Express
 * @param token - JWT a almacenar
 */
export function setJwtCookie(res: Response, token: string) {
  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 *1000, // 7 días
    sameSite: "lax",
    path: "/",
  });
}

/**
 * Función para limpiar la cookie JWT en la respuesta
 * @param res - Objeto de respuesta Express
 */
export function clearJwtCookie(res: Response) {
  res.clearCookie("jwt", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });  
}