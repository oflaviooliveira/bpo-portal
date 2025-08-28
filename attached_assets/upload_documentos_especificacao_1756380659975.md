# 📤 Upload de Documentos — Especificação Única (para execução)

## 0) Objetivo
Permitir que o cliente **envie um arquivo**, a **IA pré-preencha** os campos, o cliente **revise/complete** e então **processe** o documento, entrando no **fluxo correto (PG/AGD/BOLETO/NF)** com **validação cruzada** pronta.

---

## 1) UX / Layout (ordem na tela)
1) **Header**: título “Upload de Documentos” + subtítulo curto.
2) **Bloco de Upload (drag & drop)**  
   - Formatos aceitos: **PDF, JPG, PNG** (máx. **10MB**)  
   - Ao selecionar arquivo → inicia **Leitura Automática (OCR+IA)**.
3) **Banner de requisitos** (texto curto): formatos, datas DD/MM/AAAA, valores R$ X,XX, dica sobre nome de arquivo.
4) **Formulário de Metadados (auto-preenchido)**  
   - Campos comuns + **campos condicionais** por tipo.  
   - Campos vindos da IA aparecem **pré-preenchidos** com label “⚡ Sugerido pela IA”.  
5) **Barra de ações**: “Cancelar” (volta) | **Processar Documento** (CTA principal).

---

## 2) Fluxo Geral (client-side)
1) Usuário faz **upload** do arquivo.  
2) Sistema roda **OCR + IA** e **pré-preenche** o formulário.  
3) Usuário **revê/edita/completa** os campos.  
4) Clique em **Processar Documento** → validações → **POST /api/documents** → retorna ok e redireciona para **Inbox** (ou detalhe do documento) com status **RECEBIDO**.

---

## 3) Campos do Formulário

### 3.1 Comuns (sempre visíveis)
- **Cliente** (fixo pelo login / tenant)  
- **Tipo de Solicitação (radio)**: **Pago (PG)** | **Agendado (AGD)** | **Emitir Boleto** | **Emitir NF**  
- **Banco** (select com busca — bancos do cliente)  
- **Categoria** (select com busca — categorias do cliente)  
- **Centro de Custo** (select com busca — CC do cliente)  
- **Valor** (input com máscara `R$ X,XX`)  
- **Fornecedor/Descrição** (texto)  
- **Observações** (texto opcional)

### 3.2 Condicionais por Tipo
- **Pago (PG)**: **Data de Pagamento** (DD/MM/AAAA)  
- **Agendado (AGD)**: **Data de Vencimento** (DD/MM/AAAA)  
- **Emitir Boleto**: **Data de Vencimento** + **Tomador** (CNPJ/CPF, Nome/Razão, Endereço, Contato, Email)  
- **Emitir NF**: **Código de Serviço**, **Descrição/Itens**, **Tomador** (CNPJ/CPF, Nome/Razão, Endereço, Contato, Email)

> Campos condicionais **aparecem/ somem dinamicamente** ao trocar o tipo (sem reload).

---

## 4) Pré-preenchimento pela IA
- Assim que o upload termina, chamar **pipeline OCR+IA** (já existente).  
- **Auto-preencher**: Valor, Data(s), Categoria, Centro de Custo, Fornecedor/Descrição.  
- **Marcar** cada campo sugerido com badge: “⚡ Sugerido pela IA — revise antes de confirmar”.  
- O usuário **pode editar** livremente qualquer campo.

---

## 5) Validações (bloqueiam envio)
- **Arquivo**: extensão e **tamanho ≤ 10MB**.  
- **Valor**: formato `R$ X,XX` → converter internamente para centavos.  
- **Datas**: `DD/MM/AAAA` e coerência com o tipo (ex.: PG requer **Data de Pagamento**; AGD/BOLETO requer **Vencimento**).  
- **Banco/Categoria/CC**: devem **existir no cadastro do cliente**.  
- **Tomador** (Boleto/NF): CNPJ/CPF válido, email válido.  
- Mensagens claras no campo (inline); foco no primeiro erro.

---

## 6) Validação Cruzada (no envio)
Ao clicar **Processar Documento**:
- Comparar **OCR/IA × Nome do Arquivo × Metadados do Formulário**.  
- Se houver divergência em **valor, data(s), categoria, centro de custo, fornecedor**:  
  - Criar **lista de inconsistências** no payload.  
  - Criar documento com status **PENDENTE_REVISAO** e **task REVISAO**.  
- Se ok → seguir para o **estado inicial do fluxo** conforme tipo:
  - **PG** → `PAGO_A_CONCILIAR`  
  - **AGD** → `AGENDAR` (ou `AGENDADO` se operador já agenda nesta etapa)  
  - **BOLETO/NF** → `EMISSAO` (ou direto `AGUARDANDO_RECEBIMENTO` após lançar “Contas a Receber (stub)")

---

## 7) API (contratos mínimos)

### 7.1 `POST /api/documents` (multipart)
Body:
- `file` (PDF/JPG/PNG)  
- `tipo` (“PG” | “AGD” | “BOLETO” | “NF”)  
- `bankId`, `categoryId`, `costCenterId`  
- `valor` (string “R$ X,XX”)  
- `data_pagamento?` (PG) | `data_vencimento?` (AGD/BOLETO)  
- `fornecedor`, `observacoes?`  
- `tomador?` (objeto p/ Boleto/NF)

Resposta:
```json
{
  "ok": true,
  "documentId": "<uuid>",
  "status_inicial": "RECEBIDO" | "PENDENTE_REVISAO" | "PAGO_A_CONCILIAR" | "AGENDAR" | "EMISSAO",
  "inconsistencias": [{"campo":"valor","ocr":"R$120,00","filename":"R$125,00","form":"R$120,00"}]
}
```

### 7.2 Lado servidor
- Salvar arquivo no storage (URL assinada).  
- Registrar `documents`, `document_logs` e, se houver, `document_inconsistencies`.  
- Enfileirar **job** `processDocument` se necessário (ex.: para prosseguir com IA/fallback ou rotinas pós-criação).

---

## 8) Telemetria/Métricas (mínimo)
No envio, registrar em `ai_runs` (se já tiver pipeline rodado aqui) **ou** no job:
- `document_id`, `provider_used`, `ocr_strategy`, `processing_time_ms`, `confidence`, `tokens_in/out?`, `cost_usd?`.

---

## 9) Acessibilidade & UX
- Indicar progresso (“Lendo documento…”, “Sugerindo campos…”).  
- Badge “⚡ Sugerido pela IA” nos campos auto-preenchidos.  
- Placeholders realistas: “R$ 120,00”, “05/09/2025”, “Uber”, “SRJ1”.  
- Botão principal (rosa da marca) **desabilita** enquanto houver erros.

---

## 10) Critérios de Aceite (teste manual com 6 amostras)
1) **PG correto**: IA preenche, usuário confirma → documento vai para `PAGO_A_CONCILIAR`.  
2) **PG divergente (valor)**: diferenças detectadas → `PENDENTE_REVISAO` + task `REVISAO`.  
3) **AGD**: exibe **Vencimento**; após envio, status inicial correto (AGENDAR/AGENDADO).  
4) **Boleto**: exibe campos do Tomador; ao enviar, status `EMISSAO` (ou `AGUARDANDO_RECEBIMENTO` se stub aplicado).  
5) **NF**: idem Boleto; se marcado “recebido no ato” (quando existir), pular direto p/ conciliação no fluxo posterior.  
6) **Arquivo inválido (tamanho/extensão)**: bloqueio com mensagem clara.

---

## 11) Observações finais
- **Não recarregar a página** ao alternar tipos — formulário adaptativo.  
- Manter **consistência visual** com o design Gquicks.  
- Qualquer divergência grave deve **impedir o avanço** e registrar pendência.  
- Preparar o código para receber **feature flags** (ex.: habilitar “Contas a Receber (stub)” mais adiante).
