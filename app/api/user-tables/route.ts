
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { TableType } from "@/prisma/generated/prisma/enums";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = (session.user as any).id;
    const tables = await prisma.userTable.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        createdAt: true,
        _count: {
          select: {
            transactions: true,
            tokenTransfers: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(tables);
  } catch (error) {
    console.error("Failed to fetch tables:", error);
    return NextResponse.json({ error: "Failed to fetch tables" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, data } = body;
    // We infer type from data content now, but client might still send 'type'
    // Actually best to ignore client 'type' or use it as hint, but 'data' is truth.

    if (!name || !data || !Array.isArray(data)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const userId = (session.user as any).id;

    // Determine Table Type
    const hasNative = data.some((d: any) => d.type === 'native');
    const hasErc20 = data.some((d: any) => d.type === 'erc20');

    let tableType: TableType = TableType.TRANSACTION;
    if (hasNative && hasErc20) {
      tableType = TableType.MIXED;
    } else if (hasErc20) {
      tableType = TableType.TOKEN_TRANSFER;
    }

    // Check if table name exists for user
    const existing = await prisma.userTable.findFirst({
      where: { userId, name }
    });

    if (existing) {
      return NextResponse.json({ error: "Table name already exists" }, { status: 409 });
    }

    const table = await prisma.userTable.create({
      data: {
        name,
        type: tableType,
        userId,
      }
    });

    // Batch Insert Data
    const nativeRows = data.filter((d: any) => d.type === 'native').map((d: any) => ({
      tableId: table.id,
      hash: d.hash,
      method: d.method,
      block: Number(d.block),
      time: new Date(d.timestamp),
      from: d.from,
      to: d.to,
      amount: Number(d.value) || 0,
      txnFee: Number(d.fee) || 0,
    }));

    if (nativeRows.length > 0) {
      await prisma.transaction.createMany({ data: nativeRows });
    }

    const erc20Rows = data.filter((d: any) => d.type === 'erc20').map((d: any) => ({
      tableId: table.id,
      hash: d.hash,
      method: d.method,
      block: Number(d.block),
      time: new Date(d.timestamp),
      from: d.from,
      to: d.to,
      amount: Number(d.value) || 0,
      token: d.token || 'TOKEN',
    }));

    if (erc20Rows.length > 0) {
      await prisma.tokenTransfer.createMany({ data: erc20Rows });
    }

    return NextResponse.json({ success: true, tableId: table.id });

  } catch (error) {
    console.error("Failed to save table:", error);
    return NextResponse.json({ error: "Failed to save table" }, { status: 500 });
  }
}
