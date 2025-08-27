📋 Plano de Ação – Portal BPO Gquicks

Você é um programador fullstack responsável por finalizar o Portal BPO Gquicks no Replit.
Use este documento como guia passo a passo.
Não pule etapas. Execute cada checklist e confirme antes de prosseguir.

🚀 Wave 1 – Core Funcional (Prioridade Máxima)

Objetivo: deixar o sistema utilizável para clientes e operadores.

 Completar RBAC: Admin, Gerente, Operador, Cliente.

 Garantir scoping: operador só vê clientes designados.

 Implementar middleware de autorização por papel e recurso.

 Finalizar fluxos de negócio:

Pago → Conciliação → Arquivado

Agendado → Agendado → Aguardando Recebimento → Conciliação → Arquivado

Boleto → Emissão → ERP Contas a Receber (stub) → Aguardando Recebimento → Conciliação → Arquivado

NF → Emissão → ERP Contas a Receber → (Recebido? sim → Conciliação, não → Aguardando Recebimento) → Arquivado

 Painéis operacionais:

Inbox (melhorar filtros)

Agendados (Hoje, 7 dias, Atrasados)

Conciliação (por banco/cliente)

Arquivados (busca avançada)

 Estados faltantes: A_PAGAR_HOJE, EM_CONCILIACAO, AGUARDANDO_RECEBIMENTO.

 Implementar transições automáticas por data e regras (ex.: Agendado → Aguardando Recebimento).

🔄 Wave 2 – Automação e Relatórios

Objetivo: reduzir esforço manual e garantir visão consolidada.

 Implementar OCR robusto com 16 estratégias (pdftotext, pdf-parse, Tesseract multi-idioma, Ghostscript).

 Adicionar fallback GLM → GPT-4o no pipeline IA.

 Melhorar validação cruzada (OCR x Nome x Metadados).

 Criar exportação estruturada:

CSV com filtros completos

ZIP organizado por cliente/ano/status/banco

manifest.json com metadados

 Implementar relatórios automáticos:

Semanais (toda sexta)

Mensais (até dia 10)

 Criar histórico de exportações e limite de 2GB por export.

 Adicionar KPIs e Analytics:

Taxa de inconsistência (%)

Tempo médio de processamento

% automação (sem intervenção humana)

Backlog por fila

SLA por demanda

Dashboard executivo

🔔 Wave 3 – Integrações e Notificações

Objetivo: conectar o portal ao ecossistema externo.

 Conta Azul (ERP): criar stub para lançar em Contas a Receber.

 Evolution API: preparar integração para notificações WhatsApp (feature flag desligada por padrão).

 Google Sheets: export opcional.

 Webhooks internos: eventos de documento (document.received, document.conciliated).

 Implementar alertas e notificações:

Alertas internos no painel

Alertas de vencimento (2 dias antes)

E-mails automáticos

Notificações WhatsApp via Evolution API

✅ Critérios de Aceite (MVP)

Cliente consegue logar, enviar documentos e acompanhar status.

Operador consegue processar (Inbox, Agendados, Conciliação, Arquivar).

Fluxos de negócio (Pago, Agendado, Boleto, NF) funcionando do início ao fim.

Exportação ZIP/CSV disponível.

Relatórios semanais/mensais gerados.

RBAC garante que cliente não veja documentos de outro cliente.

👉 Instrução final ao agente:
Execute as Waves em ordem.
Somente avance para a próxima quando todos os itens da anterior estiverem concluídos e testados.
Documente o que foi feito e o que ficou pendente ao final de cada Wave.