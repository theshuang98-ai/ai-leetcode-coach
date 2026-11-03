import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const PREORDER_FILE = path.join(DATA_DIR, 'preorders.json');

interface PreorderEntry {
  email: string;
  timestamp: string;
}

async function readPreorders(): Promise<PreorderEntry[]> {
  try {
    const raw = await fs.readFile(PREORDER_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writePreorders(entries: PreorderEntry[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PREORDER_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: '请输入有效的邮箱地址' },
        { status: 400 },
      );
    }

    // Read existing entries
    const entries = await readPreorders();

    // Check for duplicate
    if (entries.some((entry) => entry.email === email)) {
      return NextResponse.json(
        { error: '该邮箱已预约过了' },
        { status: 409 },
      );
    }

    // Append new entry
    entries.push({
      email,
      timestamp: new Date().toISOString(),
    });

    // Write back
    await writePreorders(entries);

    return NextResponse.json(
      { message: '预约成功', email },
      { status: 201 },
    );
  } catch (error) {
    console.error('Preorder API error:', error);
    return NextResponse.json(
      { error: '服务器内部错误，请稍后再试' },
      { status: 500 },
    );
  }
}
