import fs from 'fs/promises';
import path from 'path';
import { FileStorage, FileMetadata } from './interface';

/**
 * Implementação de armazenamento local
 * Mantém compatibilidade com código atual
 */
export class LocalFileStorage implements FileStorage {
  private readonly baseDir: string;

  constructor(baseDir = './uploads') {
    this.baseDir = baseDir;
  }

  async upload(buffer: Buffer, key: string, metadata: FileMetadata): Promise<string> {
    const fullPath = path.join(this.baseDir, key);
    const dir = path.dirname(fullPath);

    // Garantir que diretório existe
    await fs.mkdir(dir, { recursive: true });

    // Salvar arquivo
    await fs.writeFile(fullPath, buffer);

    return fullPath;
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = path.join(this.baseDir, key);
    return fs.readFile(fullPath);
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.baseDir, key);
    try {
      await fs.unlink(fullPath);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async getUrl(key: string): Promise<string> {
    // Para armazenamento local, retorna o path relativo
    return `/api/files/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = path.join(this.baseDir, key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Factory para criar instância de storage
 * Futuramente pode retornar S3Storage baseado em ENV
 */
export function createFileStorage(): FileStorage {
  // Por enquanto sempre retorna LocalStorage
  // Futuramente: if (process.env.USE_S3) return new S3FileStorage();
  return new LocalFileStorage();
}