import OpenAI from 'openai';

// Teste GLM API
async function testGLM() {
  const apiKey = process.env.GLM_API_KEY;
  console.log('🔑 GLM API Key exists:', !!apiKey);
  console.log('🔑 GLM API Key length:', apiKey ? apiKey.length : 0);
  
  if (!apiKey) {
    console.log('❌ GLM API key not found');
    return false;
  }
  
  try {
    console.log('🧪 Testing GLM API...');
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'glm-4-plus',
        messages: [
          {
            role: 'user',
            content: 'Responda apenas com um JSON simples: {"status": "ok", "message": "teste"}'
          }
        ],
        temperature: 0.1,
        max_tokens: 50,
        stream: false
      }),
    });

    console.log('📡 GLM Response Status:', response.status);
    console.log('📡 GLM Response Headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ GLM Error Response:', errorText);
      return false;
    }

    const data = await response.json();
    console.log('✅ GLM Success Response:', JSON.stringify(data, null, 2));
    
    // Test JSON parsing
    const aiResponse = data.choices[0].message.content;
    console.log('🤖 GLM Raw Response:', aiResponse);
    
    // Clean response like in production
    let cleanResponse = aiResponse;
    if (cleanResponse.includes('```json')) {
      cleanResponse = cleanResponse.replace(/```json\s*/, '').replace(/```\s*$/, '');
    }
    if (cleanResponse.includes('```')) {
      cleanResponse = cleanResponse.replace(/```\s*/, '').replace(/```\s*$/, '');
    }
    
    console.log('🧹 GLM Cleaned Response:', cleanResponse);
    
    try {
      const parsed = JSON.parse(cleanResponse.trim());
      console.log('✅ GLM JSON Parse Success:', parsed);
      return true;
    } catch (parseError) {
      console.log('❌ GLM JSON Parse Failed:', parseError.message);
      return false;
    }
    
  } catch (error) {
    console.log('❌ GLM API Test Failed:', error.message);
    return false;
  }
}

// Teste OpenAI API
async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  console.log('🔑 OpenAI API Key exists:', !!apiKey);
  console.log('🔑 OpenAI API Key length:', apiKey ? apiKey.length : 0);
  
  if (!apiKey) {
    console.log('❌ OpenAI API key not found');
    return false;
  }
  
  try {
    console.log('🧪 Testing OpenAI API...');
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: 'Responda apenas com um JSON simples: {"status": "ok", "message": "teste"}'
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 50,
    });

    console.log('✅ OpenAI Success Response:', JSON.stringify(response, null, 2));
    
    const content = response.choices[0].message.content;
    console.log('🤖 OpenAI Raw Response:', content);
    
    if (!content) {
      console.log('❌ OpenAI No content in response');
      return false;
    }

    try {
      const parsed = JSON.parse(content);
      console.log('✅ OpenAI JSON Parse Success:', parsed);
      return true;
    } catch (parseError) {
      console.log('❌ OpenAI JSON Parse Failed:', parseError.message);
      return false;
    }
    
  } catch (error) {
    console.log('❌ OpenAI API Test Failed:', error.message);
    if (error.code) {
      console.log('📋 Error Code:', error.code);
    }
    if (error.status) {
      console.log('📋 HTTP Status:', error.status);
    }
    return false;
  }
}

// Executar testes
async function runTests() {
  console.log('🚀 Starting API Tests...\n');
  
  console.log('=== GLM TEST ===');
  const glmResult = await testGLM();
  
  console.log('\n=== OPENAI TEST ===');
  const openaiResult = await testOpenAI();
  
  console.log('\n=== RESULTS ===');
  console.log('GLM Working:', glmResult ? '✅' : '❌');
  console.log('OpenAI Working:', openaiResult ? '✅' : '❌');
  
  if (!glmResult && !openaiResult) {
    console.log('❌ Both APIs are failing');
  } else if (glmResult && openaiResult) {
    console.log('✅ Both APIs are working');
  } else if (glmResult) {
    console.log('⚠️ Only GLM is working');
  } else {
    console.log('⚠️ Only OpenAI is working');
  }
}

runTests().catch(console.error);