import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");

  if (!address) {
    // Return all tags for the user if no specific address is requested
    try {
      const allTags = await prisma.addressTag.findMany({
        where: {
          OR: [
            { visibility: 'PUBLIC' },
            { userId: (session.user as any).id }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json(allTags);
    } catch (error) {
      console.error("Failed to fetch all tags:", error);
      return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
    }
  }

  try {
    const tags = await prisma.addressTag.findMany({
      where: {
        address: address.toLowerCase(),
        OR: [
          { visibility: 'PUBLIC' },
          { userId: (session.user as any).id }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(tags);
  } catch (error) {
    console.error("Failed to fetch tags:", error);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { address, content, behavior, visibility } = body;

    if (!address || !behavior) {
      return NextResponse.json({ error: "Address and behavior are required" }, { status: 400 });
    }

    const newTag = await prisma.addressTag.create({
      data: {
        address: address.toLowerCase(),
        content: content || "普通地址", // Default value
        behavior: behavior,
        source: "User", // Default source
        visibility: visibility || "PUBLIC",
        userId: (session.user as any).id
      }
    });

    return NextResponse.json(newTag);
  } catch (error) {
    console.error("Failed to create tag:", error);
    return NextResponse.json({ error: "Failed to create tag" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 });
    }

    // Verify ownership
    const tag = await prisma.addressTag.findUnique({
      where: { id: parseInt(id) }
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (tag.userId !== (session.user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await prisma.addressTag.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete tag:", error);
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !(session.user as any).id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { id, content, behavior, visibility } = body;

    if (!id) {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 });
    }

    // Verify ownership
    const tag = await prisma.addressTag.findUnique({
      where: { id: parseInt(id) }
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (tag.userId !== (session.user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updatedTag = await prisma.addressTag.update({
      where: { id: parseInt(id) },
      data: {
        content: content !== undefined ? content : tag.content,
        behavior: behavior !== undefined ? behavior : tag.behavior,
        visibility: visibility !== undefined ? visibility : tag.visibility,
      }
    });

    return NextResponse.json(updatedTag);
  } catch (error) {
    console.error("Failed to update tag:", error);
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 });
  }
}
