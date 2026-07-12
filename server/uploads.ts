import express, { type Express } from "express";
import fs from "node:fs";
import path from "node:path";
import multer from "multer";
import { nanoid } from "nanoid";

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const ASSET_UPLOADS_DIR = path.join(UPLOADS_DIR, "assets");
const CONTRACT_UPLOADS_DIR = path.join(UPLOADS_DIR, "contracts");

fs.mkdirSync(ASSET_UPLOADS_DIR, { recursive: true });
fs.mkdirSync(CONTRACT_UPLOADS_DIR, { recursive: true });

const imageMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const contractMimeTypes = new Set([
  "application/pdf",
  ...imageMimeTypes,
]);

function buildFileName(originalName: string): string {
  const extension = path.extname(originalName).toLowerCase();
  return `${Date.now()}-${nanoid(8)}${extension}`;
}

const assetPhotoStorage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, ASSET_UPLOADS_DIR);
  },
  filename: (_request, file, callback) => {
    callback(null, buildFileName(file.originalname));
  },
});

const contractFileStorage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, CONTRACT_UPLOADS_DIR);
  },
  filename: (_request, file, callback) => {
    callback(null, buildFileName(file.originalname));
  },
});

/**
 * Cargador de fotos. La ruta debe usar `.array("photos", 10)`.
 */
export const assetPhotoUpload = multer({
  storage: assetPhotoStorage,
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 10,
  },
  fileFilter: (_request, file, callback) => {
    if (file.fieldname !== "photos") {
      callback(new Error('El campo de las fotos debe llamarse "photos".'));
      return;
    }

    if (!imageMimeTypes.has(file.mimetype.toLowerCase())) {
      callback(
        new Error("Solo se permiten imágenes JPEG, PNG, WEBP o GIF.")
      );
      return;
    }

    callback(null, true);
  },
});

/**
 * Cargador de contratos. La ruta debe usar `.single("file")`.
 */
export const contractFileUpload = multer({
  storage: contractFileStorage,
  limits: {
    fileSize: 15 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_request, file, callback) => {
    if (file.fieldname !== "file") {
      callback(new Error('El campo del contrato debe llamarse "file".'));
      return;
    }

    if (!contractMimeTypes.has(file.mimetype.toLowerCase())) {
      callback(
        new Error("Solo se permiten archivos PDF o imágenes de contrato.")
      );
      return;
    }

    callback(null, true);
  },
});

/**
 * Publica el directorio de archivos bajo `/uploads`.
 */
export function mountUploads(app: Express): void {
  app.use(
    "/uploads",
    express.static(UPLOADS_DIR, {
      maxAge: "7d",
    })
  );
}

/**
 * Elimina un archivo relativo a uploads, rechazando recorridos de directorio.
 */
export function deleteUploadedFile(relPath: string): void {
  if (!relPath || typeof relPath !== "string") {
    return;
  }

  const resolvedPath = path.resolve(UPLOADS_DIR, relPath);
  const uploadsPrefix = `${UPLOADS_DIR}${path.sep}`;

  if (
    resolvedPath === UPLOADS_DIR ||
    !resolvedPath.startsWith(uploadsPrefix)
  ) {
    return;
  }

  try {
    fs.unlinkSync(resolvedPath);
  } catch {
    // El archivo puede no existir o ya haber sido eliminado.
  }
}