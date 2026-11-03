import { NextResponse } from 'next/server';
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

// GET /api/dependencies — list all dependency graph metadata
export async function GET() {
  const data = loadDependencies();

  const totalProblems = Object.keys(data).length;
  const totalEdges = Object.values(data).reduce(
    (sum, node) => sum + node.prerequisites.length,
    0
  );
  const problemsWithPrereqs = Object.entries(data)
    .filter(([_, node]) => node.prerequisites.length > 0)
    .map(([id, node]) => ({
      id,
      prerequisiteCount: node.prerequisites.length,
      dependentCount: node.dependents.length,
    }));

  return NextResponse.json({
    totalProblems,
    totalEdges,
    problemsWithPrerequisites: problemsWithPrereqs,
  });
}
