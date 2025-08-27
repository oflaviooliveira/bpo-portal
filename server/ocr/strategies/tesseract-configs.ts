import { TesseractConfig } from '../interfaces';

export const TESSERACT_CONFIGS: TesseractConfig[] = [
  {
    name: 'PORTUGUES_PADRAO',
    language: 'por',
    options: {
      tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
      tessedit_ocr_engine_mode: '3' // Default, based on what is available
    },
    description: 'Configuração padrão para português com segmentação automática'
  },
  {
    name: 'AUTO_DETECT',
    language: 'por',
    options: {
      tessedit_pageseg_mode: '3', // Fully automatic page segmentation, but no OSD
      tessedit_ocr_engine_mode: '1' // Neural nets LSTM engine only
    },
    description: 'Detecção automática com engine neural LSTM'
  },
  {
    name: 'BLOCO_UNICO',
    language: 'por',
    options: {
      tessedit_pageseg_mode: '6', // Assume a single uniform block of text
      tessedit_ocr_engine_mode: '3' // Default engine
    },
    description: 'Assume bloco único de texto uniforme'
  },
  {
    name: 'MULTI_IDIOMA',
    language: 'por+eng',
    options: {
      tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
      tessedit_ocr_engine_mode: '2' // Legacy engine only
    },
    description: 'Suporte a português e inglês com engine legado'
  },
  {
    name: 'TEXTO_DENSO',
    language: 'por',
    options: {
      tessedit_pageseg_mode: '2', // Automatic page segmentation, but no OSD, or OCR
      tessedit_ocr_engine_mode: '3' // Default engine
    },
    description: 'Otimizado para texto denso sem detecção de orientação'
  },
  {
    name: 'LINHA_UNICA',
    language: 'por',
    options: {
      tessedit_pageseg_mode: '7', // Treat the image as a single text line
      tessedit_ocr_engine_mode: '2' // Legacy engine for single line
    },
    description: 'Trata imagem como linha única de texto'
  }
];

export function getTesseractConfig(configName: string): TesseractConfig {
  const config = TESSERACT_CONFIGS.find(c => c.name === configName);
  if (!config) {
    throw new Error(`Configuração Tesseract não encontrada: ${configName}`);
  }
  return config;
}

export function getAllTesseractConfigs(): TesseractConfig[] {
  return TESSERACT_CONFIGS;
}