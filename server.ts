import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Rota de Healthcheck
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Rota de Geração de Decupagem de Cena com Gemini
  app.post("/api/generate-scene", async (req, res) => {
    try {
      const { description, sceneNumber } = req.body;

      if (!description || typeof description !== "string" || !description.trim()) {
        return res.status(400).json({ error: "A descrição da cena é obrigatória." });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "A variável de ambiente GEMINI_API_KEY não está configurada no servidor."
        });
      }

      const ai = new GoogleGenAI({ apiKey });

      const prompt = `Você é um diretor de fotografia e assistente de direção cinematográfica profissional especializado em decupagem técnica e listas de planos (shot list).
O usuário forneceu a seguinte ideia ou descrição de cena:
"${description.trim()}"

Crie uma decupagem cinematográfica completa, precisa e rica para essa cena.
Retorne a resposta EXCLUSIVAMENTE em formato JSON válido, sem cercas de código markdown (\`\`\`json), sem textos extras antes ou depois.

O JSON deve seguir esta estrutura exata:
{
  "texto_formatado": "Texto cinematográfico completo e elegante descrevendo a decupagem técnica, atmosfera visual, movimento de câmera, iluminação e som.",
  "sugestoes": {
    "cena": "${sceneNumber || 'CENA 01'}",
    "plano": "Nome do plano cinematográfico (ex: 'PLANO GERAL (PG)', 'PLANO MÉDIO (PM)', 'PRIMEIRO PLANO (PP)', etc.)",
    "angulo": "Ângulo de câmera (ex: 'NORMAL (NÍVEL DO OLHO)', 'PLONGÉE', 'CONTRA-PLONGÉE', 'ZENITAL', etc.)",
    "movimento": "Movimento de câmera (ex: 'CÂMERA FIXA (ESTÁTICA)', 'PANORÂMICA (PAN)', 'TRAVELLING', 'STEADICAM', 'CÂMERA NA MÃO', etc.)",
    "descricao": "Descrição concisa e objetiva da ação para a planilha de decupagem",
    "locacao": "Locação padrão roteiro (ex: 'INT. COZINHA - NOITE', 'EXT. RUA CHUVOSA - DIA', etc.)",
    "luz": "Esquema de iluminação (ex: 'Luz Natural Suave', 'Neon Noturno', 'Claro-Escuro / Chiaroscuro', etc.)",
    "duracao": 4.5,
    "trilha": "Trilha sonora, ruídos diegéticos ou atmosfera sonora sugerida"
  }
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          temperature: 0.7,
        },
      });

      let rawText = response.text || "";
      // Limpeza de possíveis blocos de código
      rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

      try {
        const parsed = JSON.parse(rawText);
        return res.json({
          success: true,
          texto: parsed.texto_formatado || rawText,
          sugestoes: parsed.sugestoes || null
        });
      } catch (parseError) {
        // Se falhar o parse JSON, retorna o texto bruto gerado
        return res.json({
          success: true,
          texto: rawText,
          sugestoes: null
        });
      }
    } catch (err: any) {
      console.error("Erro na rota /api/generate-scene:", err);
      return res.status(500).json({
        error: err?.message || "Erro interno ao processar a geração com a API do Gemini."
      });
    }
  });

  // Vite middleware para desenvolvimento / estático para produção
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🎬 CineSlate Server rodando na porta ${PORT}`);
  });
}

startServer();
