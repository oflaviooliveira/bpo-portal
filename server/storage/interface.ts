/**
 * Interface abstrata para armazenamento de arquivos
 * Permite trocar entre LocalStorage e S3 sem quebrar código
 */

export interface FileMetadata {
  mimeType: string;
  size: number;
  tenantId: string;
  userId: string;
  originalName: string;
}

export interface FileStorage {
  /**
   * Faz upload de um arquivo
   * @param buffer Buffer do arquivo
   * @param key Chave única para o arquivo (path)
   * @param metadata Metadados do arquivo
   * @returns URL ou path do arquivo salvo
   */
  upload(buffer: Buffer, key: string, metadata: FileMetadata): Promise<string>;

  /**
   * Faz download de um arquivo
   * @param key Chave do arquivo
   * @returns Buffer do arquivo
   */
  download(key: string): Promise<Buffer>;

  /**
   * Remove um arquivo
   * @param key Chave do arquivo
   */
  delete(key: string): Promise<void>;

  /**
   * Gera URL para acesso ao arquivo
   * @param key Chave do arquivo
   * @returns URL de acesso
   */
  getUrl(key: string): Promise<string>;

  /**
   * Verifica se arquivo existe
   * @param key Chave do arquivo
   */
  exists(key: string): Promise<boolean>;
}

/**
 * Validação de arquivos uploadados
 */
export class FileValidator {
  private static readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'image/webp'
  ];

  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  /**
   * Valida se arquivo é permitido
   */
  static async validateFile(buffer: Buffer, originalName: string, mimeType: string): Promise<{
    isValid: boolean;
    errors: string[];
    detectedMimeType?: string;
  }> {
    const errors: string[] = [];

    // Validar tamanho
    if (buffer.length > this.MAX_FILE_SIZE) {
      errors.push(`Arquivo muito grande. Máximo: ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Validar MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(mimeType)) {
      errors.push(`Tipo de arquivo não permitido: ${mimeType}`);
    }

    // Validar magic numbers (primeiros bytes do arquivo)
    const detectedType = this.detectFileType(buffer);
    if (detectedType && detectedType !== mimeType) {
      errors.push(`Tipo de arquivo não coincide: declarado ${mimeType}, detectado ${detectedType}`);
    }

    // Validar extensão
    const extension = originalName.toLowerCase().split('.').pop();
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!extension || !allowedExtensions.includes(extension)) {
      errors.push(`Extensão não permitida: ${extension}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      detectedMimeType: detectedType || mimeType
    };
  }

  /**
   * Detecta tipo de arquivo pelos magic numbers
   */
  private static detectFileType(buffer: Buffer): string | null {
    if (buffer.length < 4) return null;

    // PDF
    if (buffer.toString('ascii', 0, 4) === '%PDF') {
      return 'application/pdf';
    }

    // JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'image/jpeg';
    }

    // PNG
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'image/png';
    }

    // GIF
    if (buffer.toString('ascii', 0, 3) === 'GIF') {
      return 'image/gif';
    }

    // WebP
    if (buffer.toString('ascii', 8, 12) === 'WEBP') {
      return 'image/webp';
    }

    return null;
  }
}