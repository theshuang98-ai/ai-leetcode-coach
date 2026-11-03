"""
Validate the problem dependency DAG.

Checks:
- All referenced problem IDs exist as keys in dependencies.json
- No problem has more than 3 prerequisites
- Graph is acyclic (via topological sort / Kahn's algorithm)

Usage: python scripts/validate_dag.py
"""

import json
import os
import sys


def load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_dag(deps_path: str) -> int:
    if not os.path.exists(deps_path):
        print(f"ERROR: File not found: {deps_path}")
        return 1

    data = load_json(deps_path)

    # Build adjacency: problem_id -> { prerequisites: [], dependents: [] }
    # Also collect all referenced IDs
    graph = {}  # problem_id -> list of prerequisite IDs
    all_ids = set()

    for problem_id, node in data.items():
        if not isinstance(node, dict):
            print(f"ERROR: Invalid entry for problem '{problem_id}': expected object")
            return 1

        prereqs = node.get("prerequisites", [])
        deps = node.get("dependents", [])

        if not isinstance(prereqs, list) or not isinstance(deps, list):
            print(f"ERROR: 'prerequisites' and 'dependents' must be arrays for problem '{problem_id}'")
            return 1

        # Check max 3 prerequisites
        if len(prereqs) > 3:
            print(f"ERROR: Problem '{problem_id}' has {len(prereqs)} prerequisites (max 3)")
            return 1

        graph[problem_id] = prereqs
        all_ids.add(problem_id)
        for pid in prereqs:
            all_ids.add(pid)
        for pid in deps:
            all_ids.add(pid)

    # Validate all referenced IDs exist as keys
    missing_ids = [pid for pid in all_ids if pid not in graph]
    if missing_ids:
        print(f"ERROR: Referenced problem IDs not found as keys in dependencies.json:")
        for pid in sorted(missing_ids):
            print(f"  - {pid}")
        return 1

    # Build reverse adjacency for detection: which nodes have no prerequisites
    in_degree: dict[str, int] = {pid: 0 for pid in graph}
    for pid, prereqs in graph.items():
        in_degree[pid] = len(prereqs)

    # Kahn's algorithm for topological sort
    queue = [pid for pid, deg in in_degree.items() if deg == 0]
    sorted_count = 0

    while queue:
        pid = queue.pop(0)
        sorted_count += 1
        # For each problem that depends on pid, decrease its "effective" in-degree
        # We need the reverse mapping: dependents map
        # Rebuild: for each problem, its dependents are any problem that lists it as a prereq
        pass

    # Simpler approach: build reverse edges (dependents map)
    # A -> B means B depends on A (A is prereq of B)
    # For topological sort, we track in-degree (number of incoming edges)
    # in-degree of a problem = number of prerequisites
    # We already have this: in_degree[pid]

    queue = [pid for pid, deg in in_degree.items() if deg == 0]
    sorted_count = 0

    # Build reverse mapping: prereq_id -> list of problems that depend on it
    dependents_map: dict[str, list[str]] = {pid: [] for pid in graph}
    for pid, prereqs in graph.items():
        for prereq_id in prereqs:
            dependents_map[prereq_id].append(pid)

    while queue:
        pid = queue.pop(0)
        sorted_count += 1
        for dependent_id in dependents_map.get(pid, []):
            in_degree[dependent_id] -= 1
            if in_degree[dependent_id] == 0:
                queue.append(dependent_id)

    total_nodes = len(graph)
    total_edges = sum(len(prereqs) for prereqs in graph.values())

    if sorted_count != total_nodes:
        cycle_nodes = [pid for pid, deg in in_degree.items() if deg > 0]
        print(f"ERROR: Cycle detected! {total_nodes - sorted_count} nodes not sortable.")
        print(f"Nodes in cycle (non-zero in-degree): {', '.join(sorted(cycle_nodes))}")
        return 1

    print(f"DAG valid. Total edges: {total_edges}")
    return 0


def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, ".."))
    deps_path = os.path.join(project_root, "data", "dependencies.json")

    exit_code = validate_dag(deps_path)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
