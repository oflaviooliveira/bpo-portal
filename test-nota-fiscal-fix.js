/**
 * Teste para verificar se o sistema corrigiu a identificação do fornecedor
 * na nota fiscal dos pneus
 */

const testDocument = `
ROBSON PNEUS E AUTOPECAS LTDA                                          DANFE
                                                              Documento Auxiliar da
                                                              Nota Fiscal Eletrônica
AV MARIA DO CARMO, 1571
POSTO LAVA TUCUNS                                               0 - ENTRADA
CRUZ / CE                                                       1 - SAÍDA                   1                                                 CHAVE DE ACESSO
62595-000                                                                                                    2325 0758 9500 1800 0134 5500 1000 0006 4514 8268 4620
(88) 9729-5739 -                                                           Nº 645
                                                                           Série 1
                                                                                            Consulta de Autenticidade no portal nacional da NF -e
                                                                      FL      1 /1                       www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizada
NATUREZA DA OPERAÇÃO                                                                                                                                    PROTOCOLO DE AUTORIZAÇÃO DE USO: 223250071454265 - 19/07/2025
Revenda de mercadorias com ST
INSCRIÇÃO ESTADUAL              INSCR.EST.DO SUBST.TRIBUTÁRIO                CNPJ
072368276                                                                    58.950.018/0001-34

DESTINATÁRIO / REMETENTE
NOME / RAZÃO SOCIAL                                                                                                                                      CNPJ / CPF                                                  DATA DE EMISSÃO

ECO EXPRESS SERVICOS SUSTENTAVEIS LTDA                                                                                                                   24.824.109/0001-01                                          19/07/2025
ENDEREÇO                                                                                                             BAIRRO / DISTRITO                                                CEP                            DATA SAÍDA / ENTRADA

ST SRTVS, 110 QUADRA701 BLOCO O SALA 521 - PARTE                                                                      ASA SUL                                                         70340-000                       19/07/2025
MUNICÍPIO                                                                          FONE / FAX                                               UF           INSCRIÇÃO ESTADUAL                                          HORA SAÍDA / ENTRADA

BRASÍLIA                                                                           (61) 8123-4535                                              DF        0776914000149                                                10:56:28

VALOR TOTAL DA NOTA
1.450,00

DADOS DOS PRODUTOS / SERVIÇOS
CÓDIGO                     DESCRIÇÃO DOS PRODUTOS / SERVIÇOS                                                        NCM        CST      CFOP        UN    QTDE        V. UNITÁRIO   V. TOTAL            BC ICMS        V. ICMS      V. IPI   ICMS       IPI
0001010000007              PNEU WANLI 225/75R16LT 120/116S 225/75R16                                          40119090            060   6.403    UN          2        725,00        1.450,00            0,00           0,00        0,00         0        0
`;

async function testNotaFiscalCorrection() {
  console.log("🧪 Testando correção da nota fiscal...");
  
  // Simular análise com o novo sistema
  const { NotaFiscalAnalyzer } = require('./server/ai/nota-fiscal-analyzer.ts');
  
  const isNF = NotaFiscalAnalyzer.isNotaFiscal(testDocument);
  console.log(`✅ É nota fiscal? ${isNF}`);
  
  if (isNF) {
    const analysis = NotaFiscalAnalyzer.analyzeNotaFiscal(testDocument);
    console.log("📊 Análise da nota fiscal:");
    console.log(`   Fornecedor: ${analysis.fornecedor}`);
    console.log(`   CNPJ Fornecedor: ${analysis.fornecedorCnpj}`);
    console.log(`   Cliente: ${analysis.cliente}`);
    console.log(`   CNPJ Cliente: ${analysis.clienteCnpj}`);
    console.log(`   Valor: ${analysis.valor}`);
    console.log(`   Descrição: ${analysis.descricao}`);
    console.log(`   Data: ${analysis.dataEmissao}`);
    
    // Verificar se corrigiu corretamente
    const isCorrect = analysis.fornecedor.includes('ROBSON PNEUS') && 
                     analysis.fornecedorCnpj === '58950018000134' &&
                     analysis.cliente.includes('ECO EXPRESS');
    
    console.log(`\n${isCorrect ? '✅ CORREÇÃO APLICADA COM SUCESSO!' : '❌ Ainda há problemas na identificação'}`);
    console.log(`   ✓ Fornecedor correto: ${analysis.fornecedor.includes('ROBSON PNEUS') ? 'SIM' : 'NÃO'}`);
    console.log(`   ✓ CNPJ fornecedor correto: ${analysis.fornecedorCnpj === '58950018000134' ? 'SIM' : 'NÃO'}`);
    console.log(`   ✓ Cliente identificado: ${analysis.cliente.includes('ECO EXPRESS') ? 'SIM' : 'NÃO'}`);
    
    return isCorrect;
  }
  
  return false;
}

// Executar o teste se chamado diretamente
if (require.main === module) {
  testNotaFiscalCorrection().catch(console.error);
}

module.exports = { testNotaFiscalCorrection };