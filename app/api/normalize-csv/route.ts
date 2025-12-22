import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export interface CsvMapping {
  fromIndex: number;
  toIndex: number;
  valueIndex: number;
  tokenIndex: number;
  timestampIndex: number;
  hashIndex: number;
  methodIndex: number;
  blockIndex: number;
  feeIndex: number;
  hasHeader: boolean;
  detectedType: 'native' | 'erc20' | 'mixed';
  confidenceReason: string;
}

export async function POST(request: NextRequest) {
  try {
    const { csvSnippet, userHint }: { csvSnippet: string; userHint: string } = await request.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      You are an expert Blockchain Data Engineer.
      Perform a strict structural analysis on the provided CSV snippet to map columns to a standardized transaction schema.

      User Hint: The user indicated this file contains **${userHint.toUpperCase()}** data.

      CSV Snippet (First 5 rows):
      ${csvSnippet}

      **Goal**: Accurately map column indices (0-based) and validate the data type using Field Similarity.

      **Step 1: Column Similarity & Synonym Matching**
      Compare headers against these standard fields. Use semantic similarity:
      - 'fromIndex': Sender, From, Source, Signer, Wallet (From)
      - 'toIndex': Receiver, To, Destination, Beneficiary, Wallet (To)
      - 'valueIndex': Amount, Value, Quantity, Volume, Qty
      - 'tokenIndex': Symbol, Token, Asset, Currency, Coin Name
      - 'feeIndex': Txn Fee, Gas, Transaction Fee
      - 'hashIndex': TxHash, Hash, Transaction ID
      - 'blockIndex': Block No, Block Height
      - 'timestampIndex': UnixTimestamp, Date, DateTime, Time

      **Step 2: Content Pattern Analysis (Heuristics)**
      - **Value Columns**: Look for numeric values. If a column has "ETH" or "$" suffixes (e.g. "0.5 ETH"), it is the Value column, but does NOT automatically mean Native if a Token column exists.
      - **Token Columns**: Look for short uppercase strings (e.g., "USDT", "WETH", "DAI").
      - **Addresses**: Look for "0x..." patterns (42 chars).

      **Step 3: Classification Logic (Logic > Hint)**
      - **ERC20/Mixed**: Strongly inferred if a 'Token', 'Symbol' or 'Contract' column exists with values other than just 'ETH'.
      - **Native**: Infer if 'Fee' or 'Gas' columns exist and NO separate 'Token' column exists (or Token is constant 'ETH').
      - **Conflict Resolution**: If the User Hint is 'erc20' but you see no Token column, check if the 'Value' column implies a token (e.g. "500 USDC") or if the context implies a token export.

      **Output Requirement**:
      - Return -1 for missing columns.
      - In 'confidenceReason', explicitly state which columns matched based on similarity (e.g. "High similarity match: 'Asset' header mapped to tokenIndex").

      Return JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fromIndex: { type: Type.INTEGER },
            toIndex: { type: Type.INTEGER },
            valueIndex: { type: Type.INTEGER },
            tokenIndex: { type: Type.INTEGER },
            timestampIndex: { type: Type.INTEGER },
            hashIndex: { type: Type.INTEGER },
            methodIndex: { type: Type.INTEGER },
            blockIndex: { type: Type.INTEGER },
            feeIndex: { type: Type.INTEGER },
            hasHeader: { type: Type.BOOLEAN },
            detectedType: { type: Type.STRING, enum: ['native', 'erc20', 'mixed'] },
            confidenceReason: { type: Type.STRING }
          }
        }
      }
    });

    const result = JSON.parse(response.text!) as CsvMapping;
    return NextResponse.json(result);

  } catch (error) {
    console.error("CSV AI Mapping failed, falling back to defaults", error);
    const fallback: CsvMapping = {
      fromIndex: 0, toIndex: 1, valueIndex: 2, tokenIndex: 3, timestampIndex: -1,
      hashIndex: -1, methodIndex: -1, blockIndex: -1, feeIndex: -1,
      hasHeader: true, detectedType: 'native', confidenceReason: 'AI Analysis failed; falling back to default schema.'
    };
    return NextResponse.json(fallback, { status: 500 });
  }
}