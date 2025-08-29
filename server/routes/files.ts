import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { createFileStorage } from "../storage/local-storage";
import path from "path";

const fileStorage = createFileStorage();

/**
 * Endpoints para servir arquivos via storage interface
 * Pronto para migração para S3 quando necessário
 */
export function registerFileRoutes(app: Express) {
  // Endpoint para servir arquivos com autenticação
  app.get("/api/files/*", isAuthenticated, async (req, res) => {
    try {
      const user = req.user!;
      const filePath = (req.params as any)[0]; // Captura tudo após /api/files/
      
      if (!filePath) {
        return res.status(400).json({ error: "Caminho do arquivo não especificado" });
      }

      // Verificar se arquivo existe
      const exists = await fileStorage.exists(filePath);
      if (!exists) {
        return res.status(404).json({ error: "Arquivo não encontrado" });
      }

      // TODO: Verificar se usuário tem permissão para acessar o arquivo
      // Implementar verificação de tenant/scoping quando necessário

      try {
        const fileBuffer = await fileStorage.download(filePath);
        
        // Detectar tipo de conteúdo baseado na extensão
        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';
        
        switch (ext) {
          case '.pdf':
            contentType = 'application/pdf';
            break;
          case '.jpg':
          case '.jpeg':
            contentType = 'image/jpeg';
            break;
          case '.png':
            contentType = 'image/png';
            break;
          case '.gif':
            contentType = 'image/gif';
            break;
          case '.webp':
            contentType = 'image/webp';
            break;
        }

        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache por 1 hora
        res.send(fileBuffer);
      } catch (error) {
        console.error(`Erro ao servir arquivo ${filePath}:`, error);
        res.status(500).json({ error: "Erro ao carregar arquivo" });
      }
    } catch (error) {
      console.error("Erro no endpoint de arquivos:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

  // Endpoint para verificar se arquivo existe
  app.head("/api/files/*", isAuthenticated, async (req, res) => {
    try {
      const filePath = (req.params as any)[0];
      
      if (!filePath) {
        return res.status(400).end();
      }

      const exists = await fileStorage.exists(filePath);
      if (exists) {
        res.status(200).end();
      } else {
        res.status(404).end();
      }
    } catch (error) {
      res.status(500).end();
    }
  });
}