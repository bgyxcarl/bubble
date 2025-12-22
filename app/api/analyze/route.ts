import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, GeminiAnalysisResponse } from "../../../types";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { transactions, context }: { transactions: Transaction[]; context: 'native' | 'erc20' } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Optimize payload size
    const minimalData = transactions.slice(0, 50).map(tx => ({
      t: tx.timestamp,
      f: tx.from.substring(0, 6),
      to: tx.to.substring(0, 6),
      v: tx.value,
      sym: tx.token,
      type: tx.type
    }));

    const contextPrompt = context === 'erc20'
      ? "Focus on token accumulation patterns, dump risks, and high-frequency token swapping behavior."
      : "Focus on large value ETH transfers, gas usage patterns, and exchange deposits/withdrawals.";

    const prompt = `
      Analyze this blockchain transaction dataset (subset provided).
      Context: ${contextPrompt}

      Identify key actors based on volume and frequency.
      Return a JSON object with:
      1. "insights": Array of objects for key addresses with:
         - "address": string (reconstruct full address format if truncated or use 'Aggregated')
         - "tags": Array of strings (e.g., "Whale", "Sniper Bot", "Paper Hands", "Accumulator", "Exchange")
         - "riskScore": number (0-100)
         - "behaviorSummary": string (Short snappy description)
      2. "globalTrend": string (Overall market sentiment derived from this flow)

      Data: ${JSON.stringify(minimalData)}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  address: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                  riskScore: { type: Type.NUMBER },
                  behaviorSummary: { type: Type.STRING },
                }
              }
            },
            globalTrend: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const result = JSON.parse(text) as GeminiAnalysisResponse;
    return NextResponse.json(result);

  } catch (error) {
    console.error("Gemini Analysis Failed:", error);
    const fallback: GeminiAnalysisResponse = {
      insights: [
        {
          address: "0xNetwork_Error",
          tags: ["Error"],
          riskScore: 0,
          behaviorSummary: "Could not complete AI analysis. Please check API Key."
        }
      ],
      globalTrend: "Data unavailable"
    };
    return NextResponse.json(fallback, { status: 500 });
  }
}