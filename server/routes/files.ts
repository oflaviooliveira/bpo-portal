import type { Express } from "express";
import { isAuthenticated } from "../auth";
import { createFileStorage } from "../storage/local-storage";
import path from "path";
import multer from "multer";
import fs from "fs/promises";

const fileStorage = createFileStorage();

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Accept common file types
    const allowedTypes = /\.(pdf|jpg|jpeg|png|gif|webp|txt|doc|docx)$/i;
    if (allowedTypes.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'));
    }
  },
});

/**
 * Endpoints para servir arquivos via storage interface
 * Pronto para migração para S3 quando necessário
 */
export function registerFileRoutes(app: Express) {
  // Endpoint para upload de arquivos
  app.post("/api/file/upload", isAuthenticated, upload.single('file'), async (req, res) => {
    try {
      const user = req.user!;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: "Nenhum arquivo foi enviado" });
      }

      // Generate unique filename
      const timestamp = Date.now();
      const ext = path.extname(file.originalname);
      const filename = `${timestamp}_${Math.random().toString(36).substring(7)}${ext}`;
      const filePath = `uploads/${filename}`;

      try {
        // Read uploaded file
        const fileBuffer = await fs.readFile(file.path);
        
        // Store file using storage interface
        const storedPath = await fileStorage.upload(fileBuffer, filePath, {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          tenantId: user.tenantId || 'default',
          userId: user.id
        });

        // Clean up temporary file
        await fs.unlink(file.path).catch(() => {});

        // Return success response with file info
        res.json({
          success: true,
          fileId: filename,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          path: storedPath,
          message: "Arquivo enviado com sucesso"
        });
      } catch (error) {
        console.error("Erro ao armazenar arquivo:", error);
        // Clean up temporary file on error
        await fs.unlink(file.path).catch(() => {});
        res.status(500).json({ error: "Erro ao armazenar arquivo" });
      }
    } catch (error) {
      console.error("Erro no upload de arquivo:", error);
      res.status(500).json({ error: "Erro interno do servidor" });
    }
  });

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