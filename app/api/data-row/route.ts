
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  try {
    const body = await req.json();
    const { id, type, tableId, ...data } = body;

    // Note: 'id' might be a temp ID from frontend, we let DB generate a real one (cuid) or we use it if we want custom IDs (but Prisma defaults usually handles it).
    // However, Prisma schema uses @default(cuid()) for ID. Best practice: let DB handle ID or ensure frontend generates cuid compatible.
    // But here we are inserting. Let's ignore the frontend ID and return the new DB ID to be safe and standard.

    if (!type || !tableId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify ownership
    const table = await prisma.userTable.findFirst({
      where: { id: tableId, userId }
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found or unauthorized" }, { status: 404 });
    }

    let newRow;

    if (type === 'native') {
      newRow = await prisma.transaction.create({
        data: {
          hash: data.hash,
          method: data.method,
          block: Number(data.block),
          time: new Date(data.timestamp),
          from: data.from,
          to: data.to,
          amount: Number(data.value),
          txnFee: Number(data.fee),
          tableId
        }
      });
    } else {
      newRow = await prisma.tokenTransfer.create({
        data: {
          hash: data.hash,
          method: data.method,
          block: Number(data.block),
          time: new Date(data.timestamp),
          from: data.from,
          to: data.to,
          amount: Number(data.value),
          token: data.token,
          tableId
        }
      });
    }

    return NextResponse.json({ success: true, id: newRow.id, tableId: tableId });

  } catch (error) {
    console.error("Failed to create row:", error);
    return NextResponse.json({ error: "Failed to create row" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  try {
    const body = await req.json();
    const { id, type, tableId, ...data } = body;

    if (!id || !type || !tableId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify ownership of the table
    const table = await prisma.userTable.findFirst({
      where: { id: tableId, userId }
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found or unauthorized" }, { status: 404 });
    }

    if (type === 'native') {
      await prisma.transaction.update({
        where: { id },
        data: {
          hash: data.hash,
          method: data.method,
          block: Number(data.block),
          time: new Date(data.timestamp),
          from: data.from,
          to: data.to,
          amount: Number(data.value),
          txnFee: Number(data.fee)
        }
      });
    } else {
      await prisma.tokenTransfer.update({
        where: { id },
        data: {
          hash: data.hash,
          method: data.method,
          block: Number(data.block),
          time: new Date(data.timestamp),
          from: data.from,
          to: data.to,
          amount: Number(data.value),
          token: data.token
        }
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Failed to update row:", error);
    return NextResponse.json({ error: "Failed to update row" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');
    const tableId = searchParams.get('tableId');

    if (!id || !type || !tableId) {
      return NextResponse.json({ error: "Missing required params" }, { status: 400 });
    }

    // Verify ownership
    const table = await prisma.userTable.findFirst({
      where: { id: tableId, userId }
    });

    if (!table) {
      return NextResponse.json({ error: "Table not found or unauthorized" }, { status: 404 });
    }

    if (type === 'native') {
      await prisma.transaction.delete({ where: { id } });
    } else {
      await prisma.tokenTransfer.delete({ where: { id } });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Failed to delete row:", error);
    return NextResponse.json({ error: "Failed to delete row" }, { status: 500 });
  }
}
