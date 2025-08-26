# PRD Inicial – Portal BPO + OCR (v2)

---

## 🎯 Objetivo
Desenvolver um **Portal de Clientes** para BPO Financeiro que centralize o envio, leitura, classificação e processamento de documentos financeiros (PDFs, imagens), integrando OCR robusto + IA multi-provider, com fluxo de conciliação, agendamento, emissão de boletos e notas fiscais.

---

## 📌 Escopo do Sistema
1. **Área do Cliente (multi-tenant)**
   - Login e senha individuais.
   - Configuração por cliente: categorias, centros de custo, bancos.
   - Upload de documentos (PDF/JPG/PNG até 10MB).
   - Seleção de metadados (Banco, Categoria, Centro de Custo, Tipo de Solicitação).

2. **OCR + IA**
   - OCR robusto com 16 estratégias (pdftotext, pdf-parse, Tesseract.js, Ghostscript, etc.).
   - IA multi-provider: GLM-4-Plus (primário), GPT-4o (fallback).
   - Extração estruturada em JSON padronizado.
   - Validação cruzada: OCR ↔ Nome do arquivo ↔ Metadados.

3. **Classificação Automática**
   - **Pago** → Gera tarefa de conciliação.
   - **Agendado** → Gera tarefa de agendamento; migra para conciliação no vencimento.
   - **Emitir Boleto** → Gera tarefa de emissão de boleto.
   - **Emitir NF** → Gera tarefa de emissão de nota fiscal.

4. **Fluxo de Processamento**
   - Upload → OCR/IA → Validação cruzada.
   - Se consistente → segue fluxo automático.
   - Se inconsistente → vai para **Fila de Revisão**.
   - Finalização: documentos arquivados com histórico.

5. **Painéis Operacionais**
   - Inbox (novos uploads, pendentes de validação).
   - Agendados (com filtros: Hoje, Próximos 7 dias, Atrasados).
   - Conciliação (por banco/cliente, com filtros e KPIs).
   - Emissão Boleto/NF (checklists específicos).
   - Arquivados (pesquisável por cliente, banco, categoria, período).

6. **Perfis e Permissões (RBAC)**
   - **Administrador:** CRUD completo (clientes, usuários, categorias, bancos, centros de custo).
   - **Gerente de Operações:** gerencia filas, distribui tarefas, aprova exceções.
   - **Operador:** executa tarefas nos clientes designados.

---

## 📊 Estados dos Documentos
- RECEBIDO → após upload.
- VALIDANDO → OCR + IA em execução.
- PENDENTE_REVISAO → inconsistência detectada.
- PAGO_A_CONCILIAR → detectado como pago.
- AGENDADO → aguardando data de vencimento.
- A_PAGAR_HOJE → subestado de AGENDADO.
- EM_CONCILIACAO → operador executando conferência.
- ARQUIVADO → finalizado.

---

## 🔑 Regras de Validação
- Datas sempre no formato DD/MM/AAAA.
- Valores no padrão R$ X,XX.
- Categorias/centros de custo devem existir no cadastro do cliente.
- Nome do arquivo suportando formatos pipe, underscore e híbrido.
- Prioridade de validação: Nome do arquivo > OCR > escolha do usuário.
- **Toda divergência deve ser reportada ao cliente/operador/admin no momento do envio.**

---

## ⚙️ Integrações
- **OCR/IA:** GLM + GPT-4o, fallback automático.
- **ERP (Conta Azul):** conciliação e consulta.
- **Planilhas (Google Sheets):** export opcional (Dados Corretos vs Revisão).
- **Evolution API:** infraestrutura para notificações (WhatsApp, SMS, etc.). Inicialmente desativada, mas já implementada para uso futuro.
- **Webhooks internos:** eventos para automação (document.received, document.scheduled, etc.).

---

## 📂 Retenção & Exportação
- Documentos permanecem no portal até serem **explicitamente excluídos** por cliente ou administrador.
- Todos os perfis (Cliente, Operador, Admin) devem poder **baixar documentos em lote**, de forma organizada:
  - **CSV** com dados estruturados.
  - **ZIP** com documentos originais + JSON de processamento.
- Função de exportação disponível no painel de Arquivados.

---

## 📈 KPIs e Métricas
- Taxa de inconsistência (%).
- Tempo médio de processamento por documento.
- % de automação (sem intervenção humana).
- Backlog por fila.
- SLA por demanda (conciliação, agendamento, emissão).

---

## ✅ Decisões Tomadas
- Lista inicial de categorias/centros de custo será padrão, mas cada cliente mantém seu cadastro próprio com CRUD.
- Não haverá suporte a CNAB/convênio de bancos nesta fase.
- Divergências **sempre devem gerar alerta** (sem tolerância).
- Evolution API será integrada já no MVP para suportar futuras notificações.
- Documentos ficam armazenados indefinidamente até exclusão manual.
- Exportação em lote (CSV/ZIP) obrigatória desde o início.

---

👉 Esta versão atualizada reflete as respostas e preferências definidas. Está pronta para análise antes do detalhamento técnico de endpoints e fases de implementação.



---

## 🔐 Stack & Segurança (Next.js)
- **Frontend:** Next.js (App Router), TypeScript, Tailwind/shadcn.
- **Backend (API routes):** Next.js + Express adapter opcional para rotas /api.
- **Autenticação:** login/senha por usuário; suporte futuro a OAuth; hashing (Argon2/Bcrypt).
- **Multi-tenant:** isolamento lógico por `tenant_id`; scoping em todas as queries; middleware de autorização por papel (RBAC) e escopo de clientes.
- **Banco de Dados:** PostgreSQL (schema seguro, RLS opcional); logs de auditoria (quem/quando/o quê).
- **Storage de Arquivos:** bucket privado por tenant; URLs assinadas; antivírus opcional; versionamento de metadados.
- **LGPD:** minimização de dados; consentimento; direito de exclusão.

---

## 📦 Retenção & Exportação
- **Retenção:** documentos permanecem no portal **até serem excluídos** pelo cliente/admin.
- **Exportação/Download:** Cliente/Operador/Admin podem **baixar todos os documentos** de forma organizada por período, status, banco, categoria e centro de custo.
  - Formatos: **ZIP** (arquivos + JSON) e **CSV** agregado.
  - Estrutura de pastas sugerida no ZIP: `cliente/ano-mes/status/banco/` com `manifest.json` contendo metadados (hash, datas, categorias, CC, status, proveniência OCR/IA).
  - Suporte a **exportações programadas** (ex.: mensal) e **ad-hoc**.

---

## ✅ Decisões Registradas
- Categorias/CC: lista inicial padrão + **cadastro por cliente** (CRUD completo).
- Bancos: **sem campos CNAB/convênios no MVP**; apenas seleção do banco.
- Divergências: **qualquer erro** gera inconsistência e bloqueia avanço automático.
- Notificações: **Evolution API preparada** (desativada no MVP), ativável por feature flag.
- Retenção: até exclusão; exportação em ZIP/CSV disponível desde o MVP.

---

## ❓ Pendências Menores (se aplicável)
- Texto padrão dos avisos de inconsistência ao cliente (quando habilitarmos notificações).
- Limites de tamanho para exportação (ex.: 2GB por pacote) e paginação de downloads.
- Política de versionamento de documentos (substituição vs nova versão).



---

## 🔄 Fluxo Detalhado

### 📌 Perspectiva do Cliente
1. **Login no Portal** → acessa com usuário/senha.
2. **Seleção de Contexto** → cliente e banco (multi-tenant definido).
3. **Upload de Documento** → PDF/JPG/PNG até 10MB.
   - Preenche metadados obrigatórios: Categoria, Centro de Custo, Tipo de Solicitação (Pago, Agendado, Emitir Boleto, Emitir NF).
4. **Validação Automática (OCR + IA)** ocorre em segundo plano.
5. **Feedback Imediato:**
   - Se OK → documento segue fluxo e aparece classificado.
   - Se inconsistência → aparece na aba “Pendentes de Revisão”.
6. **Acompanhamento:**
   - Cliente visualiza status do documento: Recebido, Validando, Pendente de Revisão, Agendado, Pago a Conciliar, Em Conciliação, Arquivado.
   - Pode baixar/exportar seus documentos a qualquer momento (ZIP/CSV).

### 📌 Perspectiva do Operador
1. **Login no Portal Operacional** → perfil Operador ou Gerente.
2. **Inbox de Documentos** → documentos recém-enviados ou pendentes de revisão.
3. **Fila de Trabalho:**
   - **Pendentes de Revisão:** checa inconsistências, corrige ou devolve ao cliente.
   - **Agendados:** acompanha por vencimento (Hoje, 7 dias, Atrasados).
   - **Conciliação:** confere documentos marcados como pagos, valida com ERP/banco.
   - **Emissão de Boleto/NF:** segue checklist específico (valores, dados obrigatórios).
4. **Ações Operacionais:**
   - Validar, corrigir metadados, atribuir categoria/CC, confirmar conciliação.
   - Marcar divergência (volta ao cliente) ou concluir (segue fluxo → Arquivo).
5. **Arquivamento:** documento conciliado/emissão concluída vai para histórico arquivado.
6. **Exportação:** operador/admin pode exportar lote de documentos (por cliente, banco, período, status) em ZIP/CSV.

### 📌 Interações-Chave
- Cliente envia → OCR/IA processa → Operador revisa/confirma → Documento conciliado ou agendado → Arquivado.
- Divergências sempre geram **pendência** antes de avançar.
- Evolution API (futuro) pode notificar cliente em eventos críticos (pendência, vencimento próximo).



---

## 🔄 Comparativo de Fluxo – Atual (Google Drive + SLA) vs Futuro (Portal + OCR/IA)

### 📌 Como Funciona Hoje (Drive + SLA)
1. **Cliente** envia documentos na pasta *1-Recepção* (Drive).
   - Deve renomear conforme padrão: `[Data] [Status PG/AGD] [Descrição] [Categoria] [CC] [Valor]`.
   - Separação manual por banco.
2. **Operador** acessa a pasta.
   - Move arquivos para *Provisionados*.
   - Faz agendamento e depois move para *Agendados*.
   - Após pagamento/validação, move para *Arquivados*.
3. **Organização**:
   - Estrutura de pastas replicada por cliente (Eco Express, Decargo, etc.).
   - Subpastas mensais dentro de cada banco.
4. **SLA**:
   - Documento enviado até 2 dias antes do vencimento.
   - Processamento em até 1 dia útil.
   - Relatórios semanais (sexta) e mensais (até dia 10).
   - Emissão de boletos/NFs por solicitação via Drive.

### 📌 Como Vai Funcionar no Portal (OCR + IA + Painéis)
1. **Cliente** acessa o Portal.
   - Upload direto (PDF/JPG/PNG até 10MB).
   - Preenche metadados: Banco, Categoria, Centro de Custo, Tipo (Pago/Agendado/Boleto/NF).
   - Sistema aplica OCR + IA automaticamente (sem depender do padrão manual de nomes).
2. **Validação Automática**
   - IA cruza OCR ↔ Nome do arquivo ↔ Metadados.
   - Divergências geram **pendências** antes de seguir.
3. **Operador** atua via painéis:
   - **Inbox**: novos uploads ou inconsistências.
   - **Provisionados**: documentos aguardando processamento.
   - **Agendados**: visão por data (Hoje, 7 dias, Atrasados).
   - **Conciliação**: documentos pagos a validar.
   - **Emissão Boleto/NF**: com checklist dedicado.
   - **Arquivados**: histórico pesquisável, filtros e exportação ZIP/CSV.
4. **Automação**:
   - Workflow automático substitui movimentação manual de pastas.
   - SLA refletido em regras de sistema: bloqueio de atrasados, prazos de processamento, lembretes.
5. **Relatórios**:
   - Semanais e mensais gerados automaticamente a partir dos dados do sistema.
   - Exportação estruturada em CSV/ZIP.
6. **Notificações (futuro)**:
   - Evolution API (WhatsApp/Email) preparada para alertas de pendência, vencimentos e confirmações.

### ✅ Ganhos com o Portal
- Elimina renomeação manual e movimentação de arquivos.
- Controle centralizado por painéis (não dependente da navegação em pastas).
- Automação garante cumprimento do SLA (prazos, conciliações, relatórios).
- Exportação e arquivamento organizados sem esforço manual.
- Possibilidade de notificações automáticas no futuro.



---

## 🔄 Fluxograma Visual – Atual vs Futuro

```mermaid
flowchart TB
  subgraph A[Fluxo Atual – Google Drive + SLA]
    A1[Cliente envia documento na pasta Recepção] --> A2[Renomeia manualmente conforme padrão]
    A2 --> A3[Operador acessa pasta]
    A3 --> A4[Move para Provisionados]
    A4 --> A5[Agendamento manual]
    A5 --> A6[Move para Agendados]
    A6 --> A7[Após pagamento, operador move para Arquivados]
    A7 --> A8[Relatórios semanais/mensais gerados manualmente]
  end

  subgraph B[Fluxo Futuro – Portal + OCR/IA]
    B1[Cliente acessa Portal e faz upload + metadados] --> B2[OCR + IA extraem e validam]
    B2 --> B3{Validação cruzada OK?}
    B3 -->|Não| B4[Pendência de Revisão]
    B3 -->|Sim| B5[Classificação automática: Pago, Agendado, Boleto, NF]
    B5 --> B6[Painéis do Operador: Inbox, Agendados, Conciliação, Emissão]
    B6 --> B7[Fluxo automatizado: conciliação/agendamento]
    B7 --> B8[Arquivamento automático + histórico pesquisável]
    B8 --> B9[Relatórios automáticos semanais/mensais]
  end

  A -.-> B
```

---

Este fluxograma mostra **lado a lado** o processo atual baseado em Google Drive e o processo futuro dentro do Portal, com OCR + IA + painéis automatizados.



---

## 🧩 Regras de Classificação e Fluxos Específicos

### 📌 Definição de Classificação (pelo Cliente)
- **Pago (PG):** cliente indica documento já quitado.
- **Agendado (AGD):** cliente indica documento que precisa ser programado para pagamento.
- **Emitir Boleto:** cliente solicita geração de boleto.
- **Emitir NF:** cliente solicita emissão de nota fiscal.

### 📌 Fluxos Detalhados

#### 🔹 Pago (PG)
1. Cliente envia documento marcado como **Pago**.
2. Sistema valida OCR/IA + metadados.
3. Documento segue para **Conciliação**.
4. Operador confirma no ERP/banco.
5. Documento é **Arquivado**.

#### 🔹 Agendado (AGD)
1. Cliente envia documento marcado como **Agendado**.
2. Sistema gera **Tarefa de Agendamento**.
3. Estados possíveis:
   - `Agendar` → tarefa inicial de programação.
   - `Agendado` → confirmado que está agendado.
   - `Aguardando Confirmação de Pagamento` → aguardando compensação.
   - `Conciliar` → após confirmação do pagamento, operador valida no ERP/banco.
   - `Arquivar` → documento finalizado.

#### 🔹 Emitir Boleto
1. Cliente seleciona **Emitir Boleto** e preenche campos obrigatórios:
   - Vencimento, Valor, Tomador (CNPJ/CPF, IE, Endereço, Contato), Instruções.
2. Sistema gera tarefa de emissão.
3. Operador valida dados e emite boleto via sistema financeiro.
4. Documento emitido volta como **Agendado** (aguarda vencimento e pagamento).

#### 🔹 Emitir Nota Fiscal
1. Cliente seleciona **Emitir NF** e preenche campos obrigatórios:
   - Código de serviço, descrição, valor, tomador (CNPJ/CPF, endereço, contato).
2. Sistema gera tarefa de emissão.
3. Operador valida e emite a NF no sistema de gestão.
4. Documento emitido é classificado como **Arquivado** (comprovante anexado).

### 📌 Observações Importantes
- **Cliente decide a classificação inicial** (PG, AGD, Boleto, NF).
- Cada tipo tem **checklists e campos obrigatórios específicos**.
- **Agendado** é o único fluxo com transição múltipla de estados até conciliação.
- **Boletos e NFs** dependem de dados adicionais do cliente.
- **Pago** segue diretamente para conciliação, reduzindo etapas.



---

## 🔄 Fluxos Detalhados (Mermaid)

### 🔹 Agendado (AGD)
```mermaid
flowchart LR
  A[Cliente envia documento marcado como Agendar] --> B[Tarefa de Agendamento criada]
  B --> C[Operador agenda pagamento]
  C --> D[Status = Agendado]
  D --> E{Data de Vencimento atingida?}
  E -->|Sim| F[Status = Aguardando Recebimento]
  F --> G{Pagamento confirmado no banco?}
  G -->|Sim| H[Conciliação]
  H --> I[Arquivado]
  E -->|Não| D
```

### 🔹 Emitir Boleto
```mermaid
flowchart LR
  A[Cliente solicita Emitir Boleto + dados obrigatórios] --> B[Operador emite boleto no sistema financeiro]
  B --> C[Lançamento automático no ERP como Contas a Receber]
  C --> D[Status = Aguardando Recebimento]
  D --> E{Pagamento confirmado no banco?}
  E -->|Sim| F[Conciliação]
  F --> G[Arquivado]
```

### 🔹 Emitir Nota Fiscal
```mermaid
flowchart LR
  A[Cliente solicita Emitir NF + dados obrigatórios] --> B[Operador emite NF no sistema financeiro]
  B --> C[Lançamento automático no ERP como Contas a Receber]
  C --> D{Recebido no ato da emissão?}
  D -->|Sim| E[Conciliação imediata]
  E --> F[Arquivado]
  D -->|Não| G[Status = Aguardando Recebimento]
  G --> H{Pagamento confirmado no banco?}
  H -->|Sim| I[Conciliação]
  I --> J[Arquivado]
```

---

## ✅ Melhorias Aplicadas
- **Estado unificado**: todos os fluxos que aguardam entrada de dinheiro passam por **Aguardando Recebimento**.
- **Automação ERP**: após emissão de Boleto/NF, sistema lança em **Contas a Receber** automaticamente.
- **Check no fluxo NF**: campo “Recebido no ato da emissão?” define se vai direto para conciliação ou aguardar recebimento.
- **Painel único de Aguardando Recebimento**: operadores acompanham tudo que depende de entrada financeira, independente da origem (Agendado, Boleto, NF).



---

## 🗺️ Fluxos Específicos (Mermaid)

### 🔹 Agendado (AGD)
```mermaid
flowchart TB
  A[Cliente envia documento
Tipo=Agendar] --> B[Cria tarefa: Agendamento]
  B --> C[Operador agenda no banco
(registra vencimento)]
  C --> D[Status: Agendado]
  D --> E{Chegou o vencimento?}
  E -- Não --> D
  E -- Sim --> F[Status: Aguardando Recebimento]
  F --> G{Pagamento identificado no extrato?}
  G -- Não --> F
  G -- Sim --> H[Cria tarefa: Conciliação]
  H --> I[Operador concilia no ERP]
  I --> J[Status: Arquivado]
```

### 🔹 Emitir Boleto
```mermaid
flowchart TB
  A[Cliente solicita Emitir Boleto
+ preenche dados obrigatórios] --> B[Operador valida]
  B --> C[Emite Boleto no sistema financeiro]
  C --> D[Lança no ERP: Contas a Receber
(automático quando possível)]
  D --> E[Status: Aguardando Recebimento]
  E --> F{Recebimento confirmado?}
  F -- Não --> E
  F -- Sim --> G[Cria tarefa: Conciliação]
  G --> H[Operador concilia no ERP]
  H --> I[Status: Arquivado]
```

### 🔹 Emitir Nota Fiscal (NF)
```mermaid
flowchart TB
  A[Cliente solicita Emitir NF
+ preenche dados obrigatórios] --> B[Operador valida]
  B --> C[Emite NF no sistema]
  C --> D[Lança no ERP: Contas a Receber
(automático quando possível)]
  D --> E{Recebido no ato da emissão?}
  E -- Sim --> F[Cria tarefa: Conciliação]
  F --> G[Operador concilia no ERP]
  G --> H[Status: Arquivado]
  E -- Não --> I[Status: Aguardando Recebimento]
  I --> J{Pagamento confirmado?}
  J -- Não --> I
  J -- Sim --> F
```

---

## 🧠 Regras Unificadas e Automação
- **Estado comum:** `Aguardando Recebimento` para **AGD**, **Boleto** e **NF**.
- **ERP obrigatório (Boleto/NF):** lançar em **Contas a Receber** imediatamente após emissão (automatizar via integração quando possível).
- **Triggers automáticos:**
  - AGD → muda para *Aguardando Recebimento* na data de vencimento.
  - Boleto/NF → entram em *Aguardando Recebimento* após emissão (se não recebido no ato).
  - Confirmação de pagamento → cria tarefa de **Conciliação**.
- **Validação:** divergências (valor/data/beneficiário) bloqueiam avanço até correção.
- **Auditoria:** registrar usuário, data/hora e origem de cada mudança de status.



---

# ✅ MVP Utilizável – O que construir agora (não-técnico)

> Objetivo: colocar o portal para rodar e **resolver o problema de ponta a ponta** sem depender do Drive, com o mínimo essencial e base pronta para evoluir.

## 1) Telas essenciais
**Área do Cliente**
- **Dashboard**: "O que falta enviar", pendências, próximos vencimentos.
- **Novo Envio**: escolher **Banco** + **Tipo** (Pago, Agendar, Emitir Boleto, Emitir NF) + upload + metadados.
- **Minhas Demandas**: lista com filtros (status, data, banco, categoria, CC).
- **Meus Documentos**: histórico + download/ZIP/CSV.

**Área Operacional**
- **Inbox**: novos envios + inconsistências.
- **Agendados**: Hoje | Próx. 7 dias | Atrasados.
- **Conciliação**: documentos pagos aguardando validação.
- **Emissão**: filas separadas de **Boletos** e **NF** com checklist.
- **Arquivados/Exportar**: histórico pesquisável + export ZIP/CSV.

**Admin**
- **Clientes & Usuários (RBAC)**: acesso por cliente e papel.
- **Cadastros por Cliente**: Bancos, Categorias, Centros de Custo (CRUD).
- **Configurações**: feature flags (Evolution API off), SLA visível.

---

## 2) Formulários (campos mínimos)
**Comuns a todos os tipos**: Banco, Categoria, Centro de Custo, Valor, Competência, Observações, Anexo (PDF/JPG/PNG).

**Pago (PG)**: + Data de Pagamento, Fornecedor/Descrição.

**Agendar (AGD)**: + Data de Vencimento, Favorecido, Linha Digitável/Identificador, Instruções internas.

**Emitir Boleto**: Vencimento, Valor, Tomador (CNPJ/CPF, IE, Endereço, Contato, Email envio), Instruções; *resultado*: **Contas a Receber** + Aguardando Recebimento.

**Emitir NF**: Código de Serviço, Descrição/Itens, Valor(es), Tomador completo (CNPJ/CPF, endereço, contato); *resultado*: **Contas a Receber** (ou Conciliação se recebido no ato).

**Validações**: datas DD/MM/AAAA; valor `R$ X,XX`; categoria/CC devem existir; divergência = pendência.

---

## 3) Estados e transições (MVP)
- `Recebido` → `Validando` (OCR/IA) →
  - **OK**: roteia por tipo
  - **Inconsistência**: `Pendente de Revisão`
- **Pago**: `Pago a Conciliar` → `Em Conciliação` → `Arquivado`
- **Agendar**: `Agendar` → `Agendado` → `Aguardando Recebimento` (na data) → `Conciliação` → `Arquivado`
- **Boleto**: `Emissão` → `Contas a Receber` → `Aguardando Recebimento` → `Conciliação` → `Arquivado`
- **NF**: `Emissão` → `Contas a Receber` (ou `Conciliação` se recebido) → `Arquivado`

---

## 4) Definição de Pronto (DoD) – para ser utilizável
- Cliente consegue **logar**, **enviar** por tipo e **ver pendências**.
- Operador consegue **processar** nas filas e **arquivar**.
- OCR/IA rodando com **validação cruzada** e pendências quando há divergência.
- Export **ZIP/CSV** por filtros e período.
- Admin cadastra **Categorias/CC/Bancos** por cliente e gerencia acessos.
- Logs e auditoria básicos (quem fez o quê e quando).

---

## 5) Roadmap por sprints (curto e objetivo)
- **Sprint 0 – Base**: login, RBAC, multi-tenant, cadastros por cliente, storage seguro.
- **Sprint 1 – Cliente**: Novo Envio (tipos), Dashboard, Minhas Demandas.
- **Sprint 2 – Operação**: Inbox, Agendados, Conciliação, Arquivar.
- **Sprint 3 – Emissões**: Boleto e NF (checklists) + estado **Contas a Receber** (sem integração automática ainda).
- **Sprint 4 – Export & Relatórios**: ZIP/CSV, relatórios semanais/mensais.
- **Sprint 5 – Integrações**: evolução com ERP (criar Contas a Receber automático), Evolution API (off por padrão).

---

## 6) Critérios de Aceite (User Stories)
- **Como Cliente**, vejo o que falta enviar e consigo submeter qualquer tipo com feedback imediado.
- **Como Operador**, zero a caixa de entrada diariamente e acompanho agendados por data.
- **Como Admin**, configuro categorias/CC/bancos por cliente e gerencio acessos.
- **Como Negócio**, obtenho exportações e relatórios que substituem o processo no Drive.

---

## 7) Riscos & Mitigações
- **Erros de OCR** → pendência automática e campo de correção assistida.
- **Dados faltantes em Boleto/NF** → checklists bloqueantes.
- **Sobrecarga de filas** → filtros por data, banco e prioridade + KPIs simples.

---

> Se aprovar, já transformo isso em **tarefas executáveis** para o time (backlog detalhado), mantendo linguagem simples e critérios claros.



---

# 🛠️ Plano Completo de Construção (Replit) – MVP → v1.0

> Objetivo: permitir que um agente no Replit construa o portal **de ponta a ponta**, com o mínimo de dúvidas e erros.

## 0) Visão Geral
- **Stack**: Next.js (App Router) + TypeScript • Drizzle ORM + PostgreSQL (Neon) • Storage (Supabase Storage) • OCR (Tesseract + pdftotext + Ghostscript) • IA (GLM primário, GPT-4o fallback) • Zod • shadcn/ui • Tailwind.
- **Arquitetura**: multi-tenant (cada cliente = tenant) com RBAC (admin/gerente/operador/cliente) e **workflow por estados**.
- **MVP sem notificações** (infra pronta p/ Evolution API) e **sem integração automática ao ERP** (camada preparada).

---

## 1) Replit – Configuração Inicial

### 1.1 Repositório e Monorepo
```
/ (root)
├─ app/ (Next.js)
│  ├─ (site)
│  │  ├─ login/  
│  │  ├─ app/(dashboard e páginas logadas)
│  ├─ api/ (rotas do App Router)
│  ├─ components/, lib/, hooks/, styles/
├─ server/ (serviços puros Node)
│  ├─ ocr/ (pipelines tesseract/pdftotext/ghostscript)
│  ├─ ai/  (providers GLM/OpenAI, prompts)
│  ├─ jobs/ (filas para processamento assíncrono)
│  └─ utils/
├─ db/
│  ├─ schema.ts (Drizzle)
│  ├─ migrations/
├─ scripts/ (seed, fixtures, healthchecks)
├─ replit.nix (dependências do sistema)
├─ .env.example
└─ README.md
```

### 1.2 `replit.nix` (dependências nativas)
```nix
{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.tesseract4
    pkgs.poppler_utils    # pdftotext
    pkgs.ghostscript
    pkgs.imagemagick
    pkgs.zip
  ];
}
```

### 1.3 Variáveis de Ambiente (`.env`)
```
DATABASE_URL=postgresql://user:pass@host/db
STORAGE_URL=https://<supabase-project>.supabase.co
STORAGE_BUCKET=portal-docs
STORAGE_KEY=...  # service role apenas no server

GLM_API_KEY=...
GLM_MODEL=glm-4-plus
GLM_ENABLED=true
GLM_PRIORITY=1

OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o
OPENAI_ENABLED=false
OPENAI_PRIORITY=2

EVOLUTION_API_URL=https://<evolution-api>
EVOLUTION_API_KEY=...
EVOLUTION_ENABLED=false

APP_BASE_URL=https://<replit-url>
NODE_ENV=production
TIMEZONE=America/Sao_Paulo
MAX_FILE_MB=10
```

---

## 2) Banco de Dados (Drizzle + PostgreSQL)

### 2.1 Tabelas Principais (resumo)
- **tenants**(id, nome, slug, created_at)
- **users**(id, email, hash, nome, ativo)
- **user_tenants**(user_id, tenant_id, papel: 'admin'|'gerente'|'operador'|'cliente')
- **banks**(id, tenant_id, nome, apelido)
- **categories**(id, tenant_id, nome, ativo)
- **cost_centers**(id, tenant_id, codigo, nome, ativo)
- **documents**(id, tenant_id, bank_id, uploader_id, tipo: 'PG'|'AGD'|'BOLETO'|'NF',
  filename, mime, size, storage_key, status, valor_centavos, data_competencia, data_pagamento,
  data_vencimento, categoria_id, cost_center_id, fornecedor, observacoes)
- **tasks**(id, tenant_id, document_id, tipo: 'REVISAO'|'AGENDAR'|'CONCILIACAO'|'EMITIR_BOLETO'|'EMITIR_NF',
  status: 'ABERTA'|'EM_ANDAMENTO'|'FECHADA', responsavel_id, prazo, payload_json)
- **events**(id, tenant_id, document_id, tipo, data, meta_json)  # trilha de auditoria
- **ai_runs**(id, tenant_id, document_id, provider, prompt_ver, status, ocr_strategy, tokens_in, tokens_out, custo_usd, saida_json)
- **exports**(id, tenant_id, filtro_json, arquivo_key, status)

> **Status de `documents`**: 'RECEBIDO' | 'VALIDANDO' | 'PENDENTE_REVISAO' | 'PAGO_A_CONCILIAR' | 'AGENDAR' | 'AGENDADO' | 'AGUARDANDO_RECEBIMENTO' | 'EM_CONCILIACAO' | 'ARQUIVADO'.

### 2.2 Seeds Iniciais
- Categorias padrão (Transporte, Combustível, Locação, Manutenção, Seguro, Geral).
- Centros de custo exemplo (SRJ1, SRJ2, SGO1, EGRAL, etc.).

---

## 3) OCR + IA (Pipelines)

### 3.1 Pipeline OCR (prioridades)
1) `pdftotext` → 2) `pdf-parse` → 3) `PDF→PNG + Tesseract por, por+eng` (resoluções 300/150/72dpi) → 4) Ghostscript OCR → 5) *fallback* nome do arquivo.

### 3.2 Abstração de Provedores IA
```ts
interface AIProvider { name: 'GLM'|'OPENAI'; enabled: boolean; priority: 1|2; model: string; maxTokens?: number; temperature?: number; }
```
- Orquestrador escolhe provider por **priority + enabled**; em caso de falha → fallback.
- `SYSTEM_PROMPT` conforme PRD (JSON obrigatório + regras de categorias/CC/datas/valores).

### 3.3 Validação Cruzada
- Comparar **OCR ↔ nome do arquivo ↔ metadados do formulário**.
- Divergência → `PENDENTE_REVISAO` + cria `task: REVISAO`.

---

## 4) API (Next.js App Router – `/app/api/*`)

### 4.1 Autenticação
- `/api/auth/login` (POST) – e-mail/senha; retorna sessão JWT (httpOnly) + scoping por tenant.
- `/api/auth/me` (GET) – perfil, papéis e tenants.

### 4.2 Cadastros (admin/gerente)
- `/api/tenants/:tenantId/banks` (CRUD)
- `/api/tenants/:tenantId/categories` (CRUD)
- `/api/tenants/:tenantId/cost-centers` (CRUD)
- `/api/tenants/:tenantId/users` (gerir papéis e escopo)

### 4.3 Documentos
- `/api/documents` (POST multipart)
  - campos: bankId, tipo(PG|AGD|BOLETO|NF), categoriaId, costCenterId, valor, datas...
  - valida **tamanho** e **mime**; salva no **Storage**; cria `documents` em `RECEBIDO`.
  - enfileira **job** `processDocument`.
- `/api/documents` (GET) – filtros por status, período, banco, categoria, CC.
- `/api/documents/:id` (GET)
- `/api/documents/:id/actions` (POST) – transições (ex.: confirmar agendamento, marcar recebido, iniciar conciliação, arquivar).

### 4.4 Tarefas
- `/api/tasks` (GET) – Inbox, Agendar, Conciliação, Emissões; filtros por responsável, vencimento.
- `/api/tasks/:id` (PATCH) – mudar status, atribuir responsável, anexar notas.

### 4.5 Exportações
- `/api/exports` (POST) – cria export (filtro_json); job gera ZIP/CSV + manifest.
- `/api/exports/:id` (GET)` – status + URL assinada.

### 4.6 Webhooks internos (futuro)
- `/api/hooks/payment-confirmed` – confirmar recebimento (integração ERP/banco).
- `/api/hooks/evolution` – inbound notificações.

---

## 5) Jobs & Filas (processamento)
- **`processDocument`**: baixa do Storage → OCR → IA → validação cruzada → atualiza `documents.status` e cria `tasks` conforme tipo (PG/AGD/BOLETO/NF).
- **`exportDocuments`**: consulta por filtro → monta estrutura de pastas → gera ZIP + CSV + `manifest.json` → envia ao Storage → atualiza `exports`.
- **`scheduleTick`** (cron a cada hora):
  - `AGENDADO` com `data_vencimento == hoje` → `AGUARDANDO_RECEBIMENTO`.

> Lib sugerida para jobs: `bullmq` (Redis). Em Replit, usar Redis hospedado (Upstash). Como alternativa simples para MVP, fila em banco (tabela `jobs`) com worker periódico.

---

## 6) Frontend – Telas e Fluxos

### 6.1 Área do Cliente
- **Login** (tema Azul #0C0E30 / CTA Rosa #FF0066)
- **Dashboard**: cards (Pendentes, Agendados, Aguard. Receb., Conciliação, Arquivados)
- **Novo Envio** (wizard):
  1) Selecionar **Banco** e **Tipo** (PG/AGD/BOLETO/NF)
  2) **Formulário** por tipo (validado com Zod + máscaras)
  3) **Upload** (barra de progresso, limite 10MB)
  4) **Resumo** → Enviar
- **Minhas Demandas**: tabela com filtros; status chips por cor
- **Meus Documentos**: histórico + download; botão **Exportar** (abre modal de filtros)

### 6.2 Área Operacional
- **Inbox**: pendências de revisão e recém-enviados
- **Agendados**: Hoje, Próx. 7 dias, Atrasados (filtros por banco/cliente)
- **Conciliação**: lista de PG a validar; ação “Conferir & Aprovar”
- **Emissão**: filas separadas **Boleto** e **NF** (checklists bloqueantes)
- **Arquivados**: busca avançada

### 6.3 Admin
- **Clientes & Usuários**: RBAC + escopos
- **Cadastros por Cliente**: Bancos, Categorias, Centros de Custo
- **Configurações**: flags de integração (ERP, Evolution API)

---

## 7) Validações & Regras (Zod)
- Datas `DD/MM/AAAA`; Valor `R$ X,XX` (converter para centavos no backend).
- Categoria/CC devem existir para o tenant.
- Divergência (OCR x nome x metadados) → bloqueia e cria **Pendência**.
- Upload: PDF/JPG/PNG até `MAX_FILE_MB`.

---

## 8) Segurança
- Sessões **httpOnly**; CSRF em POSTs.
- Hash de senha (Argon2).
- Escopo por **tenant_id** em todas as queries.
- Storage com **URLs assinadas**; nunca expor `service role` no frontend.
- Logs de auditoria na tabela `events` (quem/quando/o quê).
- LGPD: direito de exclusão; política de retenção = até exclusão manual.

---

## 9) Observabilidade & Métricas
- Métricas por `ai_runs` e `events` (tempo OCR, provider, custo, taxa de inconsistência).
- Healthchecks: `/api/health` (db, storage, ocr binaries).

---

## 10) Testes & Dados de Exemplo
- **Fixtures**: 20 PDFs/imagens com nomes no padrão + metadados variados.
- **Cenários**: PG correto, AGD com data futura, Boleto com dados incompletos, NF recebida no ato, divergência de valor/data.
- **Critérios de aceite** (MVP):
  - Cliente envia e acompanha status.
  - Operador zera **Inbox** e confirma conciliações.
  - Export ZIP/CSV funcionando com filtros.
  - Seeds e cadastros por cliente ok.

---

## 11) Roadmap de Implementação (tarefas executáveis)

### Sprint 0 – Base & Infra
- [ ] Replit + `replit.nix` com tesseract/pdftotext/ghostscript.
- [ ] Next.js + Tailwind + shadcn; layout e tema Gquicks.
- [ ] Drizzle + Neon; `schema.ts` + migrações + seeds.
- [ ] Autenticação simples + RBAC + multi-tenant middleware.
- [ ] Storage Supabase + upload server-side; URLs assinadas.

### Sprint 1 – Upload & Processamento
- [ ] Rotas `/api/documents` (POST/GET/GET:id) + validações Zod.
- [ ] Worker `processDocument` (OCR + IA + cross-check).
- [ ] Tabela `ai_runs` + métricas.
- [ ] Telas Cliente: **Novo Envio** + **Minhas Demandas**.

### Sprint 2 – Filas Operacionais
- [ ] Inbox, Agendados (Hoje/7d/Atrasados), Conciliação.
- [ ] Transições `/api/documents/:id/actions`.
- [ ] Auditoria `events`.

### Sprint 3 – Emissões
- [ ] Form Boleto + checklist + tarefa `EMITIR_BOLETO`.
- [ ] Form NF + checklist + tarefa `EMITIR_NF`.
- [ ] Estado comum **Aguardando Recebimento**.

### Sprint 4 – Export & Relatórios
- [ ] `/api/exports` + worker `exportDocuments` (ZIP/CSV + manifest).
- [ ] Telas de exportação; Relatório semanal/mensal básico.

### Sprint 5 – Integrações (habilitáveis por flag)
- [ ] Evolution API (notificações) – desativado por padrão.
- [ ] Camada ERP (Conta Azul): criar “Contas a Receber” em emissões (opcional).

---

## 12) Textos de Interface (PT-BR)
- **Status chips**: Recebido • Validando • Pend. Revisão • Agendar • Agendado • Aguard. Recebimento • Pago a Conciliar • Em Conciliação • Arquivado.
- **Ações rápidas**: “Enviar Documento”, “Confirmar Agendamento”, “Marcar Recebido”, “Conciliar”, “Arquivar”, “Exportar”.

---

## 13) Anexos Úteis (código/trechos)

### 13.1 Exemplo – Upload API (resumo)
```ts
export const POST = async (req: NextRequest) => {
  const form = await req.formData();
  // validar campos com Zod, salvar no Storage, criar record em `documents`
  // enfileirar job processDocument(documentId)
  return NextResponse.json({ ok: true, documentId });
}
```

### 13.2 Prompt (trecho) – IA
```
RESPONDA EM JSON VÁLIDO:
{
  "data_competencia": "DD/MM/AAAA",
  "data_pagamento": "DD/MM/AAAA",
  "valor": "R$ X,XX",
  "categoria": "CATEGORIA_PADRONIZADA",
  "descricao": "...",
  "cliente_fornecedor": "...",
  "documento": "...",
  "centro_custo": "...",
  "observacoes": "..."
}
```

---

## 14) Go-live Checklist
- [ ] Usuários criados (admin, gerentes, operadores, clientes piloto).
- [ ] Bancos/categorias/CC cadastrados por cliente.
- [ ] Uploads testados (PDF/JPG/PNG) até 10MB.
- [ ] OCR/IA verificadas com 10 amostras reais.
- [ ] Export ZIP/CSV baixado e conferido.
- [ ] Política de backup do banco + storage documentada.

---

> **Entrega deste plano**: com este roteiro, o agente no Replit consegue iniciar, iterar por sprints e chegar ao MVP funcional com baixo atrito. Qualquer ponto que você queira priorizar (ex.: Emissões antes de Conciliação), me diga que reordeno as tarefas.

