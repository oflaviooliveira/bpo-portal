# Portal BPO Financeiro - Gquicks

## Visão Geral
Portal de BPO Financeiro com OCR/IA multi-provider para processamento automático de documentos e fluxos operacionais.

## Identidade Visual
- **Cor Primária**: #E40064 (Magenta Gquicks)
- **Cor Secundária**: #0B0E30 (Azul Índigo)
- **Cor de Apoio**: #FFFFFF (Branco)
- **Tipografia**: Poppins (interface), Gilroy (títulos/logo)

## Stack Tecnológica
- **Frontend**: Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes
- **Banco**: PostgreSQL + Drizzle ORM
- **Storage**: Sistema de arquivos local (desenvolvimento)
- **OCR/IA**: Tesseract.js + GPT/GLM (multi-provider)

## Funcionalidades Principais
1. **Multi-tenant**: Isolamento por cliente
2. **RBAC**: Admin, Gerente, Operador, Cliente
3. **Upload de Documentos**: PDF/JPG/PNG até 10MB
4. **OCR + IA**: Extração automática de dados
5. **Classificação**: Pago, Agendado, Boleto, NF
6. **Fluxos Operacionais**: Inbox, Conciliação, Agendamento, Emissão
7. **Exportação**: ZIP/CSV organizados

## Estados dos Documentos
- RECEBIDO → VALIDANDO → PENDENTE_REVISAO (se inconsistente)
- PAGO_A_CONCILIAR → EM_CONCILIACAO → ARQUIVADO
- AGENDAR → AGENDADO → AGUARDANDO_RECEBIMENTO → ARQUIVADO
- EMITIR_BOLETO/NF → processamento → ARQUIVADO

## Preferências do Usuário
- Linguagem: Português Brasileiro
- Estilo: Profissional, moderno, focado em eficiência
- Interface: Limpa, com cores da identidade Gquicks

## Arquitetura do Projeto
```
/
├── shared/
│   └── schema.ts          # Schemas Drizzle + Zod
├── server/
│   ├── storage.ts         # Interface de storage
│   └── routes.ts          # API routes
├── client/src/
│   ├── App.tsx            # Router principal
│   ├── pages/             # Páginas da aplicação
│   ├── components/        # Componentes reutilizáveis
│   └── lib/               # Utilities e configurações
└── package.json
```

## Status Atual
Projeto iniciado - implementando estrutura base com identidade visual Gquicks.

## Próximos Passos
1. Configurar estrutura base do projeto
2. Implementar sistema de autenticação multi-tenant
3. Criar interfaces de upload e processamento
4. Implementar OCR/IA pipeline
5. Desenvolver painéis operacionais