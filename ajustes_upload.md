Você deve revisar e melhorar o fluxo de Upload de Documentos do Portal BPO Gquicks conforme instruções abaixo.
Não pule etapas. Ajuste código, UI e lógica conforme descrito.

1. Fluxo Geral de Upload

O processo deve seguir a ordem:

Cliente faz upload do arquivo (PDF/JPG/PNG até 10MB).

IA (OCR + análise) lê automaticamente o documento e pré-preenche os campos.

Cliente vê o formulário com os campos já sugeridos pela IA, podendo editar ou completar.

Cliente confirma clicando em Processar Documento, e o sistema envia para o fluxo correspondente (PG, AGD, BOLETO, NF).

2. Ajustes no Formulário de Metadados

Campos comuns (sempre visíveis):

Banco (dropdown com busca)

Categoria (dropdown com busca)

Centro de Custo (dropdown com busca)

Valor (formato R$ X,XX)

Fornecedor/Descrição (texto)

Observações (texto opcional)

Campos condicionais (dependem do tipo de solicitação):

Pago (PG): mostrar Data de Pagamento.

Agendado (AGD): mostrar Data de Vencimento.

Emitir Boleto: mostrar Data de Vencimento + dados do Tomador (CNPJ/CPF, Endereço, Contato, Email).

Emitir NF: mostrar Código de Serviço, Descrição/Itens, Valor, Tomador (CNPJ/CPF, Endereço, Contato).

Feedback da IA:

Campos sugeridos pela IA devem aparecer pré-preenchidos em cinza claro.

Exibir texto auxiliar: “⚡ Sugerido pela IA — revise antes de confirmar”.

3. Lógica de Validação

Validação obrigatória antes de Processar Documento:

Datas sempre no formato DD/MM/AAAA.

Valores no formato R$ X,XX.

Categoria e Centro de Custo devem existir no cadastro do cliente.

Se algum campo obrigatório estiver vazio ou com formato incorreto → bloquear envio e mostrar mensagem clara.

Divergência entre Nome do Arquivo x OCR x Metadados → documento deve ir para Pendência de Revisão automaticamente.

4. Melhorias do PRD a Incluir

Estados automáticos:

“Agendado” muda para Aguardando Recebimento na data de vencimento.

Documentos de “Emitir Boleto” e “Emitir NF” entram em Contas a Receber (stub ERP) e ficam em Aguardando Recebimento até pagamento.

Formulário adaptativo: campos devem mudar dinamicamente no front-end conforme o tipo selecionado, sem recarregar a página.

UI/UX:

Botão principal em Rosa (#FF0066).

Layout minimalista com feedback visual em tempo real.

Placeholder dos campos deve refletir exemplos reais (ex.: “Uber”, “R$ 120,00”, “05/09/2025”).

5. Critério de Aceite

Após upload, todos os campos principais devem vir pré-preenchidos pela IA quando possível.

Cliente deve conseguir editar e completar facilmente antes de enviar.

Campos obrigatórios devem mudar conforme o tipo de solicitação.

Divergências ou dados inválidos bloqueiam o envio até correção.

Workflow completo (PG, AGD, BOLETO, NF) deve funcionar com os estados definidos no PRD.