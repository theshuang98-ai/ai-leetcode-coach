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

interface ValidationResult {
  valid: boolean;
  totalProblems: number;
  totalEdges: number;
  message: string;
  errors: string[];
}

export async function POST(): Promise<NextResponse> {
  const data = loadDependencies();
  const errors: string[] = [];
  const problemIds = new Set(Object.keys(data));

  // Build graph and in-degree map
  const graph: Map<string, string[]> = new Map();
  const inDegree: Map<string, number> = new Map();

  for (const [pid, node] of Object.entries(data)) {
    graph.set(pid, node.prerequisites);
    inDegree.set(pid, node.prerequisites.length);

    // Check max 3 prerequisites
    if (node.prerequisites.length > 3) {
      errors.push(`Problem '${pid}' has ${node.prerequisites.length} prerequisites (max 3)`);
    }

    // Check all referenced IDs exist
    for (const refId of [...node.prerequisites, ...node.dependents]) {
      if (!problemIds.has(refId)) {
        errors.push(`Referenced problem '${refId}' does not exist as a key in dependencies.json`);
      }
    }
  }

  // Kahn's algorithm for cycle detection
  const dependentsMap: Map<string, string[]> = new Map();
  for (const pid of problemIds) {
    dependentsMap.set(pid, []);
  }
  for (const [pid, prereqs] of graph.entries()) {
    for (const prereqId of prereqs) {
      dependentsMap.get(prereqId)?.push(pid);
    }
  }

  const queue: string[] = [];
  for (const [pid, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(pid);
  }

  let sortedCount = 0;
  while (queue.length > 0) {
    const pid = queue.shift()!;
    sortedCount++;
    for (const dependentId of dependentsMap.get(pid) || []) {
      const newDeg = (inDegree.get(dependentId) || 1) - 1;
      inDegree.set(dependentId, newDeg);
      if (newDeg === 0) queue.push(dependentId);
    }
  }

  const totalEdges = Object.values(data).reduce(
    (sum, node) => sum + node.prerequisites.length,
    0
  );

  if (sortedCount !== problemIds.size) {
    const cycleNodes = [...inDegree.entries()]
      .filter(([_, deg]) => deg > 0)
      .map(([pid]) => pid);
    errors.push(
      `Cycle detected! ${problemIds.size - sortedCount} nodes not sortable. ` +
      `Nodes in cycle: ${cycleNodes.join(', ')}`
    );
  }

  const result: ValidationResult = {
    valid: errors.length === 0,
    totalProblems: problemIds.size,
    totalEdges,
    message:
      errors.length === 0
        ? 'DAG is valid — no cycles detected, all references resolve.'
        : `DAG validation failed with ${errors.length} error(s).`,
    errors,
  };

  return NextResponse.json(result);
}
