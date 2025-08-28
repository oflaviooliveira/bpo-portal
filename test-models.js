import OpenAI from 'openai';

// Teste GLM com diferentes modelos
async function testGLMModel(model) {
  const apiKey = process.env.GLM_API_KEY;
  
  try {
    console.log(`🧪 Testing GLM with model: ${model}...`);
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: 'Responda apenas: {"teste": "ok"}'
          }
        ],
        temperature: 0.1,
        max_tokens: 50,
        stream: false
      }),
    });

    console.log(`📡 ${model} Response Status:`, response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ ${model} Error:`, errorText);
      return false;
    }

    const data = await response.json();
    console.log(`✅ ${model} Success:`, data.choices[0].message.content);
    return true;
    
  } catch (error) {
    console.log(`❌ ${model} Failed:`, error.message);
    return false;
  }
}

// Testar diferentes modelos GLM
async function runGLMModelTests() {
  console.log('🚀 Testing GLM Models...\n');
  
  const models = ['glm-4.5', 'glm-4-plus', 'glm-4', 'glm-4-0520', 'glm-4-air', 'glm-4-airx'];
  
  for (const model of models) {
    await testGLMModel(model);
    console.log('---');
  }
}

runGLMModelTests().catch(console.error);