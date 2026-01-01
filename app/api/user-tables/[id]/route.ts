
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { TableType } from "@/prisma/generated/prisma/enums";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tableId } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const table = await prisma.userTable.findUnique({
      where: { id: tableId },
    });

    if (!table || table.userId !== userId) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    let data = [];
    if (table.type === 'MIXED') {
      const txns = await prisma.transaction.findMany({ where: { tableId } });
      const transfers = await prisma.tokenTransfer.findMany({ where: { tableId } });

      const mappedTxns = txns.map(t => ({
        id: t.id,
        hash: t.hash,
        method: t.method,
        block: t.block,
        timestamp: t.time.toISOString(),
        from: t.from,
        to: t.to,
        value: t.amount,
        fee: t.txnFee,
        type: 'native',
        status: 'success',
        tableId: t.tableId
      }));

      const mappedTransfers = transfers.map(t => ({
        id: t.id,
        hash: t.hash,
        method: t.method,
        block: t.block,
        timestamp: t.time.toISOString(),
        from: t.from,
        to: t.to,
        value: t.amount,
        token: t.token,
        type: 'erc20',
        status: 'success',
        tableId: t.tableId
      }));

      data = [...mappedTxns, ...mappedTransfers];
    } else if (table.type === 'TRANSACTION') {
      const txns = await prisma.transaction.findMany({ where: { tableId } });
      data = txns.map(t => ({
        id: t.id,
        hash: t.hash,
        method: t.method,
        block: t.block,
        timestamp: t.time.toISOString(),
        from: t.from,
        to: t.to,
        value: t.amount,
        fee: t.txnFee,
        type: 'native',
        status: 'success',
        tableId: t.tableId
      }));
    } else {
      const transfers = await prisma.tokenTransfer.findMany({ where: { tableId } });
      data = transfers.map(t => ({
        id: t.id,
        hash: t.hash,
        method: t.method,
        block: t.block,
        timestamp: t.time.toISOString(),
        from: t.from,
        to: t.to,
        value: t.amount,
        token: t.token,
        type: 'erc20',
        status: 'success',
        tableId: t.tableId
      }));
    }

    return NextResponse.json({
      ...table,
      data
    });

  } catch (error) {
    console.error("Failed to fetch table data:", error);
    return NextResponse.json({ error: "Failed to fetch table data" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tableId } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const table = await prisma.userTable.findUnique({
      where: { id: tableId },
    });

    if (!table || table.userId !== userId) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    await prisma.userTable.delete({
      where: { id: tableId }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Failed to delete table:", error);
    return NextResponse.json({ error: "Failed to delete table" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: tableId } = await params;
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;

  try {
    const body = await req.json();
    const { name } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: "Invalid name" }, { status: 400 });
    }

    const table = await prisma.userTable.findUnique({
      where: { id: tableId },
    });

    if (!table || table.userId !== userId) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    // Check if new name already exists for this user
    const existing = await prisma.userTable.findFirst({
      where: { userId, name, id: { not: tableId } }
    });

    if (existing) {
      return NextResponse.json({ error: "Table name already exists" }, { status: 409 });
    }

    const updatedTable = await prisma.userTable.update({
      where: { id: tableId },
      data: { name }
    });

    return NextResponse.json(updatedTable);

  } catch (error) {
    console.error("Failed to rename table:", error);
    return NextResponse.json({ error: "Failed to rename table" }, { status: 500 });
  }
}

