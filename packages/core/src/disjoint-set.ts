/**
 * @license Apache-2.0
 * @s2c/core — Disjoint-Set Union (Union-Find) data structure.
 * Implements path compression and rank / priority union per specification §8.
 */

export class DisjointSet<T = string> {
  private parent = new Map<T, T>();
  private rank = new Map<T, number>();

  /**
   * Initializes a set with a single element if not already present.
   */
  makeSet(x: T): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  /**
   * Checks whether the element is registered in the disjoint set.
   */
  has(x: T): boolean {
    return this.parent.has(x);
  }

  /**
   * Finds the representative element of the set containing x with path compression.
   */
  find(x: T): T {
    this.makeSet(x);
    let root = x;
    let parent = this.parent.get(root);
    while (parent !== undefined && root !== parent) {
      root = parent;
      parent = this.parent.get(root);
    }

    // Path compression
    let curr = x;
    while (curr !== root) {
      const next = this.parent.get(curr);
      this.parent.set(curr, root);
      if (next === undefined) {
        break;
      }
      curr = next;
    }

    return root;
  }

  /**
   * Merges the sets containing x and y.
   * If priorityFn is provided, the return value of priorityFn(rootX, rootY)
   * becomes the new representative root of the merged set.
   * Otherwise, standard union by rank is used.
   */
  union(x: T, y: T, priorityFn?: (rootA: T, rootB: T) => T): T {
    const rootX = this.find(x);
    const rootY = this.find(y);

    if (rootX === rootY) {
      return rootX;
    }

    if (priorityFn) {
      const winner = priorityFn(rootX, rootY);
      const loser = winner === rootX ? rootY : rootX;
      this.parent.set(loser, winner);
      return winner;
    }

    const rankX = this.rank.get(rootX) ?? 0;
    const rankY = this.rank.get(rootY) ?? 0;

    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
      return rootY;
    }
    if (rankX > rankY) {
      this.parent.set(rootY, rootX);
      return rootX;
    }

    this.parent.set(rootY, rootX);
    this.rank.set(rootX, rankX + 1);
    return rootX;
  }

  /**
   * Returns all disjoint sets grouped by their root representative.
   */
  getEquivalenceClasses(): Map<T, T[]> {
    const groups = new Map<T, T[]>();
    for (const item of this.parent.keys()) {
      const root = this.find(item);
      let list = groups.get(root);
      if (!list) {
        list = [];
        groups.set(root, list);
      }
      list.push(item);
    }
    return groups;
  }
}
