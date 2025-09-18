import { db } from "./db";
import { banks, categories, costCenters, clients, tenants, users } from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { sql } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function seedDatabase() {
  console.log("🌱 Iniciando seed do banco...");

  try {
    // 1. Criar bancos principais do Brasil
    const banksData = [
      { code: "001", name: "Banco do Brasil" },
      { code: "237", name: "Bradesco" },
      { code: "341", name: "Itaú Unibanco" },
      { code: "104", name: "Caixa Econômica Federal" },
      { code: "033", name: "Santander" },
      { code: "260", name: "Nu Pagamentos" },
      { code: "290", name: "PagSeguro" },
      { code: "077", name: "Banco Inter" },
      { code: "212", name: "Banco Original" },
      { code: "336", name: "Banco C6" },
      { code: "748", name: "Sicredi" },
      { code: "756", name: "Sicoob" },
      { code: "422", name: "Banco Safra" },
      { code: "655", name: "Neon" },
      { code: "323", name: "Mercado Pago" },
    ];

    console.log("📦 Inserindo bancos...");
    await db.insert(banks).values(banksData).onConflictDoNothing();

    // 2. Criar tenant padrão Gquicks
    const tenantId = "123e4567-e89b-12d3-a456-426614174000";
    console.log("🏢 Criando tenant Gquicks...");
    await db.insert(tenants).values({
      id: tenantId,
      name: "Gquicks BPO",
      slug: "gquicks",
    }).onConflictDoNothing();

    // 3. Criar categorias padrão
    const categoriesData = [
      { tenantId, name: "Fornecedores", description: "Pagamentos a fornecedores" },
      { tenantId, name: "Impostos", description: "Impostos federais, estaduais e municipais" },
      { tenantId, name: "Folha de Pagamento", description: "Salários e encargos trabalhistas" },
      { tenantId, name: "Financiamentos", description: "Empréstimos e financiamentos" },
      { tenantId, name: "Cartão de Crédito", description: "Faturas de cartão empresarial" },
      { tenantId, name: "Serviços", description: "Prestação de serviços terceirizados" },
      { tenantId, name: "Energia Elétrica", description: "Contas de energia" },
      { tenantId, name: "Telecomunicações", description: "Telefone, internet, dados" },
      { tenantId, name: "Combustível", description: "Abastecimento de veículos" },
      { tenantId, name: "Manutenção", description: "Manutenção predial e equipamentos" },
      { tenantId, name: "Marketing", description: "Campanhas e publicidade" },
      { tenantId, name: "Viagens", description: "Viagens corporativas" },
      { tenantId, name: "Material de Escritório", description: "Suprimentos administrativos" },
      { tenantId, name: "Seguros", description: "Seguros empresariais" },
      { tenantId, name: "Contabilidade", description: "Serviços contábeis" },
    ];

    console.log("📁 Inserindo categorias...");
    await db.insert(categories).values(categoriesData).onConflictDoNothing();

    // 4. Criar centros de custo padrão
    const costCentersData = [
      { tenantId, name: "Administração", description: "Custos administrativos gerais" },
      { tenantId, name: "Vendas", description: "Departamento comercial" },
      { tenantId, name: "Marketing", description: "Departamento de marketing" },
      { tenantId, name: "Operacional", description: "Operações da empresa" },
      { tenantId, name: "Financeiro", description: "Departamento financeiro" },
      { tenantId, name: "RH", description: "Recursos humanos" },
      { tenantId, name: "TI", description: "Tecnologia da informação" },
      { tenantId, name: "Jurídico", description: "Departamento jurídico" },
      { tenantId, name: "Compras", description: "Departamento de compras" },
      { tenantId, name: "Logística", description: "Logística e distribuição" },
      { tenantId, name: "Produção", description: "Área de produção" },
      { tenantId, name: "Qualidade", description: "Controle de qualidade" },
      { tenantId, name: "P&D", description: "Pesquisa e desenvolvimento" },
      { tenantId, name: "Matriz", description: "Custos da matriz" },
      { tenantId, name: "Filial", description: "Custos das filiais" },
    ];

    console.log("🎯 Inserindo centros de custo...");
    await db.insert(costCenters).values(costCentersData).onConflictDoNothing();

    // 5. Criar cliente padrão para testes
    const clientData = {
      tenantId,
      name: "Cliente Teste Gquicks",
      document: "12.345.678/0001-90",
      email: "cliente@gquicks.com",
      phone: "(11) 99999-9999",
    };

    console.log("👤 Inserindo cliente padrão...");
    await db.insert(clients).values(clientData).onConflictDoNothing();

    // 6. Verificar se usuário admin já existe, senão criar
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, "admin@gquicks.com"),
    });

    if (!existingUser) {
      console.log("👨‍💼 Criando usuário admin...");
      const hashedPassword = await hashPassword("admin123");
      
      await db.insert(users).values({
        username: "admin@gquicks.com",
        password: hashedPassword,
        email: "admin@gquicks.com",
        firstName: "Administrador",
        lastName: "Gquicks",
        role: "ADMIN",
        tenantId,
      });
    }

    // 7. Verificar se usuário cliente já existe, senão criar
    const existingClientUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.username, "cliente@teste.com"),
    });

    if (!existingClientUser) {
      console.log("👤 Criando usuário cliente de teste...");
      const hashedPassword = await hashPassword("cliente123");
      
      await db.insert(users).values({
        username: "cliente@teste.com",
        password: hashedPassword,
        email: "cliente@teste.com",
        firstName: "Cliente",
        lastName: "Teste",
        role: "CLIENT_USER",
        tenantId,
      });
    }

    console.log("✅ Seed concluído com sucesso!");

  } catch (error) {
    console.error("❌ Erro no seed:", error);
    throw error;
  }
}

// Execute seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => {
      console.log("🎉 Banco populado com sucesso!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Falha no seed:", error);
      process.exit(1);
    });
}