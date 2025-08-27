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
**FASE 1 COMPLETA**: Pipeline automático OCR + IA funcionando
**FASE 2 COMPLETA**: Formulários dinâmicos implementados
**WAVE 1 EM PROGRESSO**: Core funcional com RBAC e painéis operacionais

## Implementações Completadas
✅ **FASE 1 - Pipeline Automático**: 
- Processamento OCR com Tesseract.js em português
- Análise IA com GPT-5 e prompt estruturado 
- Validação cruzada OCR ↔ IA ↔ Metadados
- Transições automáticas de status conforme PRD
- Sistema de tarefas operacionais por tipo

✅ **FASE 2 - Formulários Dinâmicos**:
- Formulários se adaptam ao tipo de documento selecionado
- Validação específica por tipo (PAGO, AGENDADO, EMITIR_BOLETO, EMITIR_NF)
- Campos obrigatórios e opcionais conforme PRD
- Reset automático ao trocar tipo de documento

🔄 **WAVE 1 - Core Funcional (EM PROGRESSO)**:
- ✅ RBAC implementado: Admin, Gerente, Operador, Cliente
- ✅ Middleware de autorização por papel e recurso
- ✅ Estados faltantes adicionados: A_PAGAR_HOJE, EM_CONCILIACAO, AGUARDANDO_RECEBIMENTO
- ✅ Service de transições automáticas de status criado
- ✅ Painéis operacionais aprimorados com stats:
  - Inbox com filtros de prioridade
  - Agendados (Hoje, 7 dias, Atrasados) 
  - Conciliação (por banco/cliente)
  - Arquivados (busca avançada)
- ✅ Endpoints de transição de status manual
- ⏳ Scoping por operador (designação cliente-operador)
- ⏳ Transições automáticas por data funcionais
- ⏳ Interface frontend atualizada para novos endpoints

## Próximos Passos (Finalizar Wave 1)
1. Completar scoping operador-cliente
2. Ativar transições automáticas
3. Atualizar frontend para novos painéis e RBAC
4. Testar fluxos completos conforme PRD