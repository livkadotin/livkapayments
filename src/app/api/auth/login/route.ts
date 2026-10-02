import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSessionToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { LoginSchema } from "@/lib/validations";
import { createAuditLog } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid login credentials", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: user.role as any,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });

    // Set HTTP-Only Cookie
    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    // Log audit
    await createAuditLog({
      userId: user.id,
      action: "USER_LOGIN",
      resource: "User",
      resourceId: user.id,
      details: { email: user.email },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return response;
  } catch (err: any) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });

    let errorMessage = "Internal server error";
    if (err?.code === "P2021" || err?.message?.includes("does not exist") || err?.message?.includes("no such table")) {
      errorMessage = "Database tables not initialized. Please push the schema to your PostgreSQL database.";
    } else if (err?.code === "P1001" || err?.code === "P1000" || err?.message?.includes("Can't reach database server")) {
      errorMessage = "Cannot connect to database. Please verify DATABASE_URL in Vercel settings.";
    } else if (err?.message?.includes("dev.db") || err?.message?.includes("unable to open database file")) {
      errorMessage = "SQLite cannot run on Vercel serverless. Please set a PostgreSQL DATABASE_URL.";
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
