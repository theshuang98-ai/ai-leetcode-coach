import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface DependencyNode {
  prerequisites: string[];
  dependents: string[];
}

interface DependencyData {
  [problemId: string]: DependencyNode;
}

function loadDependencies(): DependencyData {
  const filePath = path.join(process.cwd(), 'data', 'dependencies.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const { id } = params;
  const data = loadDependencies();

  if (!(id in data)) {
    return NextResponse.json(
      { error: `Problem '${id}' not found in dependency graph` },
      { status: 404 }
    );
  }

  const node = data[id]!;

  const prerequisites = node.prerequisites.map((prereqId) => ({
    id: prereqId,
  }));

  const dependents = node.dependents.map((depId) => ({
    id: depId,
  }));

  return NextResponse.json({
    id,
    prerequisites,
    dependents,
  });
}
