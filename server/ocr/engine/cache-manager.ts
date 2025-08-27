import { OcrResult } from '../interfaces';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export class OcrCacheManager {
  private cacheDir: string;
  private ttlMs: number; // Time to live in milliseconds

  constructor(cacheDir: string = './ocr-cache', ttlMs: number = 24 * 60 * 60 * 1000) {
    this.cacheDir = cacheDir;
    this.ttlMs = ttlMs;
    this.ensureCacheDir();
  }

  private ensureCacheDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getFileHash(filePath: string): string {
    try {
      const stats = fs.statSync(filePath);
      const data = `${filePath}-${stats.size}-${stats.mtime.getTime()}`;
      return crypto.createHash('md5').update(data).digest('hex');
    } catch (error) {
      // Se não conseguir calcular hash do arquivo, usar apenas o caminho
      return crypto.createHash('md5').update(filePath).digest('hex');
    }
  }

  private getCacheKey(filePath: string, strategyName: string): string {
    const fileHash = this.getFileHash(filePath);
    return `${fileHash}-${strategyName}`;
  }

  private getCachePath(cacheKey: string): string {
    return path.join(this.cacheDir, `${cacheKey}.json`);
  }

  async get(filePath: string, strategyName: string): Promise<OcrResult | null> {
    try {
      const cacheKey = this.getCacheKey(filePath, strategyName);
      const cachePath = this.getCachePath(cacheKey);

      if (!fs.existsSync(cachePath)) {
        return null;
      }

      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
      const now = Date.now();

      // Verificar se o cache não expirou
      if (now - cacheData.timestamp > this.ttlMs) {
        this.delete(filePath, strategyName);
        return null;
      }

      console.log(`📦 Cache HIT: ${strategyName} para ${path.basename(filePath)}`);
      
      // Adicionar informação de cache no metadata
      const result: OcrResult = {
        ...cacheData.result,
        metadata: {
          ...cacheData.result.metadata,
          fromCache: true,
          cacheTimestamp: cacheData.timestamp
        }
      };

      return result;
    } catch (error) {
      console.error('Erro ao ler cache:', error);
      return null;
    }
  }

  async set(filePath: string, strategyName: string, result: OcrResult): Promise<void> {
    try {
      // Só cachear resultados bem-sucedidos
      if (result.confidence === 0 || result.characterCount === 0) {
        return;
      }

      const cacheKey = this.getCacheKey(filePath, strategyName);
      const cachePath = this.getCachePath(cacheKey);

      const cacheData = {
        timestamp: Date.now(),
        result,
        filePath: path.basename(filePath),
        strategyName
      };

      fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
      
      console.log(`💾 Cache SAVE: ${strategyName} para ${path.basename(filePath)}`);
    } catch (error) {
      console.error('Erro ao salvar cache:', error);
    }
  }

  delete(filePath: string, strategyName: string): void {
    try {
      const cacheKey = this.getCacheKey(filePath, strategyName);
      const cachePath = this.getCachePath(cacheKey);

      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
      }
    } catch (error) {
      console.error('Erro ao deletar cache:', error);
    }
  }

  clearExpired(): number {
    let clearedCount = 0;
    
    try {
      const files = fs.readdirSync(this.cacheDir);
      const now = Date.now();

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        try {
          const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          
          if (now - cacheData.timestamp > this.ttlMs) {
            fs.unlinkSync(filePath);
            clearedCount++;
          }
        } catch (error) {
          // Arquivo corrompido, deletar
          fs.unlinkSync(filePath);
          clearedCount++;
        }
      }

      if (clearedCount > 0) {
        console.log(`🧹 Cache limpo: ${clearedCount} arquivos expirados removidos`);
      }
    } catch (error) {
      console.error('Erro ao limpar cache expirado:', error);
    }

    return clearedCount;
  }

  getCacheStats(): {
    totalFiles: number;
    totalSizeMB: number;
    oldestFile?: Date;
    newestFile?: Date;
  } {
    const stats = {
      totalFiles: 0,
      totalSizeMB: 0,
      oldestFile: undefined as Date | undefined,
      newestFile: undefined as Date | undefined
    };

    try {
      const files = fs.readdirSync(this.cacheDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(this.cacheDir, file);
        const fileStats = fs.statSync(filePath);
        
        stats.totalFiles++;
        stats.totalSizeMB += fileStats.size / (1024 * 1024);
        
        if (!stats.oldestFile || fileStats.mtime < stats.oldestFile) {
          stats.oldestFile = fileStats.mtime;
        }
        
        if (!stats.newestFile || fileStats.mtime > stats.newestFile) {
          stats.newestFile = fileStats.mtime;
        }
      }

      stats.totalSizeMB = Math.round(stats.totalSizeMB * 100) / 100;
    } catch (error) {
      console.error('Erro ao obter estatísticas do cache:', error);
    }

    return stats;
  }
}